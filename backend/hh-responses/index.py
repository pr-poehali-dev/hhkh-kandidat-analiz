import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed


def fetch_json(url, hh_headers):
    req = urllib.request.Request(url, headers=hh_headers)
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read())


def fetch_collection(col_id, vacancy_id, hh_headers):
    """Загружает все страницы одной коллекции"""
    items = []
    page = 0
    while True:
        url = f'https://api.hh.ru/negotiations/{col_id}?vacancy_id={vacancy_id}&per_page=50&page={page}'
        try:
            data = fetch_json(url, hh_headers)
        except Exception:
            break
        for item in data.get('items', []):
            item['_collection_id'] = col_id
            items.append(item)
        pages = data.get('pages', 1)
        page += 1
        if page >= pages:
            break
    return items


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

    elif resource == 'negotiations':
        vacancy_id = params.get('vacancy_id', '')
        if not vacancy_id:
            return {
                'statusCode': 400,
                'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'vacancy_id is required'}),
            }

        # Получаем список статусов
        try:
            col_data = fetch_json(
                f'https://api.hh.ru/negotiations?vacancy_id={vacancy_id}&per_page=1',
                hh_headers
            )
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8', errors='ignore')
            return {
                'statusCode': e.code,
                'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'HH.ru error {e.code}', 'details': error_body}),
            }

        employer_states = col_data.get('employer_states', [])
        state_ids = [s['id'] for s in employer_states if s.get('id')]

        # Загружаем все коллекции параллельно
        all_items = []
        seen_ids = set()

        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {
                executor.submit(fetch_collection, col_id, vacancy_id, hh_headers): col_id
                for col_id in state_ids
            }
            for future in as_completed(futures):
                try:
                    items = future.result()
                    for item in items:
                        item_id = item.get('id')
                        if item_id and item_id not in seen_ids:
                            seen_ids.add(item_id)
                            all_items.append(item)
                except Exception:
                    pass

        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'items': all_items, 'found': len(all_items)}),
        }

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
