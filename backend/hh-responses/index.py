import json
import os
import urllib.request
import urllib.error
import psycopg2

SCHEMA = 't_p93338434_hhkh_kandidat_analiz'
ALLOWED_STATUSES_FOR_TEST = ('consider', 'phone_interview')


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hh_put_status(negotiation_id, action, token):
    url = f'https://api.hh.ru/negotiations/{action}/{negotiation_id}'
    req = urllib.request.Request(url, data=b'', headers={
        'Authorization': f'Bearer {token}',
        'User-Agent': 'HireDesk/1.0 (support@hiredesk.ru)',
    }, method='PUT')
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status


def fetch_json(url, hh_headers):
    req = urllib.request.Request(url, headers=hh_headers)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def slim_item(item, col_id):
    """Оставляем только нужные поля — уменьшаем размер ответа"""
    resume = item.get('resume') or {}
    area = resume.get('area') or {}
    salary = resume.get('salary') or {}
    exp = resume.get('total_experience') or {}
    # topic_id — реальный ID отклика (переписки), item.id — ID резюме
    topic_id = str(item.get('id', ''))  # числовой ID отклика из поля id верхнего уровня
    resume_id = resume.get('id', '') or item.get('id', '')
    return {
        'id': topic_id,          # ID отклика для дедупликации
        'resume_id': resume_id,  # ID резюме
        '_collection_id': col_id,
        'created_at': item.get('created_at', ''),
        'updated_at': item.get('updated_at', ''),
        'state': item.get('state'),
        'vacancy': item.get('vacancy'),
        'resume': {
            'last_name': resume.get('last_name', ''),
            'first_name': resume.get('first_name', ''),
            'title': resume.get('title', ''),
            'area': {'name': area.get('name', '')},
            'salary': {'amount': salary.get('amount'), 'currency': salary.get('currency', 'RUR')},
            'total_experience': {'months': exp.get('months', 0)},
            'contact': resume.get('contact', []),
        }
    }


def fetch_collection(col_id, vacancy_id, hh_headers):
    """Загружает все страницы одной коллекции"""
    items = []
    # Первая страница — без параметра page (HH.ru не принимает page=0)
    url = f'https://api.hh.ru/negotiations/{col_id}?vacancy_id={vacancy_id}&per_page=50'
    try:
        data = fetch_json(url, hh_headers)
    except Exception:
        return items
    for item in data.get('items', []):
        items.append(slim_item(item, col_id))
    pages = data.get('pages', 1)
    # Остальные страницы начиная со второй
    for page in range(1, pages):
        url_p = f'https://api.hh.ru/negotiations/{col_id}?vacancy_id={vacancy_id}&per_page=50&page={page}'
        try:
            data_p = fetch_json(url_p, hh_headers)
        except Exception:
            break
        for item in data_p.get('items', []):
            items.append(slim_item(item, col_id))
    return items


def handle_webhook(event: dict) -> dict:
    """Обработка вебхука от HH.ru — новое сообщение от кандидата"""
    CORS = {'Access-Control-Allow-Origin': '*'}

    # GET — верификация подписки HH.ru
    if event.get('httpMethod') == 'GET':
        return {'statusCode': 200, 'headers': {**CORS}, 'body': 'ok'}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 200, 'headers': {**CORS}, 'body': 'bad json'}

    event_type = body.get('type', '')
    if event_type != 'NEW_NEGOTIATION_MESSAGE':
        return {'statusCode': 200, 'headers': {**CORS}, 'body': 'ignored'}

    negotiation_id = str((body.get('object') or {}).get('id', ''))
    if not negotiation_id:
        return {'statusCode': 200, 'headers': {**CORS}, 'body': 'no id'}

    token = os.environ.get('HH_ACCESS_TOKEN', '')
    if not token:
        return {'statusCode': 200, 'headers': {**CORS}, 'body': 'no token'}

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                SELECT hh_status, id FROM {SCHEMA}.applications
                WHERE hh_negotiation_id = %s
            ''', (negotiation_id,))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 200, 'headers': {**CORS}, 'body': 'not in db'}

            current_status, app_id = row
            if current_status not in ALLOWED_STATUSES_FOR_TEST:
                return {'statusCode': 200, 'headers': {**CORS}, 'body': f'skip:{current_status}'}

            try:
                hh_put_status(negotiation_id, 'assessment', token)
            except urllib.error.HTTPError as e:
                return {'statusCode': 200, 'headers': {**CORS}, 'body': f'hh_err:{e.code}'}

            cur.execute(f'''
                UPDATE {SCHEMA}.applications
                SET hh_status='assessment', status='test', updated_at=NOW()
                WHERE id=%s
            ''', (app_id,))
            cur.execute(f'''
                INSERT INTO {SCHEMA}.interactions
                    (candidate_id, application_id, type, content, author)
                SELECT candidate_id, id,
                    'status_change',
                    'Автоперевод на тестирование (ответил на сообщение)',
                    'Система'
                FROM {SCHEMA}.applications WHERE id=%s
            ''', (app_id,))
        conn.commit()
    finally:
        conn.close()

    return {'statusCode': 200, 'headers': {**CORS}, 'body': 'ok'}


def handler(event: dict, context) -> dict:
    """Загрузка откликов и вакансий работодателя с HH.ru + обработка вебхуков"""

    # Вебхук от HH.ru — отдельный путь
    params_check = event.get('queryStringParameters') or {}
    if params_check.get('webhook') == '1':
        return handle_webhook(event)

    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-HH-Token',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    CORS = {'Access-Control-Allow-Origin': '*'}

    headers = event.get('headers', {})
    token = None
    for k, v in headers.items():
        if k.lower() == 'x-hh-token':
            token = v
            break
    if not token:
        token = (event.get('queryStringParameters') or {}).get('token')

    if not token:
        return {
            'statusCode': 401,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'X-HH-Token header is required'}),
        }

    params = event.get('queryStringParameters') or {}
    resource = params.get('resource', 'negotiations')

    hh_headers = {
        'Authorization': f'Bearer {token}',
        'User-Agent': 'HireDesk/1.0 (support@hiredesk.ru)',
    }

    if resource == 'vacancies':
        employer_id = params.get('employer_id', '')
        url = f'https://api.hh.ru/vacancies?employer_id={employer_id}&per_page=50' if employer_id else 'https://api.hh.ru/vacancies/mine?per_page=50'

    elif resource == 'negotiations_states':
        # Возвращает список доступных коллекций (статусов) для вакансии
        vacancy_id = params.get('vacancy_id', '')
        if not vacancy_id:
            return {'statusCode': 400, 'headers': {**CORS}, 'body': json.dumps({'error': 'vacancy_id required'})}
        try:
            col_data = fetch_json(f'https://api.hh.ru/negotiations?vacancy_id={vacancy_id}&per_page=1', hh_headers)
        except urllib.error.HTTPError as e:
            return {'statusCode': e.code, 'headers': {**CORS}, 'body': json.dumps({'error': f'HH.ru {e.code}'})}
        states = [s['id'] for s in col_data.get('employer_states', []) if s.get('id')]
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'states': states}),
        }

    elif resource == 'negotiations':
        # Загружает одну коллекцию (col_id) для вакансии
        vacancy_id = params.get('vacancy_id', '')
        col_id = params.get('col_id', '')
        if not vacancy_id or not col_id:
            return {'statusCode': 400, 'headers': {**CORS}, 'body': json.dumps({'error': 'vacancy_id and col_id required'})}

        items = fetch_collection(col_id, vacancy_id, hh_headers)
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'items': items, 'found': len(items)}),
        }

    elif resource == 'debug_col':
        vacancy_id = params.get('vacancy_id', '')
        col_id = params.get('col_id', 'assessment')
        page = params.get('page', '0')
        url = f'https://api.hh.ru/negotiations/{col_id}?vacancy_id={vacancy_id}&per_page=50&page={page}'
    elif resource == 'templates':
        # Получить список шаблонов писем работодателя
        employer_id = params.get('employer_id', '')
        url = f'https://api.hh.ru/message_templates?employer_id={employer_id}'
        try:
            data = fetch_json(url, hh_headers)
            return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps(data)}
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='ignore')
            return {'statusCode': e.code, 'headers': {**CORS}, 'body': json.dumps({'error': err})}

    elif resource == 'test_action':
        # Тест смены статуса отклика
        negotiation_id = params.get('negotiation_id', '')
        action = params.get('action', 'consider')
        if not negotiation_id:
            return {'statusCode': 400, 'headers': {**CORS}, 'body': json.dumps({'error': 'negotiation_id required'})}
        put_url = f'https://api.hh.ru/negotiations/{action}/{negotiation_id}'
        req_put = urllib.request.Request(put_url, data=b'', headers=hh_headers, method='PUT')
        try:
            with urllib.request.urlopen(req_put, timeout=10) as r:
                body = r.read().decode('utf-8') or '{}'
                return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
                        'body': json.dumps({'ok': True, 'response': body})}
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='ignore')
            return {'statusCode': e.code, 'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps({'ok': False, 'status': e.code, 'error': err})}
    elif resource == 'register_webhook':
        # Регистрируем вебхук на HH.ru
        webhook_url = 'https://functions.poehali.dev/2a41e2d1-38ab-4c9b-aa98-6800a8333690?webhook=1'
        import urllib.parse
        # HH.ru ожидает JSON тело с employer_id
        data = json.dumps({
            'url': webhook_url,
            'actions': ['NEGOTIATION_STATUS_CHANGED'],
            'employer_id': 10960749,
        }).encode('utf-8')
        hh_headers['Content-Type'] = 'application/json'
        req_wh = urllib.request.Request(
            'https://api.hh.ru/webhook/subscriptions',
            data=data,
            headers={**hh_headers, 'Content-Type': 'application/x-www-form-urlencoded'},
            method='POST'
        )
        try:
            with urllib.request.urlopen(req_wh, timeout=10) as r:
                resp_body = r.read().decode('utf-8')
                return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
                        'body': json.dumps({'ok': True, 'response': resp_body})}
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='ignore')
            return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps({'ok': False, 'status': e.code, 'error': err})}
    elif resource == 'me':
        url = 'https://api.hh.ru/me'
    else:
        return {
            'statusCode': 400,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Unknown resource: {resource}'}),
        }

    try:
        data = fetch_json(url, hh_headers)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        return {
            'statusCode': e.code,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'HH.ru error {e.code}', 'details': error_body}),
        }
    except Exception as e:
        return {
            'statusCode': 502,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)}),
        }

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps(data),
    }