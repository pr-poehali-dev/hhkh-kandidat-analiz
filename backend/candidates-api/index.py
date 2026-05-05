import json
import os
import imaplib
import email
import re
import urllib.request
import urllib.error
import psycopg2
import psycopg2.extras
from email.header import decode_header

SCHEMA = 't_p93338434_hhkh_kandidat_analiz'
ALLOWED_STATUSES_FOR_TEST = ('consider', 'phone_interview')


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


# ── Mail monitor helpers ──────────────────────────────────────────────────────

def decode_str(s):
    if s is None:
        return ''
    parts = decode_header(s)
    result = ''
    for part, enc in parts:
        if isinstance(part, bytes):
            result += part.decode(enc or 'utf-8', errors='ignore')
        else:
            result += str(part)
    return result


def hh_put_status(negotiation_id, action, token):
    url = f'https://api.hh.ru/negotiations/{action}/{negotiation_id}'
    req = urllib.request.Request(url, data=b'', headers={
        'Authorization': f'Bearer {token}',
        'User-Agent': 'HireDesk/1.0 (support@hiredesk.ru)',
    }, method='PUT')
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status


def extract_negotiation_id(text):
    patterns = [r'chat_id=(\d+)', r'topic_id=(\d+)', r'negotiations/(\d+)', r't=(\d+)']
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def action_check_mail(CORS):
    email_addr = os.environ.get('YANDEX_EMAIL', '')
    app_password = os.environ.get('YANDEX_APP_PASSWORD', '')
    hh_token = os.environ.get('HH_ACCESS_TOKEN', '')

    if not email_addr or not app_password:
        return {'statusCode': 500, 'headers': {**CORS},
                'body': json.dumps({'error': 'Email credentials not configured'})}

    processed = 0
    moved_to_test = 0
    errors = []
    all_ids = []
    batch = []

    try:
        mail = imaplib.IMAP4_SSL('imap.yandex.ru', 993)
        mail.socket().settimeout(10)
        mail.login(email_addr, app_password)
        mail.select('INBOX')

        _, msg_ids = mail.search(None, 'UNSEEN FROM "noreply@hh.ru"')

        if not msg_ids[0]:
            mail.logout()
            return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps({'processed': 0, 'moved_to_test': 0, 'message': 'No new emails'})}

        all_ids = msg_ids[0].split()
        batch = all_ids[:10]

        conn = get_db()
        try:
            with conn.cursor() as cur:
                for msg_id in batch:
                    try:
                        _, msg_data = mail.fetch(msg_id, '(RFC822)')
                        msg = email.message_from_bytes(msg_data[0][1])
                        subject = decode_str(msg.get('Subject', ''))

                        if 'написал' not in subject.lower() and 'сообщение' not in subject.lower() and 'ответил' not in subject.lower():
                            continue

                        body = ''
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() in ('text/plain', 'text/html'):
                                    body += part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        else:
                            body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')

                        negotiation_id = extract_negotiation_id(body)
                        if not negotiation_id:
                            continue

                        processed += 1

                        cur.execute(f'''
                            SELECT hh_status, id FROM {SCHEMA}.applications
                            WHERE hh_negotiation_id = %s
                        ''', (negotiation_id,))
                        row = cur.fetchone()
                        if not row:
                            continue

                        current_status, app_id = row
                        if current_status not in ALLOWED_STATUSES_FOR_TEST:
                            continue

                        try:
                            hh_put_status(negotiation_id, 'assessment', hh_token)
                        except urllib.error.HTTPError as e:
                            errors.append(f'HH error {e.code} for {negotiation_id}')
                            continue

                        cur.execute(f'''
                            UPDATE {SCHEMA}.applications
                            SET hh_status='assessment', status='test', updated_at=NOW()
                            WHERE id=%s
                        ''', (app_id,))
                        cur.execute(f'''
                            INSERT INTO {SCHEMA}.interactions
                                (candidate_id, application_id, type, content, author)
                            SELECT candidate_id, id, 'status_change',
                                'Автоперевод на тестирование (ответил на сообщение в HH.ru)',
                                'Система'
                            FROM {SCHEMA}.applications WHERE id=%s
                        ''', (app_id,))

                        moved_to_test += 1
                        mail.store(msg_id, '+FLAGS', '\\Seen')

                    except Exception as e:
                        errors.append(str(e))
                        continue

            conn.commit()
        finally:
            conn.close()

        mail.logout()

    except Exception as e:
        return {'statusCode': 500, 'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': str(e)})}

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({
            'processed': processed,
            'moved_to_test': moved_to_test,
            'remaining': max(0, len(all_ids) - len(batch)),
            'errors': errors,
        }),
    }


# ── Main handler ──────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Чтение и управление кандидатами из БД + проверка почты"""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }, 'body': ''}

    CORS = {'Access-Control-Allow-Origin': '*'}
    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'list')

    # Проверка почты — отдельный экшн, не требует DB-соединения сразу
    if action == 'check_mail':
        return action_check_mail(CORS)

    # Смена статуса на HH.ru через токен из секретов
    if action == 'hh_set_status':
        try:
            body = json.loads(event.get('body') or '{}')
        except Exception:
            body = {}
        negotiation_id = body.get('negotiation_id', '') or params.get('negotiation_id', '')
        hh_action = body.get('hh_action', '') or params.get('hh_action', '')
        token = os.environ.get('HH_ACCESS_TOKEN', '')
        if not negotiation_id or not hh_action or not token:
            return {'statusCode': 400, 'headers': {**CORS}, 'body': json.dumps({'error': 'negotiation_id, hh_action and HH_ACCESS_TOKEN required'})}
        try:
            status_code = hh_put_status(negotiation_id, hh_action, token)
            return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps({'ok': True, 'hh_status': status_code})}
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='ignore')
            return {'statusCode': e.code, 'headers': {**CORS}, 'body': json.dumps({'error': err})}

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            if method == 'GET':

                if action == 'list':
                    status_filter = params.get('status', '')
                    vacancy_filter = params.get('vacancy_id', '')
                    where = []
                    values = []
                    if status_filter:
                        where.append('a.status = %s')
                        values.append(status_filter)
                    if vacancy_filter:
                        where.append('a.vacancy_id = %s')
                        values.append(vacancy_filter)
                    where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''
                    cur.execute(f'''
                        SELECT
                            a.id as application_id,
                            a.hh_negotiation_id,
                            a.vacancy_id,
                            a.vacancy_name,
                            a.status,
                            a.hh_status,
                            a.applied_at,
                            a.updated_at,
                            a.test_score,
                            c.id as candidate_id,
                            c.hh_resume_id,
                            c.first_name,
                            c.last_name,
                            c.phone,
                            c.email,
                            c.city,
                            c.age,
                            c.resume_title,
                            c.experience_months,
                            c.salary_amount,
                            c.salary_currency,
                            c.notes,
                            (SELECT COUNT(*) FROM {SCHEMA}.applications a2
                             WHERE a2.candidate_id = c.id AND a2.id != a.id) as prev_applications_count
                        FROM {SCHEMA}.applications a
                        JOIN {SCHEMA}.candidates c ON c.id = a.candidate_id
                        {where_sql}
                        ORDER BY a.updated_at DESC
                    ''', values)
                    rows = cur.fetchall()
                    return {
                        'statusCode': 200,
                        'headers': {**CORS, 'Content-Type': 'application/json'},
                        'body': json.dumps({'items': [dict(r) for r in rows], 'total': len(rows)}, default=str),
                    }

                elif action == 'vacancy_stats':
                    cur.execute(f'''
                        SELECT
                            COALESCE(MAX(NULLIF(vacancy_id, '')), '') as vacancy_id,
                            vacancy_name,
                            COUNT(*) as total
                        FROM {SCHEMA}.applications
                        GROUP BY vacancy_name
                        ORDER BY total DESC
                    ''')
                    rows = cur.fetchall()
                    return {
                        'statusCode': 200,
                        'headers': {**CORS, 'Content-Type': 'application/json'},
                        'body': json.dumps({'items': [dict(r) for r in rows]}, default=str),
                    }

                elif action == 'stats':
                    cur.execute(f'''
                        SELECT
                            COUNT(DISTINCT c.id) as total_candidates,
                            COUNT(a.id) as total_applications,
                            COUNT(a.id) FILTER (WHERE a.status = 'new') as new_count,
                            COUNT(a.id) FILTER (WHERE a.status = 'review') as review_count,
                            COUNT(a.id) FILTER (WHERE a.status = 'test') as test_count,
                            COUNT(a.id) FILTER (WHERE a.status = 'interview') as interview_count,
                            COUNT(a.id) FILTER (WHERE a.status = 'offer') as offer_count,
                            COUNT(a.id) FILTER (WHERE a.status = 'reject') as reject_count,
                            COUNT(DISTINCT a.vacancy_id) as vacancies_count
                        FROM {SCHEMA}.applications a
                        JOIN {SCHEMA}.candidates c ON c.id = a.candidate_id
                    ''')
                    row = cur.fetchone()
                    return {
                        'statusCode': 200,
                        'headers': {**CORS, 'Content-Type': 'application/json'},
                        'body': json.dumps(dict(row), default=str),
                    }

            elif method == 'PUT':
                body = json.loads(event.get('body') or '{}')
                application_id = body.get('application_id')
                if not application_id:
                    return {'statusCode': 400, 'headers': {**CORS},
                            'body': json.dumps({'error': 'application_id required'})}

                updates = []
                values = []
                if 'status' in body:
                    updates.append('status = %s')
                    values.append(body['status'])
                if 'test_score' in body:
                    updates.append('test_score = %s')
                    values.append(body['test_score'])
                if 'test_notes' in body:
                    updates.append('test_notes = %s')
                    values.append(body['test_notes'])

                if updates:
                    values.append(application_id)
                    cur.execute(f'''
                        UPDATE {SCHEMA}.applications
                        SET {', '.join(updates)}, updated_at = NOW()
                        WHERE id = %s
                    ''', values)

                if 'notes' in body and 'candidate_id' in body:
                    cur.execute(f'''
                        UPDATE {SCHEMA}.candidates SET notes = %s, updated_at = NOW()
                        WHERE id = %s
                    ''', (body['notes'], body['candidate_id']))

                conn.commit()
                return {'statusCode': 200, 'headers': {**CORS},
                        'body': json.dumps({'ok': True})}

    finally:
        conn.close()

    return {'statusCode': 400, 'headers': {**CORS}, 'body': json.dumps({'error': 'Unknown action'})}