import base64
import csv
import io
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

    # Сначала получаем главную страницу для cookies
    for start_url in ['https://psytests.org/', 'https://psytests.org/index.html']:
        try:
            opener.open(urllib.request.Request(start_url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=10)
            break
        except Exception:
            continue

    # Пробуем разные endpoints для логина
    login_endpoints = [
        'https://psytests.org/run/login',
        'https://psytests.org/api/login',
        'https://psytests.org/login',
    ]
    data = urllib.parse.urlencode({'email': login, 'pass': password, 'password': password}).encode()

    for endpoint in login_endpoints:
        try:
            login_req = urllib.request.Request(
                endpoint,
                data=data,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://psytests.org/',
                    'Accept': 'text/html,application/json,*/*',
                },
                method='POST'
            )
            resp = opener.open(login_req, timeout=15)
            print(f'Login endpoint {endpoint} status: {resp.status}')
            break
        except urllib.error.HTTPError as e:
            print(f'Login endpoint {endpoint} error: {e.code}')
            continue
        except Exception as e:
            print(f'Login endpoint {endpoint} exception: {e}')
            continue

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
    # Проверяем и latin и кириллицу (после декодирования)
    if any(x in tn for x in ['кеттел', 'cattell', '16pf', 'кеттлер', 'ctla', 'ctl']):
        return 'kettell'
    if any(x in tn for x in ['механич', 'беннет', 'bennett', 'понятлив', 'mec']):
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


KETTELL_FACTORS = ['A','B','C','E','F','G','H','I','L','M','N','O','Q1','Q2','Q3','Q4','F1','F2','F3','F4','MD','FB']
BENNETT_FACTORS = ['score']


def parse_psytests_csv(raw_bytes):
    """Парсит CSV файл с psytests.org"""
    text = None
    used_enc = None
    for encoding in ('windows-1251', 'utf-8-sig', 'utf-8', 'latin-1'):
        try:
            text = raw_bytes.decode(encoding)
            used_enc = encoding
            break
        except Exception:
            continue
    if not text:
        print(f'PARSE_FAIL: could not decode {len(raw_bytes)} bytes')
        return []

    print(f'PARSE: decoded {len(raw_bytes)} bytes as {used_enc}, first 300 chars: {repr(text[:300])}')

    # Определяем разделитель
    first_line = text.split('\n')[0]
    delimiter = ';' if first_line.count(';') > first_line.count(',') else ','
    print(f'PARSE: delimiter={repr(delimiter)}, first_line={repr(first_line[:150])}')

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    results = []
    for row in reader:
        print(f'ROW len={len(row)}: {[r[:30] for r in row[:4]]}')
        if len(row) < 4:
            continue
        test_name = row[0].strip()
        date_str = row[1].strip()
        name = row[2].strip()
        link = row[3].strip()

        test_type = detect_test_type(test_name)

        # Определяем факторы в зависимости от типа теста
        score_start = 5  # после: название, дата, имя, ссылка, ответы
        if len(row) > score_start + 1:
            gender = row[score_start].strip() if len(row) > score_start else ''
            factor_values = row[score_start + 1:] if test_type == 'kettell' else row[score_start:]
        else:
            gender = ''
            factor_values = []

        factors = {}
        if test_type == 'kettell':
            for i, f in enumerate(KETTELL_FACTORS):
                factors[f] = factor_values[i].strip() if i < len(factor_values) else ''
        elif test_type == 'bennett':
            factors['score'] = factor_values[0].strip() if factor_values else ''

        raw_score = factors.get('score', '') or (factors.get('B', '') if test_type == 'kettell' else '')

        results.append({
            'test_name': test_name,
            'test_type': test_type,
            'date': date_str,
            'name': name,
            'link': link,
            'gender': gender,
            'factors': factors,
            'raw_score': raw_score,
        })
    return results


def import_psytests_csv(conn, rows):
    """Сохраняет распарсенные строки CSV в БД"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f'SELECT id, first_name, last_name, middle_name FROM {SCHEMA}.candidates')
    candidates = cur.fetchall()

    imported = 0
    skipped = 0
    for row in rows:
        # Дедупликация по имени + тесту + дате
        cur.execute(f'''
            SELECT id FROM {SCHEMA}.test_results
            WHERE test_type = %s AND result_data->>'psytests_name' = %s AND result_data->>'date' = %s
            LIMIT 1
        ''', (row['test_type'], row['name'], row['date']))
        if cur.fetchone():
            skipped += 1
            continue

        # Матчинг кандидата по ФИО
        matched_candidate = None
        best_score = 0
        for c in candidates:
            full_name = f"{c['last_name']} {c['first_name']} {c['middle_name'] or ''}".strip()
            score = name_similarity(row['name'], full_name)
            if score > best_score and score >= 0.5:
                best_score = score
                matched_candidate = c

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
            'psytests_name': row['name'],
            'psytests_link': row['link'],
            'date': row['date'],
            'gender': row['gender'],
            'factors': row['factors'],
            'score_raw': row['raw_score'],
        }

        cur.execute(f'''
            INSERT INTO {SCHEMA}.test_results
            (candidate_id, application_id, test_type, source_name, raw_score, result_data, matched_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (
            candidate_id, app_id, row['test_type'], row['test_name'],
            row['raw_score'], json.dumps(result_data, ensure_ascii=False),
            'name' if matched_candidate else None
        ))
        imported += 1

    conn.commit()
    return imported, skipped


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

        if action == 'upload_csv':
            body_raw = event.get('body') or ''
            try:
                first_decode = base64.b64decode(body_raw)
                # Проверяем — если результат снова выглядит как base64 (только ASCII), декодируем ещё раз
                try:
                    first_str = first_decode.decode('ascii')
                    if all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r' for c in first_str.strip()):
                        csv_bytes = base64.b64decode(first_str.strip())
                    else:
                        csv_bytes = first_decode
                except Exception:
                    csv_bytes = first_decode
            except Exception:
                csv_bytes = body_raw.encode('utf-8')

            # Диагностика
            debug_info = {
                'body_len': len(body_raw),
                'is_base64': event.get('isBase64Encoded'),
                'bytes_len': len(csv_bytes),
                'bytes_start': repr(csv_bytes[:100]),
            }
            rows = parse_psytests_csv(csv_bytes)
            if not rows:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Не удалось распарсить CSV. Проверь формат файла.', 'debug': debug_info})}

            imported, skipped = import_psytests_csv(conn, rows)
            return {
                'statusCode': 200,
                'headers': {**CORS, 'Content-Type': 'application/json'},
                'body': json.dumps({'ok': True, 'imported': imported, 'skipped': skipped, 'total': len(rows)}, ensure_ascii=False)
            }

        if action == 'debug_eurl':
            try:
                opener = psytests_login()
                # Сначала инициализируем сессию через eurl
                for t in ['cabdata', 'cab']:
                    try:
                        req = urllib.request.Request(f'https://psytests.org/eurl?p=psy&t={t}&u=1400', headers={'User-Agent': 'Mozilla/5.0'})
                        opener.open(req, timeout=5)
                    except Exception:
                        pass

                results = {}
                # Пробуем загрузить данные после инициализации
                for url in [
                    'https://psytests.org/cabdata.html',
                    'https://psytests.org/cabdata.html?fmt=json',
                    'https://psytests.org/cabdata.html?out=json',
                    'https://psytests.org/cabdata.html?format=json',
                    'https://psytests.org/cab.html',
                ]:
                    try:
                        req = urllib.request.Request(url, headers={
                            'User-Agent': 'Mozilla/5.0',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json, */*',
                        })
                        with opener.open(req, timeout=10) as r:
                            body = r.read().decode('windows-1251', errors='replace')
                            # Ищем таблицы с данными
                            has_table = '<table' in body
                            has_tr = '<tr' in body
                            td_count = body.count('<td')
                            results[url] = {'len': len(body), 'has_table': has_table, 'has_tr': has_tr, 'td_count': td_count, 'snippet': body[body.find('<table'):body.find('<table')+800] if has_table else body[:300]}
                    except urllib.error.HTTPError as e:
                        results[url] = {'error': e.code}
                    except Exception as e:
                        results[url] = {'error': str(e)[:100]}
                return {
                    'statusCode': 200,
                    'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps(results, ensure_ascii=False)
                }
            except Exception as e:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'error': str(e)})}

        if action == 'debug_js2':
            try:
                opener = psytests_login()
                req = urllib.request.Request('https://psytests.org/psy135.js', headers={'User-Agent': 'Mozilla/5.0'})
                with opener.open(req, timeout=15) as r:
                    body = r.read().decode('windows-1251', errors='replace')
                # Ищем всё вокруг cabdata
                idx = body.find('cabdata')
                snippets = []
                while idx != -1 and len(snippets) < 20:
                    snippets.append(body[max(0,idx-100):idx+200])
                    idx = body.find('cabdata', idx+1)
                # Также ищем все XHR open вызовы с контекстом
                xhr_pattern = re.findall(r'.{0,50}\.open\(.{0,100}', body)
                return {
                    'statusCode': 200,
                    'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps({'cabdata_contexts': snippets, 'xhr_calls': xhr_pattern[:30]}, ensure_ascii=False)
                }
            except Exception as e:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'error': str(e)})}

        if action == 'debug_data':
            try:
                opener = psytests_login()
                # /user возвращает user_id=1400, пробуем эндпоинты с ним
                user_id = '1400'
                results = {}
                for url, method, data in [
                    (f'https://psytests.org/eurl?p=psy&t=cabdata&u={user_id}', 'GET', None),
                    (f'https://psytests.org/eurl?p=psy&t=cab&u={user_id}', 'GET', None),
                    ('https://psytests.org/eurl?p=psy&t=cabdata', 'GET', None),
                    (f'https://psytests.org/cabdata.html?u={user_id}', 'GET', None),
                    ('https://psytests.org/cabjson', 'GET', None),
                    ('https://psytests.org/cabget', 'GET', None),
                    ('https://psytests.org/run/user', 'POST', b'vpage=use&vpath=cabdata'),
                    (f'https://psytests.org/run/user?uid={user_id}&page=cabdata', 'GET', None),
                ]:
                    try:
                        req = urllib.request.Request(url, data=data, headers={
                            'User-Agent': 'Mozilla/5.0',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': 'https://psytests.org/cabdata.html',
                        }, method=method)
                        with opener.open(req, timeout=10) as r:
                            body = r.read().decode('windows-1251', errors='replace')
                            results[f'{method} {url}'] = {'status': r.status, 'len': len(body), 'snippet': body[:400]}
                    except urllib.error.HTTPError as e:
                        results[f'{method} {url}'] = {'error': e.code}
                    except Exception as e:
                        results[f'{method} {url}'] = {'error': str(e)[:100]}
                return {
                    'statusCode': 200,
                    'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps(results, ensure_ascii=False)
                }
            except Exception as e:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'error': str(e)})}

        if action == 'debug_user':
            try:
                opener = psytests_login()
                results = {}
                for url, method, data in [
                    ('https://psytests.org/user', 'GET', None),
                    ('https://psytests.org/user?page=cabdata', 'GET', None),
                    ('https://psytests.org/user?p=cabdata', 'GET', None),
                    ('https://psytests.org/user', 'POST', b'page=cabdata&vpage=use'),
                    ('https://psytests.org/user', 'POST', b'vpage=use'),
                    ('https://psytests.org/user', 'POST', b'action=cabdata'),
                ]:
                    try:
                        req = urllib.request.Request(url, data=data, headers={
                            'User-Agent': 'Mozilla/5.0',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json, text/html, */*',
                            'Referer': 'https://psytests.org/cabdata.html',
                        }, method=method)
                        with opener.open(req, timeout=10) as r:
                            body = r.read().decode('windows-1251', errors='replace')
                            results[f'{method} {url}'] = {'status': r.status, 'len': len(body), 'snippet': body[:300]}
                    except urllib.error.HTTPError as e:
                        results[f'{method} {url}'] = {'error': e.code, 'body': e.read().decode('utf-8', errors='replace')[:200]}
                    except Exception as e:
                        results[f'{method} {url}'] = {'error': str(e)}
                return {
                    'statusCode': 200,
                    'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps(results, ensure_ascii=False)
                }
            except Exception as e:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'error': str(e)})}

        if action == 'debug_js':
            try:
                opener = psytests_login()
                req = urllib.request.Request('https://psytests.org/psy135.js', headers={'User-Agent': 'Mozilla/5.0'})
                with opener.open(req, timeout=15) as r:
                    body = r.read().decode('windows-1251', errors='replace')
                fetch_calls = re.findall(r'fetch\(["\`]([^"\'`]+)["\`]', body)
                xhr_open = re.findall(r'\.open\(["\'][A-Z]+["\'],\s*["\']([^"\']+)["\']', body)
                run_urls = re.findall(r'["\'/](run/[^"\'<>\s]+)["\']', body)
                ajax_urls = re.findall(r'url\s*[:=]\s*["\']([^"\']+)["\']', body)
                return {
                    'statusCode': 200,
                    'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps({
                        'js_len': len(body),
                        'fetch_calls': fetch_calls[:30],
                        'xhr_open': xhr_open[:30],
                        'run_urls': run_urls[:30],
                        'ajax_urls': ajax_urls[:30],
                        'cab_snippet': body[body.find('cab'):body.find('cab')+500] if 'cab' in body else 'not found',
                        'data_snippet': body[body.find('data'):body.find('data')+500] if 'data' in body else 'not found',
                    }, ensure_ascii=False)
                }
            except Exception as e:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'error': str(e)})}

        if action == 'debug_psytests':
            try:
                opener = psytests_login()
                # Получаем полный HTML cabdata и ищем все fetch/XHR вызовы
                req = urllib.request.Request('https://psytests.org/cabdata.html', headers={
                    'User-Agent': 'Mozilla/5.0',
                })
                with opener.open(req, timeout=15) as r:
                    body = r.read().decode('windows-1251', errors='replace')

                # Ищем все URL в JS
                urls_in_js = re.findall(r'["\']([/][a-zA-Z0-9/_\-\.?=&]+)["\']', body)
                fetch_calls = re.findall(r'fetch\(["\']([^"\']+)["\']', body)
                xhr_calls = re.findall(r'\.open\(["\'][A-Z]+["\'],\s*["\']([^"\']+)["\']', body)
                run_urls = [u for u in urls_in_js if '/run/' in u or '/api/' in u or 'data' in u.lower()]

                # Также пробуем прямой запрос к /run/ с параметрами
                api_results = {}
                for test_url in [
                    'https://psytests.org/run/cabget',
                    'https://psytests.org/run/cabjson',
                    'https://psytests.org/run/cablist',
                    'https://psytests.org/run/cab',
                ]:
                    try:
                        req2 = urllib.request.Request(test_url, headers={'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest'})
                        with opener.open(req2, timeout=5) as r2:
                            t = r2.read().decode('utf-8', errors='replace')
                            api_results[test_url] = t[:200]
                    except urllib.error.HTTPError as e:
                        api_results[test_url] = f'HTTP {e.code}'
                    except Exception as e:
                        api_results[test_url] = str(e)

                return {
                    'statusCode': 200,
                    'headers': {**CORS, 'Content-Type': 'application/json'},
                    'body': json.dumps({
                        'html_len': len(body),
                        'full_html': body,
                        'urls_in_js': urls_in_js[:50],
                        'fetch_calls': fetch_calls,
                        'xhr_calls': xhr_calls,
                        'run_urls': run_urls,
                        'api_results': api_results,
                    }, ensure_ascii=False)
                }
            except Exception as e:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'error': str(e)})}

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