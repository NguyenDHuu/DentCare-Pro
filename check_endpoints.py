import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import requests

BASE = 'http://localhost:5000'

r = requests.post(f'{BASE}/api/auth/login', json={'username':'testadmin_x1','password':'Admin@123'})
token = r.json().get('token') or r.json().get('accessToken') or ''
H = {'Authorization': f'Bearer {token}'}

# Login bác sĩ để test
rdoc = requests.post(f'{BASE}/api/auth/login', json={'username':'nguyenvanc','password':'Test@12345'})
doc_token = rdoc.json().get('token') or rdoc.json().get('accessToken') or '' if rdoc.status_code == 200 else ''
HD = {'Authorization': f'Bearer {doc_token}'} if doc_token else H

endpoints = [
    # Auth
    ('GET', '/api/auth/logs',                    H,  'Logs hệ thống'),
    ('GET', '/api/auth/users',                   H,  'Danh sách users'),
    # Services / Prices
    ('GET', '/api/services',                     H,  'Dịch vụ'),
    ('GET', '/api/prices',                       H,  'Bảng giá'),
    # Profile
    ('GET', '/api/profile/my',                   H,  'Profile admin'),
    # Shifts / Schedules / Holidays
    ('GET', '/api/shifts',                       H,  'Ca làm việc'),
    ('GET', '/api/schedules',                    H,  'Lịch làm việc'),
    ('GET', '/api/holidays',                     H,  'Ngày nghỉ lễ'),
    # SMS
    ('GET', '/api/sms',                          H,  'SMS'),
    # Staff
    ('GET', '/api/receptionist',                 H,  'Lễ tân'),
    ('GET', '/api/doctor',                       H,  'Bác sĩ'),
    # Patients / Reception
    ('GET', '/api/patients',                     H,  'Bệnh nhân'),
    ('GET', '/api/reception',                    H,  'Tiếp nhận'),
    # Treatment / Invoice
    ('GET', '/api/treatment',                    H,  'Điều trị'),
    ('GET', '/api/invoice',                      H,  'Hóa đơn'),
    # Salary
    ('GET', '/api/salary/report/monthly?month=2026-06',              H, 'BC lương tháng'),
    ('GET', '/api/salary/report/annual/personal?userId=7&year=2026', H, 'BC lương năm cá nhân'),
    ('GET', '/api/salary/report/annual/full?year=2026',              H, 'BC lương năm toàn bộ'),
    ('GET', '/api/salary/payslip/staff-list',                        H, 'Danh sách nhân viên lập lương'),
    ('GET', '/api/salary/fixed-salaries',                            H, 'Lương cố định'),
    ('GET', '/api/salary/hourly-rates',                              H, 'Đơn giá giờ'),
    ('GET', '/api/salary/shift-coefficients',                        H, 'Hệ số ca'),
    ('GET', '/api/salary/complexity/matrix',                         H, 'Ma trận phức tạp'),
    ('GET', '/api/salary/allowances',                                H, 'Phụ cấp'),
    ('GET', '/api/salary/report/staff',                              H, 'Danh sách staff báo cáo'),
    # Staff portal (doctor)
    ('GET', '/api/salary/complexity/my-cases',                       HD, 'Ca phức tạp bác sĩ'),
    ('GET', '/api/profile/my',                                       HD, 'Profile bác sĩ'),
    # Health
    ('GET', '/health',                           H,  'Health check'),
]

print(f"Admin login: HTTP {r.status_code} | Doctor login: HTTP {rdoc.status_code}\n")
print(f"{'STATUS':<8} {'CODE':<6} {'MÔ TẢ':<35} PATH")
print('-' * 100)
errors = []
for method, path, headers, desc in endpoints:
    try:
        res = requests.get(f'{BASE}{path}', headers=headers, timeout=5)
        status = res.status_code
        flag = 'OK' if status < 400 else ('500' if status >= 500 else f'{status}')
        try:
            body = res.json()
            msg = body.get('message', '') if status != 200 else f'({len(str(body))} chars)'
        except Exception:
            msg = res.text[:50]
        print(f'  [{flag:<4}] {status:<6} {desc:<35} {path}' + (f'  → {msg}' if msg else ''))
        if status >= 500:
            errors.append((path, desc, status, msg))
    except Exception as e:
        print(f'  [FAIL] {"ERR":<6} {desc:<35} {path}: {e}')

print()
if errors:
    print(f'⚠️  {len(errors)} endpoint bị lỗi 5xx:')
    for path, desc, status, msg in errors:
        print(f'  HTTP {status}: {desc} → {path}')
        print(f'  Message: {msg}')
else:
    print('✓ Tất cả endpoints đều OK (không có lỗi 5xx)')
