import json
import os
import urllib.request
import urllib.error
import psycopg2

SCHEMA = 't_p93338434_hhkh_kandidat_analiz'

# Только кандидаты в этом статусе переводятся на тестирование
ALLOWED_STATUSES = ('consider', 'phone_interview')


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hh_put(url, token):
    """PUT запрос к HH.ru для смены статуса"""
    req = urllib.request.Request(url, data=b'', headers={
        'Authorization': f'Bearer {token}',
        'User-Agent': 'HireDesk/1.0 (support@hiredesk.ru)',
    }, method='PUT')
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status


def get_hh_token():
    """Берём токен из переменной окружения (сохраняется при синхронизации)"""
    return os.environ.get('HH_ACCESS_TOKEN', '')


def handler(event: dict, context) -> dict:
    """Приём вебхуков от HH.ru и автоматический перевод статуса"""

    CORS = {'Access-Control-Allow-Origin': '*'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }, 'body': ''}

    # HH.ru при регистрации подписки делает GET для верификации
    if event.get('httpMethod') == 'GET':
        return {'statusCode': 200, 'headers': {**CORS}, 'body': 'ok'}

    # Обрабатываем POST — реальное событие от HH.ru
    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': {**CORS}, 'body': 'bad json'}

    event_type = body.get('type', '')
    payload = body.get('object', {})

    # Нас интересует только событие нового сообщения от соискателя
    if event_type != 'NEW_NEGOTIATION_MESSAGE':
        return {'statusCode': 200, 'headers': {**CORS}, 'body': 'ignored'}

    negotiation_id = str(payload.get('id', ''))
    if not negotiation_id:
        return {'statusCode': 200, 'headers': {**CORS}, 'body': 'no negotiation_id'}

    # Проверяем текущий статус в нашей БД
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                SELECT a.hh_status, a.id
                FROM {SCHEMA}.applications a
                WHERE a.hh_negotiation_id = %s
            ''', (negotiation_id,))
            row = cur.fetchone()

            if not row:
                # Отклик не найден в БД — пропускаем
                return {'statusCode': 200, 'headers': {**CORS}, 'body': 'not found in db'}

            current_hh_status = row[0]
            application_id = row[1]

            # Переводим только если кандидат в "Первичном контакте"
            if current_hh_status not in ALLOWED_STATUSES:
                return {'statusCode': 200, 'headers': {**CORS},
                        'body': f'skipped, status={current_hh_status}'}

            # Получаем токен
            token = get_hh_token()
            if not token:
                return {'statusCode': 200, 'headers': {**CORS}, 'body': 'no token'}

            # Меняем статус на HH.ru → "Тестовое задание"
            try:
                hh_put(
                    f'https://api.hh.ru/negotiations/assessment/{negotiation_id}',
                    token
                )
            except urllib.error.HTTPError as e:
                # Логируем ошибку но не падаем
                print(f'HH status change failed: {e.code} for {negotiation_id}')
                return {'statusCode': 200, 'headers': {**CORS},
                        'body': f'hh error {e.code}'}

            # Обновляем статус в нашей БД
            cur.execute(f'''
                UPDATE {SCHEMA}.applications
                SET hh_status = 'assessment', status = 'test', updated_at = NOW()
                WHERE id = %s
            ''', (application_id,))

            # Записываем в историю
            cur.execute(f'''
                INSERT INTO {SCHEMA}.interactions
                    (candidate_id, application_id, type, content, author)
                SELECT candidate_id, id, 'status_change',
                    'Автоматический перевод на тестирование (ответил на сообщение)', 'Система'
                FROM {SCHEMA}.applications WHERE id = %s
            ''', (application_id,))

        conn.commit()
    finally:
        conn.close()

    return {'statusCode': 200, 'headers': {**CORS}, 'body': 'ok'}
