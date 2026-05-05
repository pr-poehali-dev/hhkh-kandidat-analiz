import json
import os
import urllib.request


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
        url = 'https://api.hh.ru/vacancies/mine?per_page=50'
    elif resource == 'negotiations':
        vacancy_id = params.get('vacancy_id', '')
        url = f'https://api.hh.ru/negotiations?per_page=50&status=active'
        if vacancy_id:
            url += f'&vacancy_id={vacancy_id}'
    elif resource == 'me':
        url = 'https://api.hh.ru/me'
    else:
        return {
            'statusCode': 400,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Unknown resource: {resource}'}),
        }

    req = urllib.request.Request(url, headers=hh_headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps(data),
    }