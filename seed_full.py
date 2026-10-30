"""
seed_full.py – Seed dữ liệu đầy đủ cho hệ thống dental-clinic
Chạy: python seed_full.py
"""
import sys, io, random, datetime, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pymysql
conn = pymysql.connect(
    host='localhost', user='root', password='123456',
    database='dental_clinic', charset='utf8mb4',
    autocommit=False
)
cur = conn.cursor()

print("=== SEED BẮT ĐẦU ===\n")

# ─── Hằng số ─────────────────────────────────────────────────────────────────
ADMIN_ID       = 1   # Nhung Vu Hong (ADMIN)
DOCTORS        = [7, 8, 14, 16]   # nguyenvanc, nguyenvand, bacsi2, hongnhung
RECEPTIONISTS  = [12, 15]          # admin5, letan1
ACCOUNTANTS    = [2, 11, 17]       # admin1, nhung, ketoan1
SHIFT_AM       = 1  # Ca sáng
SHIFT_PM       = 2  # Ca chiều
SHIFT_EVE      = 3  # Ca tối

TODAY    = datetime.date.today()
NOW      = datetime.datetime.now()

def dt(y,m,d,h=0,mi=0): return datetime.datetime(y,m,d,h,mi,0)
def rand_dob(): return dt(random.randint(1960,2005), random.randint(1,12), random.randint(1,28))
def rand_past(days_ago_max=180, days_ago_min=1):
    delta = random.randint(days_ago_min, days_ago_max)
    return NOW - datetime.timedelta(days=delta)
def rand_past_date(days_ago_max=180, days_ago_min=1):
    return (TODAY - datetime.timedelta(days=random.randint(days_ago_min, days_ago_max)))
def rand_future(days_max=60, days_min=1):
    delta = random.randint(days_min, days_max)
    return NOW + datetime.timedelta(days=delta)

# ─── 1. SERVICE GROUPS ───────────────────────────────────────────────────────
print("[1] Service groups...")
SERVICE_GROUPS = [
    (1, 'Nha khoa tổng quát'),   # đã có
    (None, 'Nha thẩm mỹ'),
    (None, 'Chỉnh nha - Niềng răng'),
    (None, 'Implant & Phẫu thuật'),
    (None, 'Nha khoa trẻ em'),
    (None, 'Nha chu - Bệnh nướu'),
]
sg_ids = {}
cur.execute("SELECT id, name FROM servicegroup")
for r in cur.fetchall():
    sg_ids[r[1]] = r[0]

for _, name in SERVICE_GROUPS:
    if name not in sg_ids:
        cur.execute("INSERT INTO servicegroup (name, description, createdAt, updatedAt) VALUES (%s,%s,NOW(),NOW())",
                    (name, f'Nhóm dịch vụ {name}'))
        sg_ids[name] = cur.lastrowid
        print(f"  + ServiceGroup: {name} (id={sg_ids[name]})")
# Ensure 'Nha khoa tổng quát' id
cur.execute("SELECT id FROM servicegroup WHERE name='Nha khoa tổng quát'")
sg_ids['Nha khoa tổng quát'] = cur.fetchone()[0]
conn.commit()
print(f"  Service groups: {sg_ids}")

# ─── 2. SERVICES + PRICES ─────────────────────────────────────────────────────
print("\n[2] Services + prices...")
SERVICES_DEF = [
    # (group_name, code, name, duration, base_price)
    ('Nha khoa tổng quát', 'DV001', 'Khám răng tổng quát',        30,   200000),
    ('Nha khoa tổng quát', 'DV002', 'Nhổ răng thường',            45,   300000),  # đã có
    ('Nha khoa tổng quát', 'DV003', 'Nhổ răng khôn',              90,   800000),
    ('Nha khoa tổng quát', 'DV004', 'Trám răng Composite',        45,   500000),
    ('Nha khoa tổng quát', 'DV005', 'Lấy tủy răng',              120,  1200000),
    ('Nha khoa tổng quát', 'DV006', 'Cạo vôi răng siêu âm',       60,   400000),
    ('Nha khoa tổng quát', 'DV007', 'Điều trị viêm nướu',         60,   600000),

    ('Nha thẩm mỹ',        'DV010', 'Tẩy trắng răng tại phòng khám', 90, 2500000),
    ('Nha thẩm mỹ',        'DV011', 'Dán sứ Veneer',             120,  5000000),
    ('Nha thẩm mỹ',        'DV012', 'Bọc răng sứ toàn phần',     120,  4500000),
    ('Nha thẩm mỹ',        'DV013', 'Phục hình tháo lắp nhựa',   180,  3500000),
    ('Nha thẩm mỹ',        'DV014', 'Cầu răng sứ 3 đơn vị',      180,  9000000),

    ('Chỉnh nha - Niềng răng', 'DV020', 'Niềng răng mắc cài kim loại', 60, 25000000),
    ('Chỉnh nha - Niềng răng', 'DV021', 'Niềng răng mắc cài sứ',       60, 32000000),
    ('Chỉnh nha - Niềng răng', 'DV022', 'Niềng răng trong suốt Invisalign', 60, 55000000),
    ('Chỉnh nha - Niềng răng', 'DV023', 'Tháo niềng răng & hàm duy trì', 60, 2000000),

    ('Implant & Phẫu thuật',  'DV030', 'Cấy ghép Implant 1 răng',     180, 20000000),
    ('Implant & Phẫu thuật',  'DV031', 'Ghép xương mô răng',           120, 12000000),
    ('Implant & Phẫu thuật',  'DV032', 'Phẫu thuật nướu',               90,  3500000),
    ('Implant & Phẫu thuật',  'DV033', 'Cắt lợi trùm răng khôn',        60,  1500000),

    ('Nha khoa trẻ em',       'DV040', 'Khám răng trẻ em',              30,   150000),
    ('Nha khoa trẻ em',       'DV041', 'Trám bít hố rãnh phòng ngừa',   45,   350000),
    ('Nha khoa trẻ em',       'DV042', 'Nhổ răng sữa',                  30,   200000),
    ('Nha khoa trẻ em',       'DV043', 'Fluoride phòng ngừa sâu răng',  30,   200000),

    ('Nha chu - Bệnh nướu',   'DV050', 'Điều trị nha chu giai đoạn 1',  90,  1500000),
    ('Nha chu - Bệnh nướu',   'DV051', 'Cạo vôi dưới nướu',             90,  1200000),
    ('Nha chu - Bệnh nướu',   'DV052', 'Phẫu thuật nha chu',           120,  5000000),
]

svc_ids = {}
cur.execute("SELECT id, code FROM service")
for r in cur.fetchall():
    svc_ids[r[1]] = r[0]

for (grp, code, name, dur, price) in SERVICES_DEF:
    grp_id = sg_ids[grp]
    if code not in svc_ids:
        cur.execute("""INSERT INTO service (code,name,duration,serviceGroupId,status,usageCount,createdAt,updatedAt)
                       VALUES (%s,%s,%s,%s,'ACTIVE',0,NOW(),NOW())""",
                    (code, name, dur, grp_id))
        svc_ids[code] = cur.lastrowid
        # add price
        cur.execute("""INSERT INTO serviceprice (serviceId,basePrice,discountPct,startDate,createdBy,createdAt,updatedAt)
                       VALUES (%s,%s,0,'2025-01-01',%s,NOW(),NOW())""",
                    (svc_ids[code], price, ADMIN_ID))
        print(f"  + Service: {code} – {name}")
    else:
        print(f"  ~ skip {code} (exists)")

# Activate DV002 if inactive
cur.execute("UPDATE service SET status='ACTIVE' WHERE code='DV002'")
conn.commit()

# Refresh price table for DV002 if missing
cur.execute("SELECT id FROM serviceprice WHERE serviceId=%s", (svc_ids['DV002'],))
if not cur.fetchone():
    cur.execute("""INSERT INTO serviceprice (serviceId,basePrice,discountPct,startDate,createdBy,createdAt,updatedAt)
                   VALUES (%s,300000,0,'2025-01-01',%s,NOW(),NOW())""", (svc_ids['DV002'], ADMIN_ID))

conn.commit()
print(f"  Total services: {len(svc_ids)}")

# ─── 3. SERVICE GROUP → DOCTOR ASSIGNMENTS ────────────────────────────────────
print("\n[3] Gán bác sĩ vào service groups...")
doctor_sg = [
    # (doctor_id, group_name)
    (7,  'Nha khoa tổng quát'),
    (7,  'Nha thẩm mỹ'),
    (8,  'Nha khoa tổng quát'),
    (8,  'Nha chu - Bệnh nướu'),
    (14, 'Nha khoa tổng quát'),
    (14, 'Chỉnh nha - Niềng răng'),
    (16, 'Implant & Phẫu thuật'),
    (16, 'Nha khoa tổng quát'),
    (4,  'Nha khoa trẻ em'),
    (4,  'Nha khoa tổng quát'),
]
for (did, gname) in doctor_sg:
    gid = sg_ids[gname]
    cur.execute("SELECT id FROM servicegroupdoctor WHERE serviceGroupId=%s AND doctorId=%s", (gid, did))
    if not cur.fetchone():
        cur.execute("INSERT INTO servicegroupdoctor (serviceGroupId, doctorId) VALUES (%s,%s)", (gid, did))
        print(f"  + Doctor {did} → {gname}")
conn.commit()

# ─── 4. DENTAL CHAIRS ─────────────────────────────────────────────────────────
print("\n[4] Dental chairs...")
for i in range(4, 8):
    cur.execute("SELECT id FROM dental_chair WHERE number=%s", (i,))
    if not cur.fetchone():
        cur.execute("INSERT INTO dental_chair (name, number, isActive) VALUES (%s,%s,1)", (f'Ghế {i:02d}', i))
        print(f"  + Ghế {i:02d}")
conn.commit()
cur.execute("SELECT id, number FROM dental_chair WHERE isActive=1 ORDER BY number")
chair_ids = [r[0] for r in cur.fetchall()]
print(f"  Chairs: {chair_ids}")

# ─── 5. DOCTOR PROFILES ───────────────────────────────────────────────────────
print("\n[5] Doctor profiles...")
doctor_info = {
    7:  ('0901234567', 'MALE',   '1980-03-15', 'BS-001234', 'Tiến sĩ', 15, 8000000, 'Nha khoa tổng quát'),
    8:  ('0912345678', 'FEMALE', '1985-07-22', 'BS-001235', 'Thạc sĩ', 10, 7000000, 'Nha chu'),
    14: ('0923456789', 'MALE',   '1990-11-08', 'BS-001236', 'Bác sĩ',   5, 6000000, 'Chỉnh nha'),
    16: ('0934567890', 'FEMALE', '1983-05-30', 'BS-001237', 'Tiến sĩ', 12, 9000000, 'Implant'),
    4:  ('0945678901', 'MALE',   '1978-01-20', 'BS-001238', 'Bác sĩ',  18, 7500000, 'Nha khoa trẻ em'),
}
for did, (phone, gender, dob, lic, deg, yoe, sal, spec) in doctor_info.items():
    cur.execute("SELECT id FROM doctorprofile WHERE userId=%s", (did,))
    if cur.fetchone():
        cur.execute("""UPDATE doctorprofile SET phone=%s,gender=%s,dateOfBirth=%s,
                       licenseNumber=%s,degree=%s,yearsOfExperience=%s,
                       baseSalary=%s,salaryType='HOURLY',specialization=%s,
                       employmentStatus='FULL_TIME',position='Bác sĩ',
                       isAvailableOnline=1,updatedAt=NOW()
                       WHERE userId=%s""",
                    (phone,gender,dob,lic,deg,yoe,sal,spec,did))
    else:
        cur.execute("""INSERT INTO doctorprofile (userId,phone,gender,dateOfBirth,
                       licenseNumber,degree,yearsOfExperience,baseSalary,salaryType,
                       specialization,employmentStatus,position,isAvailableOnline,
                       createdAt,updatedAt)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'HOURLY',%s,'FULL_TIME','Bác sĩ',1,NOW(),NOW())""",
                    (did,phone,gender,dob,lic,deg,yoe,sal,spec))
    print(f"  ✓ Doctor profile uid={did}")
conn.commit()

# ─── 6. RECEPTIONIST PROFILES ─────────────────────────────────────────────────
print("\n[6] Receptionist profiles...")
rec_info = {
    12: ('0956789012','FEMALE','1995-04-12'),
    15: ('0967890123','FEMALE','1998-09-25'),
}
for uid, (phone, gender, dob) in rec_info.items():
    cur.execute("SELECT id FROM receptionistprofile WHERE userId=%s", (uid,))
    if cur.fetchone():
        cur.execute("UPDATE receptionistprofile SET phone=%s,gender=%s,dateOfBirth=%s,updatedAt=NOW() WHERE userId=%s",
                    (phone,gender,dob,uid))
    else:
        cur.execute("""INSERT INTO receptionistprofile (userId,phone,gender,dateOfBirth,createdAt,updatedAt)
                       VALUES (%s,%s,%s,%s,NOW(),NOW())""",(uid,phone,gender,dob))
    print(f"  ✓ Receptionist profile uid={uid}")
conn.commit()

# ─── 7. SALARY CONFIG (hourly rates, fixed salaries, allowances) ──────────────
print("\n[7] Salary config...")
# Ensure current hourly rate
cur.execute("SELECT id FROM hourlyrate WHERE startDate='2026-01-01' AND endDate IS NULL")
if not cur.fetchone():
    cur.execute("""INSERT INTO hourlyrate (amount,startDate,createdBy,createdAt,updatedAt)
                   VALUES (350000,'2026-01-01',%s,NOW(),NOW())""", (ADMIN_ID,))
    print("  + Hourly rate 350,000đ/h from 2026-01-01")

# Fixed salaries for receptionist & accountant (if not already set for current period)
fixed_sal = {
    12: 8000000,  # admin5 (receptionist)
    15: 7500000,  # letan1 (receptionist)
    2:  9000000,  # admin1 (accountant)
    11: 8500000,  # nhung (accountant)
    17: 8000000,  # ketoan1 (accountant)
}
for uid, amt in fixed_sal.items():
    cur.execute("SELECT id FROM fixedsalary WHERE userId=%s AND startDate='2026-01-01'", (uid,))
    if not cur.fetchone():
        cur.execute("""INSERT INTO fixedsalary (userId,amount,startDate,createdBy,createdAt,updatedAt)
                       VALUES (%s,%s,'2026-01-01',%s,NOW(),NOW())""", (uid, amt, ADMIN_ID))
        print(f"  + FixedSalary uid={uid}: {amt:,}đ")

# Allowances
allowances = [
    ('Phụ cấp ăn trưa',   500000, 'BOTH'),
    ('Phụ cấp xăng xe',   300000, 'RECEPTIONIST'),
    ('Phụ cấp điện thoại',200000, 'BOTH'),
    ('Phụ cấp thâm niên', 400000, 'ACCOUNTANT'),
]
for name, amt, applies in allowances:
    cur.execute("SELECT id FROM allowance WHERE name=%s", (name,))
    if not cur.fetchone():
        cur.execute("""INSERT INTO allowance (name,amount,appliesTo,startDate,createdBy,createdAt,updatedAt)
                       VALUES (%s,%s,%s,'2026-01-01',%s,NOW(),NOW())""",
                    (name, amt, applies, ADMIN_ID))
        print(f"  + Allowance: {name} {amt:,}đ → {applies}")
conn.commit()

# ─── 8. DOCTOR SCHEDULES (6 tuần: 3 trước + 3 sau hôm nay) ───────────────────
print("\n[8] Doctor schedules...")
sched_count = 0
# Each doctor works Mon-Fri in alternating shifts
doctor_shifts = {
    7:  [SHIFT_AM, SHIFT_AM, SHIFT_PM, SHIFT_AM, SHIFT_PM],  # Mon-Fri
    8:  [SHIFT_PM, SHIFT_AM, SHIFT_AM, SHIFT_PM, SHIFT_AM],
    14: [SHIFT_AM, SHIFT_PM, SHIFT_AM, SHIFT_PM, SHIFT_AM],
    16: [SHIFT_PM, SHIFT_PM, SHIFT_AM, SHIFT_AM, SHIFT_PM],
    4:  [SHIFT_AM, SHIFT_AM, SHIFT_AM, SHIFT_PM, SHIFT_PM],
}
# Find Monday of 3 weeks ago
base_monday = TODAY - datetime.timedelta(days=TODAY.weekday() + 21)

for week_offset in range(7):  # 3 past + current + 3 future
    week_start = base_monday + datetime.timedelta(weeks=week_offset)
    for d_offset in range(5):  # Mon-Fri
        work_date = week_start + datetime.timedelta(days=d_offset)
        dow_idx = d_offset  # 0=Mon,...,4=Fri
        for did, shifts in doctor_shifts.items():
            shift_id = shifts[dow_idx]
            # Pick service group
            cur.execute("SELECT serviceGroupId FROM servicegroupdoctor WHERE doctorId=%s LIMIT 1", (did,))
            sg_row = cur.fetchone()
            sg_id = sg_row[0] if sg_row else None
            # Try insert
            try:
                cur.execute("""INSERT INTO doctorschedule (doctorId,shiftId,workDate,serviceGroupId,
                               isOverride,createdBy,createdAt,updatedAt)
                               VALUES (%s,%s,%s,%s,0,%s,NOW(),NOW())""",
                            (did, shift_id, work_date, sg_id, ADMIN_ID))
                sched_count += 1
            except pymysql.err.IntegrityError:
                pass  # already exists

conn.commit()
print(f"  + {sched_count} doctor schedules created")

# ─── 9. PATIENTS (50 bệnh nhân mới) ──────────────────────────────────────────
print("\n[9] Patients...")
VIETNAMESE_NAMES = [
    'Nguyễn Thị Lan','Trần Văn Nam','Lê Thị Mai','Phạm Văn Hùng','Hoàng Thị Hoa',
    'Vũ Văn Đức','Đặng Thị Tuyết','Bùi Văn Minh','Đỗ Thị Hằng','Ngô Văn Tài',
    'Phan Thị Linh','Hồ Văn Phong','Đinh Thị Hương','Lý Văn Long','Cao Thị Thanh',
    'Trịnh Văn Sơn','Lưu Thị Ngọc','Dương Văn Bình','Khổng Thị Yến','Châu Văn Hải',
    'Nguyễn Hoàng Nam','Trần Thị Kim Anh','Lê Văn Phúc','Phạm Thị Bích','Hoàng Văn Kiên',
    'Vũ Thị Diệu','Đặng Văn Phát','Bùi Thị Loan','Đỗ Văn Quân','Ngô Thị Hà',
    'Phan Văn Thắng','Hồ Thị Mỹ','Đinh Văn Tuấn','Lý Thị Nhung','Cao Văn Trí',
    'Trịnh Thị Bảo','Lưu Văn Dũng','Dương Thị Phương','Khổng Văn Hưng','Châu Thị Trang',
    'Nguyễn Văn Tùng','Trần Thị Thảo','Lê Thị Kim Ngân','Phạm Văn Đạt','Hoàng Thị Cúc',
    'Vũ Văn Toàn','Đặng Thị Ánh','Bùi Văn Khánh','Đỗ Thị Thúy','Ngô Văn Phú',
    'Phan Thị Hạnh','Hồ Văn Lâm','Đinh Thị Xuân','Lý Văn Huy','Cao Thị Thủy',
    'Trịnh Văn Cường','Lưu Thị Huyền','Dương Văn An','Khổng Thị Nga','Châu Văn Bảo',
]
GENDERS = ['MALE','FEMALE']
OCCUPATIONS = ['Nhân viên văn phòng','Giáo viên','Kỹ sư','Bác sĩ','Kinh doanh',
               'Sinh viên','Nội trợ','Lao động tự do','Công nhân','Hưu trí']
CLASSIFICATIONS = ['NEW','REGULAR','VIP','PRIORITY']
ALLERGIES = [None, 'Penicillin', 'Aspirin', 'Latex', None, None]

cur.execute("SELECT COUNT(*) FROM patient")
existing_patients = cur.fetchone()[0]

# Get max patient code number
cur.execute("SELECT code FROM patient ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
if row:
    last_num = int(row[0].split('-')[-1]) if '-' in row[0] else 0
else:
    last_num = 0

new_patient_ids = []
added_patients = 0
for i, name in enumerate(VIETNAMESE_NAMES):
    last_num += 1
    code = f'BN-{last_num:05d}'
    cur.execute("SELECT id FROM patient WHERE fullName=%s", (name,))
    if cur.fetchone():
        continue
    gender = 'FEMALE' if 'Thị' in name else 'MALE'
    dob = rand_dob()
    phone = f'0{random.randint(900000000,999999999)}'
    occ = random.choice(OCCUPATIONS)
    clf = random.choice(CLASSIFICATIONS)
    allergy = random.choice(ALLERGIES)
    cur.execute("""INSERT INTO patient
        (code,fullName,dateOfBirth,gender,phone,occupation,classification,
         allergies,isComplete,isActive,createdBy,createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,1,1,%s,NOW(),NOW())""",
        (code,name,dob,gender,phone,occ,clf,allergy,ADMIN_ID))
    new_patient_ids.append(cur.lastrowid)
    added_patients += 1

conn.commit()
print(f"  + {added_patients} bệnh nhân mới thêm")

# Get ALL patient ids
cur.execute("SELECT id FROM patient WHERE isActive=1 ORDER BY id")
ALL_PATIENT_IDS = [r[0] for r in cur.fetchall()]
print(f"  Tổng bệnh nhân: {len(ALL_PATIENT_IDS)}")

# ─── 10. APPOINTMENTS (lịch hẹn 180 ngày) ────────────────────────────────────
print("\n[10] Appointments...")
# Get max appointment code
cur.execute("SELECT code FROM appointment ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
apt_num = 0
if row:
    try:
        apt_num = int(row[0].split('-')[-1])
    except:
        apt_num = 100

VISIT_REASONS = ['NEW_EXAM','REVISIT','TREATMENT','SCALING','BRACES','CONSULTATION']
APT_STATUSES_PAST  = ['CONFIRMED','COMPLETED','COMPLETED','COMPLETED','ABSENT','CANCELLED']
APT_STATUSES_TODAY = ['CONFIRMED','CHECKED_IN','IN_PROGRESS','PENDING']
APT_STATUSES_FUTURE= ['PENDING','CONFIRMED','PENDING','CONFIRMED']

SERVICES_LIST = list(svc_ids.values())

added_apts = 0
apt_recs = []  # (apt_id, patient_id, doctor_id, apt_date, service_id, status)

# Past appointments: 120 cái trong 90 ngày qua
for _ in range(120):
    apt_num += 1
    date_past = NOW - datetime.timedelta(days=random.randint(1,90), hours=random.randint(0,8))
    # round to half-hour
    date_past = date_past.replace(minute=0 if date_past.minute<30 else 30, second=0, microsecond=0)
    pid = random.choice(ALL_PATIENT_IDS)
    did = random.choice(DOCTORS)
    sid = random.choice(SERVICES_LIST[:10])  # only general services
    status = random.choice(APT_STATUSES_PAST)
    code = f'APT-{date_past.strftime("%Y%m%d")}-{apt_num:04d}'
    cur.execute("""INSERT INTO appointment
        (code,patientName,patientPhone,patientDob,patientGender,
         doctorId,serviceId,patientId,appointmentDate,status,
         createdBy,note,createdAt,updatedAt)
        SELECT %s,p.fullName,p.phone,p.dateOfBirth,p.gender,
               %s,%s,%s,%s,%s,%s,%s,NOW(),NOW()
        FROM patient p WHERE p.id=%s""",
        (code,did,sid,pid,date_past,status,ADMIN_ID,'Lịch hẹn khám định kỳ',pid))
    apt_id = cur.lastrowid
    apt_recs.append((apt_id, pid, did, date_past, sid, status))
    added_apts += 1

# Today appointments: 15 cái
today_dt = datetime.datetime.combine(TODAY, datetime.time(8,0))
for i in range(15):
    apt_num += 1
    hour = 8 + i
    if hour >= 12: hour += 1  # lunch break
    if hour > 17: break
    apt_dt = today_dt.replace(hour=hour, minute=random.choice([0,30]))
    pid = random.choice(ALL_PATIENT_IDS)
    did = random.choice(DOCTORS)
    sid = random.choice(SERVICES_LIST[:8])
    status = random.choice(APT_STATUSES_TODAY)
    code = f'APT-{apt_dt.strftime("%Y%m%d")}-{apt_num:04d}'
    cur.execute("""INSERT INTO appointment
        (code,patientName,patientPhone,patientDob,patientGender,
         doctorId,serviceId,patientId,appointmentDate,status,
         createdBy,note,createdAt,updatedAt)
        SELECT %s,p.fullName,p.phone,p.dateOfBirth,p.gender,
               %s,%s,%s,%s,%s,%s,%s,NOW(),NOW()
        FROM patient p WHERE p.id=%s""",
        (code,did,sid,pid,apt_dt,status,ADMIN_ID,'Lịch hẹn hôm nay',pid))
    apt_id = cur.lastrowid
    apt_recs.append((apt_id, pid, did, apt_dt, sid, status))
    added_apts += 1

# Future appointments: 60 cái trong 60 ngày tới
for _ in range(60):
    apt_num += 1
    days_ahead = random.randint(1, 60)
    hour = random.choice([8,9,10,11,13,14,15,16,17])
    apt_dt = datetime.datetime.combine(TODAY + datetime.timedelta(days=days_ahead),
                                        datetime.time(hour, random.choice([0,30])))
    pid = random.choice(ALL_PATIENT_IDS)
    did = random.choice(DOCTORS)
    sid = random.choice(SERVICES_LIST)
    status = random.choice(APT_STATUSES_FUTURE)
    code = f'APT-{apt_dt.strftime("%Y%m%d")}-{apt_num:04d}'
    cur.execute("""INSERT INTO appointment
        (code,patientName,patientPhone,patientDob,patientGender,
         doctorId,serviceId,patientId,appointmentDate,status,
         createdBy,note,createdAt,updatedAt)
        SELECT %s,p.fullName,p.phone,p.dateOfBirth,p.gender,
               %s,%s,%s,%s,%s,%s,%s,NOW(),NOW()
        FROM patient p WHERE p.id=%s""",
        (code,did,sid,pid,apt_dt,status,ADMIN_ID,'Lịch hẹn tương lai',pid))
    apt_id = cur.lastrowid
    apt_recs.append((apt_id, pid, did, apt_dt, sid, status))
    added_apts += 1

conn.commit()
print(f"  + {added_apts} appointments thêm mới")

# ─── 11. RECEPTIONS ───────────────────────────────────────────────────────────
print("\n[11] Receptions (walk-in + từ lịch hẹn)...")
# Get max reception code number
cur.execute("SELECT code FROM reception ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
rec_num = 0
if row:
    try:
        rec_num = int(row[0].split('-')[-1])
    except: rec_num = 0

REC_STATUSES = {
    'COMPLETED': ['COMPLETED'],
    'CONFIRMED': ['WAITING','WAITING','IN_TREATMENT'],
    'CHECKED_IN': ['WAITING','IN_TREATMENT'],
    'IN_PROGRESS': ['IN_TREATMENT'],
    'ABSENT':    ['ABSENT'],
    'CANCELLED': ['CANCELLED'],
}
VISIT_R = ['NEW_EXAM','REVISIT','TREATMENT','SCALING','CONSULTATION']

added_recs = 0
rec_recs = []  # (rec_id, patient_id, doctor_id, arrived_at, status, service_id)

# a) Receptions from COMPLETED/CHECKED_IN/IN_PROGRESS appointments (past)
used_apt_ids = set()
cur.execute("SELECT id FROM reception WHERE appointmentId IS NOT NULL")
for r in cur.fetchall():
    used_apt_ids.add(r[0])

for (apt_id, pid, did, apt_date, sid, apt_status) in apt_recs:
    if apt_id in used_apt_ids:
        continue
    if apt_status not in ('COMPLETED','CHECKED_IN','IN_PROGRESS'):
        continue
    rec_num += 1
    date_key = apt_date.strftime('%Y%m%d')
    code = f'TD-{date_key}-{rec_num:04d}'
    rec_status = REC_STATUSES.get(apt_status, ['WAITING'])[0]
    chair_id = random.choice(chair_ids)
    rec_id_val = RECEPTIONISTS[0]
    arrived = apt_date
    cur.execute("""INSERT INTO reception
        (code,patientId,appointmentId,receptionistId,doctorId,
         chairId,arrivedAt,visitReason,status,queuePriority,
         createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,5,NOW(),NOW())""",
        (code,pid,apt_id,rec_id_val,did,chair_id,arrived,'TREATMENT',rec_status))
    rec_id = cur.lastrowid
    rec_recs.append((rec_id, pid, did, arrived, rec_status, sid))
    added_recs += 1
    used_apt_ids.add(apt_id)

# b) Walk-in receptions (past 60 days, no appointment)
for _ in range(60):
    rec_num += 1
    days_ago = random.randint(1, 60)
    hour = random.randint(8, 16)
    arrived = (NOW - datetime.timedelta(days=days_ago)).replace(
        hour=hour, minute=random.randint(0,59), second=0, microsecond=0)
    pid = random.choice(ALL_PATIENT_IDS)
    did = random.choice(DOCTORS)
    sid = random.choice(SERVICES_LIST[:12])
    date_key = arrived.strftime('%Y%m%d')
    code = f'TD-{date_key}-{rec_num:04d}'
    rec_status = random.choice(['COMPLETED','COMPLETED','WAITING_PAYMENT','ABSENT'])
    chair_id = random.choice(chair_ids)
    rec_id_val = random.choice(RECEPTIONISTS)
    vr = random.choice(VISIT_R)
    cur.execute("""INSERT INTO reception
        (code,patientId,receptionistId,doctorId,
         chairId,arrivedAt,visitReason,status,queuePriority,
         createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,5,NOW(),NOW())""",
        (code,pid,rec_id_val,did,chair_id,arrived,vr,rec_status))
    rec_id = cur.lastrowid
    rec_recs.append((rec_id, pid, did, arrived, rec_status, sid))
    added_recs += 1

# c) Today walk-ins
for i in range(8):
    rec_num += 1
    arrived = datetime.datetime.combine(TODAY, datetime.time(7+i, random.randint(0,59)))
    pid = random.choice(ALL_PATIENT_IDS)
    did = random.choice(DOCTORS)
    sid = random.choice(SERVICES_LIST[:10])
    date_key = TODAY.strftime('%Y%m%d')
    code = f'TD-{date_key}-{rec_num:04d}'
    status_today = random.choice(['WAITING','WAITING','IN_TREATMENT','COMPLETED','WAITING_PAYMENT'])
    chair_id = random.choice(chair_ids)
    rec_id_val = random.choice(RECEPTIONISTS)
    vr = random.choice(VISIT_R)
    cur.execute("""INSERT INTO reception
        (code,patientId,receptionistId,doctorId,
         chairId,arrivedAt,visitReason,status,queuePriority,
         createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,5,NOW(),NOW())""",
        (code,pid,rec_id_val,did,chair_id,arrived,vr,status_today))
    rec_id = cur.lastrowid
    rec_recs.append((rec_id, pid, did, arrived, status_today, sid))
    added_recs += 1

conn.commit()
print(f"  + {added_recs} receptions thêm mới")

# ─── 12. DENTAL RECORDS ───────────────────────────────────────────────────────
print("\n[12] Dental records...")
ICD10 = [
    ('K02.1','Sâu răng đến ngà'),
    ('K04.0','Viêm tủy răng'),
    ('K05.1','Viêm nướu mạn tính'),
    ('K08.1','Mất răng do tai nạn'),
    ('K07.2','Lệch lạc khớp cắn'),
    ('K10.3','Viêm xương hàm'),
    ('K09.0','Nang răng'),
]
SYMPTOMS = [
    'Đau răng dữ dội khi ăn uống nóng lạnh',
    'Ê buốt khi uống nước lạnh, chải răng',
    'Chảy máu nướu khi đánh răng',
    'Răng bị sâu, mẻ một phần',
    'Đau hàm, khó há miệng',
    'Nướu sưng tấy, có mủ',
    'Nhức răng lan lên thái dương',
]

cur.execute("SELECT id FROM dental_record")
existing_dr = {r[0] for r in cur.fetchall()}
cur.execute("SELECT receptionId FROM dental_record")
existing_dr_rec = {r[0] for r in cur.fetchall()}

dr_num = 0
cur.execute("SELECT code FROM dental_record ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
if row and row[0]:
    try: dr_num = int(row[0].split('-')[-1])
    except: dr_num = 0

added_dr = 0
dr_recs = []  # (dr_id, rec_id, patient_id, doctor_id, service_id, arrived_at, status)

for (rec_id, pid, did, arrived, rec_status, sid) in rec_recs:
    if rec_id in existing_dr_rec:
        continue
    if rec_status not in ('COMPLETED', 'WAITING_PAYMENT', 'IN_TREATMENT'):
        continue
    dr_num += 1
    date_key = arrived.strftime('%Y%m%d') if hasattr(arrived,'strftime') else TODAY.strftime('%Y%m%d')
    code = f'HR-{date_key}-{dr_num:04d}'
    icd = random.choice(ICD10)
    sym = random.choice(SYMPTOMS)
    dr_status = 'SIGNED' if rec_status == 'COMPLETED' else 'DRAFT'
    signed_at = arrived + datetime.timedelta(hours=1) if dr_status == 'SIGNED' else None
    follow_up = (arrived + datetime.timedelta(days=random.randint(7,30))).date() if rec_status=='COMPLETED' and random.random()>0.5 else None
    cur.execute("""INSERT INTO dental_record
        (code,receptionId,patientId,doctorId,
         visitReason,symptoms,icd10Code,icd10Description,
         clinicalNotes,aftercareNotes,followUpDate,
         status,signedAt,createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())""",
        (code,rec_id,pid,did,
         'Bệnh nhân đến khám theo lịch hẹn',sym,
         icd[0],icd[1],
         f'Bệnh nhân {icd[1].lower()}, tiến hành điều trị theo phác đồ',
         'Súc miệng nước muối 2 lần/ngày, hạn chế đồ cứng',
         follow_up, dr_status, signed_at))
    dr_id = cur.lastrowid
    existing_dr_rec.add(rec_id)
    # Add services to dental record
    cur.execute("""INSERT INTO dental_record_service (recordId,serviceId,toothNumber,unitPrice,quantity,note)
                   SELECT %s,%s,%s,sp.basePrice,1,'Điều trị theo chỉ định'
                   FROM serviceprice sp WHERE sp.serviceId=%s
                   ORDER BY sp.id DESC LIMIT 1""",
                (dr_id, sid, f'{random.randint(11,48)}', sid))
    dr_recs.append((dr_id, rec_id, pid, did, sid, arrived, dr_status))
    added_dr += 1

conn.commit()
print(f"  + {added_dr} dental records thêm mới")

# ─── 13. INVOICES ─────────────────────────────────────────────────────────────
print("\n[13] Invoices...")
cur.execute("SELECT dentalRecordId FROM invoice")
existing_inv_dr = {r[0] for r in cur.fetchall()}
cur.execute("SELECT receptionId FROM invoice")
existing_inv_rec = {r[0] for r in cur.fetchall()}

inv_num = 0
cur.execute("SELECT code FROM invoice ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
if row and row[0]:
    try: inv_num = int(row[0].split('-')[-1])
    except: inv_num = 0

PAYMENT_METHODS = ['CASH','CASH','CASH','CARD','MOMO','VNPAY']
added_inv = 0

for (dr_id, rec_id, pid, did, sid, arrived, dr_status) in dr_recs:
    if dr_id in existing_inv_dr or rec_id in existing_inv_rec:
        continue
    # Get service price
    cur.execute("SELECT basePrice FROM serviceprice WHERE serviceId=%s ORDER BY id DESC LIMIT 1", (sid,))
    price_row = cur.fetchone()
    if not price_row:
        continue
    base_price = price_row[0]
    disc_pct = random.choice([0,0,0,5,10])
    disc_amt = int(base_price * disc_pct / 100)
    total = base_price - disc_amt

    inv_num += 1
    date_key = arrived.strftime('%Y%m%d') if hasattr(arrived,'strftime') else TODAY.strftime('%Y%m%d')
    code = f'HD-{date_key}-{inv_num:04d}'
    inv_status = 'PAID' if dr_status == 'SIGNED' else 'WAITING_PAYMENT'
    paid_at = (arrived + datetime.timedelta(hours=random.randint(1,3))) if inv_status == 'PAID' else None
    pay_method = random.choice(PAYMENT_METHODS) if inv_status == 'PAID' else None
    confirmed_by = ADMIN_ID if inv_status == 'PAID' else None

    cur.execute("""INSERT INTO invoice
        (code,receptionId,dentalRecordId,patientId,doctorId,
         subtotal,discountAmount,discountPct,totalAmount,bhytAmount,
         paymentMethod,paidAt,status,confirmedBy,
         createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s,%s,%s,NOW(),NOW())""",
        (code,rec_id,dr_id,pid,did,
         base_price,disc_amt,disc_pct,total,
         pay_method,paid_at,inv_status,confirmed_by))
    inv_id = cur.lastrowid

    # Invoice items
    cur.execute("""INSERT INTO invoice_item
        (invoiceId,serviceId,serviceName,toothNumber,unitPrice,quantity,bhytCovered,amount)
        SELECT %s,%s,s.name,%s,%s,1,0,%s
        FROM service s WHERE s.id=%s""",
        (inv_id,sid,f'{random.randint(11,48)}',base_price,total,sid))
    existing_inv_dr.add(dr_id)
    existing_inv_rec.add(rec_id)
    added_inv += 1

conn.commit()
print(f"  + {added_inv} invoices thêm mới")

# ─── 14. PAYSLIPS (12 tháng 2025 + 6 tháng 2026) ─────────────────────────────
print("\n[14] Payslips...")
cur.execute("SELECT userId, month FROM payslip")
existing_ps = {(r[0],r[1]) for r in cur.fetchall()}

# Get doctor's effective hourly rate
def get_hourly_rate(month_str):
    cur.execute("""SELECT amount FROM hourlyrate
                   WHERE startDate <= %s ORDER BY startDate DESC LIMIT 1""",
                (month_str + '-28',))
    r = cur.fetchone()
    return r[0] if r else 200000

# Get fixed salary for user
def get_fixed_salary(uid, month_str):
    cur.execute("""SELECT amount FROM fixedsalary
                   WHERE userId=%s AND startDate <= %s ORDER BY startDate DESC LIMIT 1""",
                (uid, month_str + '-28'))
    r = cur.fetchone()
    return r[0] if r else 7000000

# Get allowances total for role
def get_allowances(role, month_str):
    cur.execute("""SELECT SUM(amount) FROM allowance
                   WHERE (appliesTo=%s OR appliesTo='BOTH')
                   AND startDate <= %s""", (role, month_str + '-28'))
    r = cur.fetchone()
    return r[0] or 0

MONTHS = [f'2025-{m:02d}' for m in range(1,13)] + [f'2026-{m:02d}' for m in range(1,7)]
all_staff = {
    'DOCTOR':       DOCTORS,
    'RECEPTIONIST': [12, 15],
    'ACCOUNTANT':   [2, 11, 17],
}
added_ps = 0

for role, uids in all_staff.items():
    for uid in uids:
        for month in MONTHS:
            if (uid, month) in existing_ps:
                continue
            if role == 'DOCTOR':
                # sessions: 15-22 ca/tháng, 6-8h/ca
                sessions = random.randint(15, 22)
                hours = round(sessions * random.uniform(6.0, 8.5), 2)
                rate = get_hourly_rate(month)
                salary_amt = int(hours * rate)
                allowance = 0
                deduction = random.randint(0, 200000)
            else:
                sessions = None
                hours = None
                salary_amt = get_fixed_salary(uid, month)
                allowance = int(get_allowances(role, month))
                deduction = random.randint(0, 300000)
            net = salary_amt + allowance - deduction
            ps_status = 'FINALIZED' if month < '2026-05' else ('APPROVED' if month < '2026-06' else 'DRAFT')
            cur.execute("""INSERT INTO payslip
                (userId,month,role,sessionCount,hoursWorked,
                 salaryAmount,allowance,deduction,netSalary,
                 status,note,createdBy,createdAt,updatedAt)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())""",
                (uid,month,role,sessions,hours,
                 salary_amt,allowance,deduction,net,
                 ps_status,'Phiếu lương tháng '+month,ADMIN_ID))
            existing_ps.add((uid,month))
            added_ps += 1

conn.commit()
print(f"  + {added_ps} payslips thêm mới")

# ─── 15. HOLIDAYS ─────────────────────────────────────────────────────────────
print("\n[15] Holidays...")
HOLIDAYS_2026 = [
    ('Tết Dương lịch 2026',         '2026-01-01','2026-01-01','NATIONAL'),
    ('Tết Nguyên đán 2026',         '2026-01-27','2026-02-02','NATIONAL'),
    ('Giỗ Tổ Hùng Vương',          '2026-04-07','2026-04-07','NATIONAL'),
    ('Ngày Giải phóng miền Nam',    '2026-04-30','2026-04-30','NATIONAL'),
    ('Ngày Quốc tế Lao động',       '2026-05-01','2026-05-01','NATIONAL'),
    ('Ngày Quốc khánh',             '2026-09-02','2026-09-02','NATIONAL'),
    ('Nghỉ hè phòng khám',          '2026-07-14','2026-07-18','PRIVATE'),
]
cur.execute("SELECT name FROM holiday")
existing_hols = {r[0] for r in cur.fetchall()}
for (name, start, end, htype) in HOLIDAYS_2026:
    if name not in existing_hols:
        cur.execute("""INSERT INTO holiday (name,startDate,endDate,type,sendSms,autoCancel,createdBy,createdAt,updatedAt)
                       VALUES (%s,%s,%s,%s,0,0,%s,NOW(),NOW())""",
                    (name,start,end,htype,ADMIN_ID))
        print(f"  + Holiday: {name}")
conn.commit()

# ─── 16. SHIFT COEFFICIENTS (bổ sung nếu thiếu) ─────────────────────────────
print("\n[16] Shift coefficients...")
# Each shift should have 7 coefficients (Mon-Sun)
for shift_id in [1,2,3]:
    for dow in range(1,8):
        cur.execute("SELECT id FROM shiftcoefficient WHERE shiftId=%s AND dayOfWeek=%s",(shift_id,dow))
        if not cur.fetchone():
            coeff = 1.0 if dow <= 5 else (1.3 if dow == 6 else 1.5)
            cur.execute("""INSERT INTO shiftcoefficient (shiftId,dayOfWeek,coefficient,updatedBy,updatedAt)
                           VALUES (%s,%s,%s,%s,NOW())""", (shift_id,dow,coeff,ADMIN_ID))
            print(f"  + Coefficient shift={shift_id} dow={dow} = {coeff}")
conn.commit()

# ─── TỔNG KẾT ────────────────────────────────────────────────────────────────
print("\n=== TỔNG KẾT SEED ===")
tables = [('servicegroup','ServiceGroup'),('service','Service'),
          ('serviceprice','ServicePrice'),('servicegroupdoctor','ServiceGroupDoctor'),
          ('dental_chair','DentalChair'),('patient','Patient'),
          ('appointment','Appointment'),('reception','Reception'),
          ('dental_record','DentalRecord'),('invoice','Invoice'),
          ('payslip','Payslip'),('hourlyrate','HourlyRate'),
          ('fixedsalary','FixedSalary'),('allowance','Allowance'),
          ('doctorschedule','DoctorSchedule'),('holiday','Holiday'),
          ('shiftcoefficient','ShiftCoefficient')]
for (tbl, label) in tables:
    cur.execute(f'SELECT COUNT(*) FROM `{tbl}`')
    print(f"  {label:25s}: {cur.fetchone()[0]:>6}")

conn.close()
print("\n✅ SEED HOÀN THÀNH!")
