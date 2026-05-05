import json
import os
import urllib.request
import urllib.error


def handler(event: dict, context) -> dict:
    """Загрузка откликов и вакансий работодателя с HH.ru"""

    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-HH-Token',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    CORS = {'Access-Control-Allow-Origin': '*'}

    headers = event.get('headers', {})
    # Ищем токен без учёта регистра заголовка
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
        if employer_id:
            url = f'https://api.hh.ru/vacancies?employer_id={employer_id}&per_page=50'
        else:
            url = 'https://api.hh.ru/vacancies/mine?per_page=50'
    elif resource == 'negotiations':
        vacancy_id = params.get('vacancy_id', '')
        if not vacancy_id:
            return {
                'statusCode': 400,
                'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'vacancy_id is required for negotiations'}),
            }
        # Сначала получаем список коллекций, потом забираем отклики из каждой
        collections_url = f'https://api.hh.ru/negotiations?vacancy_id={vacancy_id}&per_page=100'
        req_col = urllib.request.Request(collections_url, headers=hh_headers)
        try:
            with urllib.request.urlopen(req_col) as r:
                col_data = json.loads(r.read())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8', errors='ignore')
            return {
                'statusCode': e.code,
                'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'HH.ru error {e.code}', 'details': error_body}),
            }

        employer_states = col_data.get('employer_states', [])
        collections = col_data.get('collections', [])

        # Строим map: col_id -> url из collections объектов
        col_url_map = {c.get('id', ''): c.get('url', '') for c in collections}

        # Список всех статусов
        all_state_ids = [s.get('id', '') for s in employer_states]
        if not all_state_ids:
            all_state_ids = [c.get('id', '') for c in collections]

        all_items = []
        seen_ids = set()

        for col_id in all_state_ids:
            if not col_id:
                continue
            # Используем URL из collections если есть (уже содержит vacancy_id)
            # иначе строим сами
            col_url = col_url_map.get(col_id, '')
            if col_url:
                paged_url = col_url  # URL уже содержит vacancy_id
            else:
                paged_url = f'https://api.hh.ru/negotiations/{col_id}?vacancy_id={vacancy_id}'
            req_items = urllib.request.Request(paged_url, headers=hh_headers)
            try:
                with urllib.request.urlopen(req_items) as r:
                    items_data = json.loads(r.read())
                for item in items_data.get('items', []):
                    item_id = item.get('id')
                    if item_id not in seen_ids:
                        seen_ids.add(item_id)
                        item['_collection_id'] = col_id
                        all_items.append(item)
            except Exception:
                continue

        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'items': all_items, 'found': len(all_items)}),
        }
    elif resource == 'debug_negotiations':
        vacancy_id = params.get('vacancy_id', '')
        col_id = params.get('col_id', 'assessment')
        url = f'https://api.hh.ru/negotiations/{col_id}?vacancy_id={vacancy_id}&per_page=5'
    elif resource == 'me':
        url = 'https://api.hh.ru/me'
    elif resource == 'employer':
        # Данные работодателя
        url = 'https://api.hh.ru/me'
    else:
        return {
            'statusCode': 400,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Unknown resource: {resource}'}),
        }

    req = urllib.request.Request(url, headers=hh_headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
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