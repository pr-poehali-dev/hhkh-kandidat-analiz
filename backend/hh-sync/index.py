import json
import os
import urllib.request
import urllib.error
import psycopg2

SCHEMA = 't_p93338434_hhkh_kandidat_analiz'

STATUS_MAP = {
    'response': 'new',
    'consider': 'review',
    'phone_interview': 'review',
    'assessment': 'test',
    'interview': 'interview',
    'offer': 'offer',
    'hired': 'offer',
    'discard_by_employer': 'reject',
    'discard_by_applicant': 'reject',
    'discard_no_interaction': 'reject',
    'discard_vacancy_closed': 'reject',
    'discard_to_other_vacancy': 'reject',
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hh_get(url, token):
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}',
        'User-Agent': 'HireDesk/1.0 (support@hiredesk.ru)',
    })
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())


def sync_collection(cur, token, vacancy_id, vacancy_name, col_id):
    """Загружает все страницы коллекции с HH.ru и сохраняет в БД"""
    synced = 0
    page = 0
    while True:
        if page == 0:
            url = f'https://api.hh.ru/negotiations/{col_id}?vacancy_id={vacancy_id}&per_page=50'
        else:
            url = f'https://api.hh.ru/negotiations/{col_id}?vacancy_id={vacancy_id}&per_page=50&page={page}'
        try:
            data = hh_get(url, token)
        except Exception:
            break

        items = data.get('items', [])
        for item in items:
            resume = item.get('resume') or {}
            salary = resume.get('salary') or {}
            exp = resume.get('total_experience') or {}

            # Контакты из краткого резюме (обычно пустые)
            contacts = resume.get('contact') or []
            phone = ''
            for c in contacts:
                if isinstance(c, dict) and c.get('type') == 'cell':
                    val = c.get('value')
                    phone = val.get('formatted', '') if isinstance(val, dict) else str(val or '')
                    break

            # Если телефон не пришёл — запрашиваем детальный отклик
            if not phone:
                neg_id_tmp = str(item.get('id', ''))
                try:
                    neg_detail = hh_get(f'https://api.hh.ru/negotiations/{neg_id_tmp}', token)
                    detail_resume = neg_detail.get('resume') or {}
                    for c in (detail_resume.get('contact') or []):
                        if isinstance(c, dict) and c.get('type') == 'cell':
                            val = c.get('value')
                            phone = val.get('formatted', '') if isinstance(val, dict) else str(val or '')
                            break
                except Exception:
                    pass

            resume_id = resume.get('id') or str(item.get('id', ''))

            cur.execute(f'''
                INSERT INTO {SCHEMA}.candidates
                    (hh_resume_id, first_name, last_name, phone, city, age,
                     resume_title, experience_months, salary_amount, salary_currency, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (hh_resume_id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    phone = COALESCE(NULLIF(EXCLUDED.phone,''), {SCHEMA}.candidates.phone),
                    city = EXCLUDED.city,
                    experience_months = EXCLUDED.experience_months,
                    salary_amount = EXCLUDED.salary_amount,
                    updated_at = NOW()
                RETURNING id
            ''', (
                resume_id,
                resume.get('first_name', ''),
                resume.get('last_name', ''),
                phone,
                (resume.get('area') or {}).get('name', ''),
                resume.get('age'),
                resume.get('title', ''),
                exp.get('months') or 0,
                salary.get('amount'),
                salary.get('currency', 'RUR'),
            ))
            candidate_id = cur.fetchone()[0]

            neg_id = str(item.get('id', ''))
            cur.execute(f'''
                INSERT INTO {SCHEMA}.applications
                    (candidate_id, hh_negotiation_id, vacancy_id, vacancy_name,
                     status, hh_status, applied_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (hh_negotiation_id) DO UPDATE SET
                    hh_status = EXCLUDED.hh_status,
                    updated_at = EXCLUDED.updated_at
            ''', (
                candidate_id, neg_id, vacancy_id, vacancy_name,
                STATUS_MAP.get(col_id, 'new'), col_id,
                item.get('created_at'), item.get('updated_at'),
            ))
            synced += 1

        pages = data.get('pages', 1)
        page += 1
        if page >= pages:
            break

    return synced


def handler(event: dict, context) -> dict:
    """Синхронизация одной коллекции откликов с HH.ru в БД"""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-HH-Token',
        }, 'body': ''}

    CORS = {'Access-Control-Allow-Origin': '*'}

    headers = event.get('headers', {})
    token = None
    for k, v in headers.items():
        if k.lower() == 'x-hh-token':
            token = v
            break

    if not token:
        return {'statusCode': 401, 'headers': {**CORS},
                'body': json.dumps({'error': 'X-HH-Token required'})}

    body = json.loads(event.get('body') or '{}')
    vacancy_id = body.get('vacancy_id', '')
    vacancy_name = body.get('vacancy_name', '')
    col_id = body.get('col_id', '')

    if not vacancy_id or not col_id:
        return {'statusCode': 400, 'headers': {**CORS},
                'body': json.dumps({'error': 'vacancy_id and col_id required'})}

    conn = get_db()
    try:
        with conn.cursor() as cur:
            synced = sync_collection(cur, token, vacancy_id, vacancy_name, col_id)
        conn.commit()
    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': {**CORS},
                'body': json.dumps({'error': str(e)})}
    finally:
        conn.close()

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'synced': synced, 'col_id': col_id}),
    }