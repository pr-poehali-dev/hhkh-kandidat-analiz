import json
import os
import urllib.request
import urllib.parse


def handler(event: dict, context) -> dict:
    """OAuth авторизация через HH.ru — обмен кода на access_token"""

    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    CORS = {'Access-Control-Allow-Origin': '*'}

    method = event.get('httpMethod', 'GET')

    # GET /hh-auth — возвращаем URL для редиректа на HH.ru
    if method == 'GET':
        client_id = os.environ['HH_CLIENT_ID']
        redirect_uri = event.get('queryStringParameters', {}).get('redirect_uri', 'https://localhost')
        auth_url = (
            f'https://hh.ru/oauth/authorize'
            f'?response_type=code'
            f'&client_id={client_id}'
            f'&redirect_uri={urllib.parse.quote(redirect_uri)}'
        )
        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({'auth_url': auth_url}),
        }

    # POST /hh-auth — обмениваем code на токен
    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        code = body.get('code')
        redirect_uri = body.get('redirect_uri', 'https://localhost')

        if not code:
            return {
                'statusCode': 400,
                'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'code is required'}),
            }

        client_id = os.environ['HH_CLIENT_ID']
        client_secret = os.environ['HH_CLIENT_SECRET']

        data = urllib.parse.urlencode({
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': redirect_uri,
        }).encode()

        req = urllib.request.Request(
            'https://hh.ru/oauth/token',
            data=data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            method='POST',
        )

        with urllib.request.urlopen(req) as resp:
            token_data = json.loads(resp.read())

        return {
            'statusCode': 200,
            'headers': {**CORS, 'Content-Type': 'application/json'},
            'body': json.dumps({
                'access_token': token_data.get('access_token'),
                'refresh_token': token_data.get('refresh_token'),
                'expires_in': token_data.get('expires_in'),
            }),
        }

    return {
        'statusCode': 405,
        'headers': {**CORS},
        'body': json.dumps({'error': 'Method not allowed'}),
    }
