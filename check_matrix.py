import sys, io, requests, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def login(u, p):
    r = requests.post('http://localhost:5000/api/auth/login', json={'username': u, 'password': p})
    d = r.json()
    return d.get('token') or d.get('accessToken') or (d.get('data') or {}).get('token', '')

tok = login('testadmin_x1', 'Admin@123')
A = {'Authorization': f'Bearer {tok}'}
r = requests.get('http://localhost:5000/api/salary/complexity/matrix',
                 params={'month': '2026-06'}, headers=A)
scheds = r.json().get('schedules', [])
print(f'Total schedules: {len(scheds)}')

for s in scheds:
    cases = s.get('cases', [])
    tc = s.get('totalCoeff', 0)
    pc = s.get('pendingCount', 0)
    ac = s.get('approvedCount', 0)
    if cases or tc > 0 or pc > 0 or ac > 0:
        print(f"\n  schedId={s['schedId']} totalCoeff={tc} pending={pc} approved={ac} cases={len(cases)}")
        for c in cases:
            print("    case:", json.dumps(c, ensure_ascii=False, default=str)[:250])
