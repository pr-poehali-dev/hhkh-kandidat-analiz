import json
import os
import psycopg2
import psycopg2.extras

SCHEMA = 't_p93338434_hhkh_kandidat_analiz'


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    """Чтение и управление кандидатами из базы данных"""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }, 'body': ''}

    CORS = {'Access-Control-Allow-Origin': '*'}
    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            if method == 'GET':
                action = params.get('action', 'list')

                if action == 'list':
                    # Список всех откликов с данными кандидата
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
                            -- Предыдущие отклики этого кандидата
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

                elif action == 'stats':
                    # Статистика для дашборда
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
                # Обновление статуса или заметок
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
