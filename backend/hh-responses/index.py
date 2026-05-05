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
        # Вакансии работодателя — используем employer_id из параметров или общий список
        employer_id = params.get('employer_id', '')
        manager_id = params.get('manager_id', '')
        url = 'https://api.hh.ru/vacancies/mine?per_page=50&status=published'
        if employer_id:
            url += f'&employer_id={employer_id}'
        if manager_id:
            url += f'&manager_id={manager_id}'
    elif resource == 'negotiations':
        vacancy_id = params.get('vacancy_id', '')
        if not vacancy_id:
            return {
                'statusCode': 400,
                'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'vacancy_id is required for negotiations'}),
            }
        # Правильный эндпоинт для работодателя
        url = f'https://api.hh.ru/negotiations?vacancy_id={vacancy_id}&per_page=50'
    elif resource == 'negotiations_all':
        # Список всех откликов без фильтра по вакансии
        url = 'https://api.hh.ru/negotiations?per_page=50'
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