import json
import os
import urllib.request
import urllib.error
import psycopg2
from psycopg2.extras import execute_values

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


def fetch_hh(url, token):
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}',
        'User-Agent': 'HireDesk/1.0 (support@hiredesk.ru)',
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def upsert_candidate(cur, item):
    """Создаёт или обновляет кандидата, возвращает его id"""
    resume = item.get('resume') or {}
    resume_id = resume.get('id') or item.get('resume_id') or str(item.get('id', ''))
    salary = resume.get('salary') or {}
    exp = resume.get('total_experience') or {}
    contacts = resume.get('contact') or []
    phone = ''
    for c in contacts:
        if isinstance(c, dict) and c.get('type') == 'cell':
            val = c.get('value')
            if isinstance(val, dict):
                phone = val.get('formatted', '')
            elif isinstance(val, str):
                phone = val
            break

    cur.execute(f'''
        INSERT INTO {SCHEMA}.candidates
            (hh_resume_id, first_name, last_name, phone, city, age, gender,
             resume_title, experience_months, salary_amount, salary_currency, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (hh_resume_id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            phone = COALESCE(NULLIF(EXCLUDED.phone, ''), {SCHEMA}.candidates.phone),
            city = EXCLUDED.city,
            age = EXCLUDED.age,
            gender = EXCLUDED.gender,
            resume_title = EXCLUDED.resume_title,
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
        (resume.get('gender') or {}).get('id', ''),
        resume.get('title', ''),
        (exp.get('months') or 0),
        salary.get('amount'),
        salary.get('currency', 'RUR'),
    ))
    row = cur.fetchone()
    return row[0]


def upsert_application(cur, candidate_id, item, vacancy_name, col_id):
    """Создаёт или обновляет отклик"""
    neg_id = str(item.get('id', ''))
    vac = item.get('vacancy') or {}
    vacancy_id = str(vac.get('id', '')) if vac else ''
    status = STATUS_MAP.get(col_id, 'new')
    hh_status = col_id
    applied_at = item.get('created_at')
    updated_at = item.get('updated_at')

    cur.execute(f'''
        INSERT INTO {SCHEMA}.applications
            (candidate_id, hh_negotiation_id, vacancy_id, vacancy_name,
             status, hh_status, applied_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (hh_negotiation_id) DO UPDATE SET
            status = EXCLUDED.status,
            hh_status = EXCLUDED.hh_status,
            updated_at = EXCLUDED.updated_at
        RETURNING id
    ''', (
        candidate_id, neg_id, vacancy_id, vacancy_name,
        status, hh_status, applied_at, updated_at,
    ))
    return cur.fetchone()[0]


def handler(event: dict, context) -> dict:
    """Синхронизация откликов с HH.ru в базу данных"""

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
    items = body.get('items', [])

    if not vacancy_id or not col_id or not items:
        return {'statusCode': 400, 'headers': {**CORS},
                'body': json.dumps({'error': 'vacancy_id, col_id and items required'})}

    synced = 0
    updated = 0

    conn = get_db()
    try:
        with conn.cursor() as cur:
            for item in items:
                candidate_id = upsert_candidate(cur, item)
                app_id = upsert_application(cur, candidate_id, item, vacancy_name, col_id)
                synced += 1
        conn.commit()
    finally:
        conn.close()

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'synced': synced, 'col_id': col_id}),
    }
