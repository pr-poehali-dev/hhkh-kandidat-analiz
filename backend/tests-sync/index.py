import json
import os
import re
import urllib.request
import urllib.parse
import urllib.error
import psycopg2
import psycopg2.extras

SCHEMA = 't_p93338434_hhkh_kandidat_analiz'

SPREADSHEETS = [
    '1qfVmuSncjhfMOfygl5vy_7zzaVt9D6W38NUm3y9WgrU',
    '1M85BpjeoyP1zDGGaO-54Uhk0LM8h2Vgf3Gf9uAX9O6U',
    '16XEWRtuQm9ZVnUC9AKI8tkk0viTqjP-K0aeeazZ_3Jg',
]


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def normalize_name(name):
    if not name:
        return ''
    return ' '.join(name.strip().lower().split())


def name_similarity(a, b):
    a_parts = set(normalize_name(a).split())
    b_parts = set(normalize_name(b).split())
    if not a_parts or not b_parts:
        return 0
    intersection = a_parts & b_parts
    return len(intersection) / max(len(a_parts), len(b_parts))


def get_google_token():
    import base64
    import time
    import hmac
    import hashlib

    sa_json = json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON'])
    private_key_pem = sa_json['private_key']
    client_email = sa_json['client_email']

    now = int(time.time())
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'RS256', 'typ': 'JWT'}).encode()).rstrip(b'=').decode()
    payload = base64.urlsafe_b64encode(json.dumps({
        'iss': client_email,
        'scope': 'https://www.googleapis.com/auth/spreadsheets.readonly',
        'aud': 'https://oauth2.googleapis.com/token',
        'exp': now + 3600,
        'iat': now,
    }).encode()).rstrip(b'=').decode()

    signing_input = f'{header}.{payload}'.encode()

    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    private_key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    signature = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b'=').decode()

    jwt_token = f'{header}.{payload}.{sig_b64}'

    data = urllib.parse.urlencode({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': jwt_token,
    }).encode()

    req = urllib.request.Request(
        'https://oauth2.googleapis.com/token',
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())['access_token']


def fetch_sheet(spreadsheet_id, token):
    url = f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/A1:ZZ1000'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
    rows = data.get('values', [])
    if len(rows) < 2:
        return [], []
    headers = rows[0]
    return headers, rows[1:]


def get_sheet_title(spreadsheet_id, token):
    url = f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}?fields=properties.title'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
    return data.get('properties', {}).get('title', '')


def find_col(headers, *keywords):
    for i, h in enumerate(headers):
        hl = h.lower()
        if any(k in hl for k in keywords):
            return i
    return -1


def sync_google_forms(conn, token):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f'SELECT id, first_name, last_name, middle_name, phone, email FROM {SCHEMA}.candidates')
    candidates = cur.fetchall()

    synced = 0
    for spreadsheet_id in SPREADSHEETS:
        try:
            title = get_sheet_title(spreadsheet_id, token)
            headers, rows = fetch_sheet(spreadsheet_id, token)
            if not rows:
                continue

            name_col = find_col(headers, 'фио', 'имя', 'name')
            email_col = find_col(headers, 'email', 'почт', 'mail')
            phone_col = find_col(headers, 'телефон', 'phone', 'номер')
            time_col = find_col(headers, 'отметка', 'timestamp', 'время', 'дата')

            for row in rows:
                def get_val(idx):
                    if idx >= 0 and idx < len(row):
                        return row[idx].strip()
                    return ''

                resp_name = get_val(name_col)
                resp_email = get_val(email_col).lower()
                resp_phone = re.sub(r'\D', '', get_val(phone_col))
                submitted_at = get_val(time_col) or None

                cur.execute(f'''
                    SELECT id FROM {SCHEMA}.form_responses
                    WHERE spreadsheet_id = %s AND respondent_name = %s AND respondent_email = %s
                    LIMIT 1
                ''', (spreadsheet_id, resp_name, resp_email))
                if cur.fetchone():
                    continue

                matched_candidate = None
                matched_by = None

                for c in candidates:
                    full_name = f"{c['last_name']} {c['first_name']} {c['middle_name'] or ''}".strip()
                    c_phone = re.sub(r'\D', '', c['email'] or '')
                    c_email = (c['email'] or '').lower()
                    c_phone_clean = re.sub(r'\D', '', '')

                    if resp_email and c_email and resp_email == c_email:
                        matched_candidate = c
                        matched_by = 'email'
                        break

                    if resp_phone and len(resp_phone) >= 10:
                        c_phone_db = re.sub(r'\D', '', c.get('phone', '') or '')
                        if c_phone_db and resp_phone[-10:] == c_phone_db[-10:]:
                            matched_candidate = c
                            matched_by = 'phone'
                            break

                    if resp_name and name_similarity(resp_name, full_name) >= 0.6:
                        matched_candidate = c
                        matched_by = 'name'

                form_data = {}
                for i, h in enumerate(headers):
                    if i < len(row):
                        form_data[h] = row[i]

                candidate_id = matched_candidate['id'] if matched_candidate else None

                app_id = None
                if candidate_id:
                    cur.execute(f'''
                        SELECT id FROM {SCHEMA}.applications
                        WHERE candidate_id = %s ORDER BY created_at DESC LIMIT 1
                    ''', (candidate_id,))
                    app_row = cur.fetchone()
                    if app_row:
                        app_id = app_row['id']

                cur.execute(f'''
                    INSERT INTO {SCHEMA}.form_responses
                    (candidate_id, application_id, spreadsheet_id, vacancy_name,
                     respondent_name, respondent_email, respondent_phone,
                     submitted_at, form_data, matched_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (
                    candidate_id, app_id, spreadsheet_id, title,
                    resp_name, resp_email, resp_phone,
                    submitted_at, json.dumps(form_data, ensure_ascii=False), matched_by
                ))
                synced += 1

        except Exception as e:
            print(f'Error syncing sheet {spreadsheet_id}: {e}')
            continue

    conn.commit()
    return synced


def psytests_login():
    login = os.environ.get('PSYTESTS_LOGIN', '')
    password = os.environ.get('PSYTESTS_PASSWORD', '')

    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())

    login_page_req = urllib.request.Request(
        'https://psytests.org/login.html',
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    opener.open(login_page_req, timeout=15)

    data = urllib.parse.urlencode({'email': login, 'pass': password}).encode()
    login_req = urllib.request.Request(
        'https://psytests.org/run/login',
        data=data,
        headers={
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://psytests.org/login.html',
        },
        method='POST'
    )
    opener.open(login_req, timeout=15)
    return opener


def fetch_psytests_data(opener, test_filter=''):
    params = urllib.parse.urlencode({'test': test_filter} if test_filter else {})
    url = f'https://psytests.org/cabdata.html?{params}' if params else 'https://psytests.org/cabdata.html'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with opener.open(req, timeout=20) as r:
        return r.read().decode('utf-8', errors='ignore')


def parse_psytests_table(html):
    results = []
    pattern = re.compile(
        r'<a[^>]+href="([^"]+)"[^>]*>([^<]+)</a>\s*'
        r'</td>\s*<td[^>]*>\s*[✓✗]?\s*([\d.,\s:]+)\s*</td>\s*'
        r'<td[^>]*>([^<]*)</td>\s*'
        r'<td[^>]*>[МЖмж]?\s*([\d\s]+)</td>',
        re.DOTALL
    )
    for m in pattern.finditer(html):
        link = m.group(1).strip()
        test_name = m.group(2).strip()
        date_str = m.group(3).strip()
        name = m.group(4).strip()
        score_raw = m.group(5).strip()
        results.append({
            'link': link if link.startswith('http') else f'https://psytests.org{link}',
            'test_name': test_name,
            'date': date_str,
            'name': name,
            'score_raw': score_raw,
        })

    if not results:
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)
        for row in rows:
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if len(cells) >= 4:
                link_match = re.search(r'href="([^"]+)"', cells[0])
                name_match = re.search(r'>([^<]+)<', cells[0]) if not link_match else None
                test_name_text = re.sub(r'<[^>]+>', '', cells[0]).strip()
                date_text = re.sub(r'<[^>]+>', '', cells[1]).strip()
                name_text = re.sub(r'<[^>]+>', '', cells[2]).strip() if len(cells) > 2 else ''
                score_text = re.sub(r'<[^>]+>', '', cells[3]).strip() if len(cells) > 3 else ''

                if not name_text or len(name_text) < 2:
                    continue

                link_href = ''
                if link_match:
                    link_href = link_match.group(1)
                    if not link_href.startswith('http'):
                        link_href = f'https://psytests.org{link_href}'

                results.append({
                    'link': link_href,
                    'test_name': test_name_text,
                    'date': date_text,
                    'name': name_text,
                    'score_raw': score_text,
                })

    return results


def detect_test_type(test_name):
    tn = test_name.lower()
    if 'кеттел' in tn or 'cattell' in tn or '16pf' in tn or 'кеттлер' in tn:
        return 'kettell'
    if 'механич' in tn or 'беннет' in tn or 'bennett' in tn:
        return 'bennett'
    return 'other'


def sync_psytests(conn, opener):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f'SELECT id, first_name, last_name, middle_name FROM {SCHEMA}.candidates')
    candidates = cur.fetchall()

    html = fetch_psytests_data(opener)
    rows = parse_psytests_table(html)

    synced = 0
    for row in rows:
        test_type = detect_test_type(row['test_name'])
        resp_name = row['name']

        cur.execute(f'''
            SELECT id FROM {SCHEMA}.test_results
            WHERE test_type = %s AND source_name = %s AND result_data->>'psytests_name' = %s
            LIMIT 1
        ''', (test_type, row['test_name'], resp_name))
        if cur.fetchone():
            continue

        matched_candidate = None
        matched_by = None
        best_score = 0

        for c in candidates:
            full_name = f"{c['last_name']} {c['first_name']} {c['middle_name'] or ''}".strip()
            score = name_similarity(resp_name, full_name)
            if score > best_score and score >= 0.5:
                best_score = score
                matched_candidate = c
                matched_by = 'name'

        candidate_id = matched_candidate['id'] if matched_candidate else None
        app_id = None
        if candidate_id:
            cur.execute(f'''
                SELECT id FROM {SCHEMA}.applications
                WHERE candidate_id = %s ORDER BY created_at DESC LIMIT 1
            ''', (candidate_id,))
            app_row = cur.fetchone()
            if app_row:
                app_id = app_row['id']

        result_data = {
            'psytests_name': resp_name,
            'psytests_link': row['link'],
            'date': row['date'],
            'score_raw': row['score_raw'],
        }

        cur.execute(f'''
            INSERT INTO {SCHEMA}.test_results
            (candidate_id, application_id, test_type, source_name,
             raw_score, result_data, matched_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (
            candidate_id, app_id, test_type, row['test_name'],
            row['score_raw'], json.dumps(result_data, ensure_ascii=False), matched_by
        ))
        synced += 1

    conn.commit()
    return synced


def get_candidate_tests(conn, candidate_id):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(f'''
        SELECT test_type, source_name, raw_score, result_data, completed_at, created_at
        FROM {SCHEMA}.test_results
        WHERE candidate_id = %s
        ORDER BY created_at DESC
    ''', (candidate_id,))
    tests = cur.fetchall()

    cur.execute(f'''
        SELECT vacancy_name, respondent_name, submitted_at, form_data, spreadsheet_id, created_at
        FROM {SCHEMA}.form_responses
        WHERE candidate_id = %s
        ORDER BY created_at DESC
    ''', (candidate_id,))
    forms = cur.fetchall()

    return {
        'tests': [dict(t) for t in tests],
        'forms': [dict(f) for f in forms],
    }


def handler(event: dict, context) -> dict:
    """Синхронизация результатов тестов кандидатов из psytests.org и Google Forms"""

    CORS = {'Access-Control-Allow-Origin': '*'}

    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                **CORS,
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            'body': ''
        }

    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'sync')

    conn = get_db()
    try:
        if action == 'get':
            candidate_id = params.get('candidate_id')
            if not candidate_id:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'candidate_id required'})}
            data = get_candidate_tests(conn, int(candidate_id))
            return {'statusCode': 200, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps(data, ensure_ascii=False, default=str)}

        if action == 'sync':
            results = {'google_forms': 0, 'psytests': 0, 'errors': []}

            try:
                token = get_google_token()
                results['google_forms'] = sync_google_forms(conn, token)
            except Exception as e:
                results['errors'].append(f'Google Forms: {str(e)}')

            try:
                opener = psytests_login()
                results['psytests'] = sync_psytests(conn, opener)
            except Exception as e:
                results['errors'].append(f'psytests: {str(e)}')

            return {
                'statusCode': 200,
                'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps(results, ensure_ascii=False)
            }

        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'unknown action'})}

    finally:
        conn.close()
