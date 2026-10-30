import sys, io, requests, pymysql
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = 'http://localhost:5000'

# Admin login
r = requests.post(f'{BASE}/api/auth/login', json={'username':'testadmin_x1','password':'Admin@123'})
token = r.json().get('token') or r.json().get('accessToken') or ''
H = {'Authorization': f'Bearer {token}'}

# Lấy bacsi2 id
conn = pymysql.connect(host='localhost', user='root', password='123456', database='dental_clinic', charset='utf8mb4')
cur = conn.cursor()
cur.execute("SELECT u.id, u.username FROM `user` u JOIN userrole ur ON u.id=ur.userId JOIN role ro ON ro.id=ur.roleId WHERE ro.name='DOCTOR' AND u.username='bacsi2' LIMIT 1")
row = cur.fetchone()
conn.close()
print(f'bacsi2: id={row[0]}')

# Reset password & login
requests.post(f'{BASE}/api/auth/users/{row[0]}/reset-password', json={'newPassword': 'Test@12345'}, headers=H)
rt = requests.post(f'{BASE}/api/auth/login', json={'username': 'bacsi2', 'password': 'Test@12345'})
dt = rt.json().get('token') or rt.json().get('accessToken') or ''
HD = {'Authorization': f'Bearer {dt}'}
print(f'bacsi2 login: HTTP {rt.status_code}')

# Test endpoint mới
resp = requests.get(f'{BASE}/api/doctor/today-receptions', headers=HD)
print(f'\nGET /api/doctor/today-receptions → HTTP {resp.status_code}')
data = resp.json()
print(f'Số bệnh nhân walk-in hôm nay: {len(data)}')
for p in data:
    print(f'  - {p["patientName"]} | code={p["code"]} | status={p["status"]} | lý do={p["visitReason"]}')
