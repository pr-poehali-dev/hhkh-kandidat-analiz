import json
import os
import imaplib
import email
import re
import urllib.request
import urllib.error
import psycopg2
from email.header import decode_header

SCHEMA = 't_p93338434_hhkh_kandidat_analiz'
ALLOWED_STATUSES_FOR_TEST = ('consider', 'phone_interview')


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


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
    """Извлекаем ID переписки из ссылки в письме HH.ru"""
    # Ищем topic_id в URL письма
    patterns = [
        r'chat_id=(\d+)',
        r'topic_id=(\d+)',
        r'negotiations/(\d+)',
        r't=(\d+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def handler(event: dict, context) -> dict:
    """Читает почту, находит уведомления от HH.ru и переводит кандидатов на тестирование"""

    CORS = {'Access-Control-Allow-Origin': '*'}

    email_addr = os.environ.get('YANDEX_EMAIL', '')
    app_password = os.environ.get('YANDEX_APP_PASSWORD', '')
    hh_token = os.environ.get('HH_ACCESS_TOKEN', '')

    if not email_addr or not app_password:
        return {'statusCode': 500, 'headers': {**CORS},
                'body': json.dumps({'error': 'Email credentials not configured'})}

    processed = 0
    moved_to_test = 0
    errors = []

    try:
        # Подключаемся к Яндекс IMAP с таймаутом
        mail = imaplib.IMAP4_SSL('imap.yandex.ru', 993)
        mail.socket().settimeout(10)
        mail.login(email_addr, app_password)
        mail.select('INBOX')

        # Ищем непрочитанные письма от HH.ru
        _, msg_ids = mail.search(None, 'UNSEEN FROM "noreply@hh.ru"')

        if not msg_ids[0]:
            mail.logout()
            return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps({'processed': 0, 'moved_to_test': 0, 'message': 'No new emails'})}

        # Обрабатываем максимум 10 писем за один вызов
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

                        # Нас интересуют письма о новых сообщениях от кандидатов
                        if 'написал' not in subject.lower() and 'сообщение' not in subject.lower() and 'ответил' not in subject.lower():
                            continue

                        # Извлекаем тело письма
                        body = ''
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() in ('text/plain', 'text/html'):
                                    body += part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        else:
                            body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')

                        # Ищем ID переписки
                        negotiation_id = extract_negotiation_id(body)
                        if not negotiation_id:
                            continue

                        processed += 1

                        # Проверяем статус в БД
                        cur.execute(f'''
                            SELECT hh_status, id FROM {SCHEMA}.applications
                            WHERE hh_negotiation_id = %s
                        ''', (negotiation_id,))
                        row = cur.fetchone()

                        if not row:
                            continue

                        current_status, app_id = row

                        # Переводим только из "Первичного контакта"
                        if current_status not in ALLOWED_STATUSES_FOR_TEST:
                            continue

                        # Меняем статус на HH.ru
                        try:
                            hh_put_status(negotiation_id, 'assessment', hh_token)
                        except urllib.error.HTTPError as e:
                            errors.append(f'HH error {e.code} for {negotiation_id}')
                            continue

                        # Обновляем БД
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

                        # Помечаем письмо как прочитанное
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