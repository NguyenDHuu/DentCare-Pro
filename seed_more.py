"""
seed_more.py – Seed thêm dữ liệu phong phú vào hệ thống
- 100 bệnh nhân mới
- 300 lịch hẹn thêm (trải đều 12 tháng 2025 + 2026)
- 200 lượt tiếp đón walk-in
- Dental records + invoices đầy đủ
- Payslips 2024 cả năm
- System logs, SMS logs
- Tooth chart + điều trị nhiều răng/lần
"""
import sys, io, random, datetime, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import pymysql

conn = pymysql.connect(
    host='localhost', user='root', password='123456',
    database='dental_clinic', charset='utf8mb4', autocommit=False
)
cur = conn.cursor()
print("=== SEED MORE – BẮT ĐẦU ===\n")

# ── Hằng số ──────────────────────────────────────────────────────────────────
ADMIN_ID      = 1
DOCTORS       = [4, 7, 8, 14, 16]
RECEPTIONISTS = [12, 15]
ACCOUNTANTS   = [2, 11, 17]

NOW   = datetime.datetime.now()
TODAY = datetime.date.today()

def rdt(y,m,d,h=9,mi=0):
    return datetime.datetime(y,m,d,h,mi,0)

def rand_dob():
    return datetime.datetime(random.randint(1955,2010), random.randint(1,12), random.randint(1,28))

# ── Lấy dữ liệu hiện có ──────────────────────────────────────────────────────
cur.execute("SELECT id FROM service WHERE status='ACTIVE'")
SVC_IDS = [r[0] for r in cur.fetchall()]

cur.execute("SELECT id, basePrice, serviceId FROM serviceprice ORDER BY id")
svc_price_map = {}
for r in cur.fetchall():
    svc_price_map[r[2]] = (r[0], r[1])

cur.execute("SELECT id, number FROM dental_chair WHERE isActive=1 ORDER BY number")
CHAIR_IDS = [r[0] for r in cur.fetchall()]

cur.execute("SELECT id FROM patient WHERE isActive=1 ORDER BY id")
ALL_PIDS = [r[0] for r in cur.fetchall()]

cur.execute("SELECT id FROM servicegroup ORDER BY id")
SG_IDS = [r[0] for r in cur.fetchall()]

# ─── 1. THÊM 100 BỆNH NHÂN MỚI ──────────────────────────────────────────────
print("[1] Thêm 100 bệnh nhân mới...")

MORE_NAMES = [
    'Nguyễn Minh Khoa','Trần Thị Bảo Châu','Lê Hoàng Phúc','Phạm Ngọc Linh',
    'Hoàng Thị Thu Hà','Vũ Thanh Tùng','Đặng Quỳnh Như','Bùi Hữu Thành',
    'Đỗ Thị Kiều','Ngô Quốc Khánh','Phan Thị Bích Ngọc','Hồ Văn Quang',
    'Đinh Thị Lan Anh','Lý Thanh Bình','Cao Thị Mộng Tuyền','Trịnh Hoài Nam',
    'Lưu Thị Thu Thảo','Dương Quang Hải','Khổng Thị Diệu Linh','Châu Văn Phát',
    'Nguyễn Thị Hồng Nhung','Trần Đức Mạnh','Lê Thị Ngọc Hân','Phạm Văn Khải',
    'Hoàng Thị Thanh Hương','Vũ Đình Dũng','Đặng Thị Mỹ Linh','Bùi Quang Trung',
    'Đỗ Thị Phương Linh','Ngô Văn Hiếu','Phan Đức Thắng','Hồ Thị Cẩm Tú',
    'Đinh Văn Lộc','Lý Thị Thu Ngân','Cao Văn Hào','Trịnh Thị Thùy Dung',
    'Lưu Văn Toàn','Dương Thị Ngọc Bích','Khổng Văn Sáng','Châu Thị Kim Liên',
    'Nguyễn Đăng Khoa','Trần Thị Phương Thảo','Lê Văn Vinh','Phạm Thị Tú Anh',
    'Hoàng Đình Khải','Vũ Thị Ngọc Trâm','Đặng Minh Tuấn','Bùi Thị Thanh Nga',
    'Đỗ Văn Hưng','Ngô Thị Hải Yến','Phan Thị Kim Oanh','Hồ Quang Minh',
    'Đinh Thị Bảo Nhi','Lý Văn Phước','Cao Thị Hồng Hạnh','Trịnh Văn Thịnh',
    'Lưu Thị Hồng Gấm','Dương Văn Chiến','Khổng Thị Thúy Nga','Châu Văn Tín',
    'Nguyễn Thị Thanh Tâm','Trần Hoàng Duy','Lê Thị Kim Thoa','Phạm Đức Hiếu',
    'Hoàng Thị Diễm','Vũ Văn Nghĩa','Đặng Thị Hồng Nhung','Bùi Văn Lực',
    'Đỗ Thị Kim Chi','Ngô Đức Thành','Phan Văn Bảo','Hồ Thị Bé',
    'Đinh Minh Trí','Lý Thị Thu Huyền','Cao Văn Thành','Trịnh Thị Huyền Trang',
    'Lưu Văn Hào','Dương Thị Bích Ngọc','Khổng Văn Lâm','Châu Thị Diệu',
    'Nguyễn Hữu Đức','Trần Thị Nhã Uyên','Lê Văn Thắng','Phạm Thị Diễm Châu',
    'Hoàng Minh Hưng','Vũ Thị Phúc','Đặng Văn Trường','Bùi Thị Kim Ngân',
    'Đỗ Văn Đông','Ngô Thị Tố Uyên','Phan Văn Hòa','Hồ Minh Nhật',
    'Đinh Thị Minh Thi','Lý Văn Bá','Cao Thị Thu Hà','Trịnh Văn Đạt',
    'Lưu Thị Mỹ Dung','Dương Văn Hùng',
]

OCCUPATIONS = ['Nhân viên văn phòng','Giáo viên','Kỹ sư','Bác sĩ','Kinh doanh tự do',
               'Sinh viên','Nội trợ','Lao động tự do','Công nhân','Hưu trí',
               'Kế toán','Luật sư','Dược sĩ','Nông dân','Công chức nhà nước']
CLASSIFICATIONS = ['NEW','NEW','REGULAR','REGULAR','REGULAR','VIP','PRIORITY']
ALLERGIES = [None,None,None,'Penicillin','Aspirin','Latex','NSAID',None,None]
DISEASES = [None,None,'Tiểu đường type 2','Huyết áp cao','Bệnh tim mạch',None,'Loãng xương',None]

cur.execute("SELECT code FROM patient ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
last_bn = int(row[0].split('-')[1]) if row else 0

new_pid_list = []
added_p = 0
for name in MORE_NAMES:
    cur.execute("SELECT id FROM patient WHERE fullName=%s", (name,))
    if cur.fetchone():
        continue
    last_bn += 1
    code = f'BN-{last_bn:05d}'
    gender = 'FEMALE' if 'Thị' in name or 'Như' in name or 'Châu' in name else 'MALE'
    dob    = rand_dob()
    phone  = f'0{random.randint(900000000,999999999)}'
    occ    = random.choice(OCCUPATIONS)
    clf    = random.choice(CLASSIFICATIONS)
    allergy = random.choice(ALLERGIES)
    disease = random.choice(DISEASES)
    addr   = f'{random.randint(1,200)} đường {random.choice(["Nguyễn Huệ","Lê Lợi","Trần Hưng Đạo","Điện Biên Phủ","Phan Đăng Lưu"])}, Q.{random.randint(1,12)}, TP.HCM'
    cur.execute("""INSERT INTO patient
        (code,fullName,dateOfBirth,gender,phone,occupation,address,
         classification,allergies,systemicDiseases,isComplete,isActive,
         createdBy,createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1,1,%s,NOW(),NOW())""",
        (code,name,dob,gender,phone,occ,addr,clf,allergy,disease,ADMIN_ID))
    new_pid_list.append(cur.lastrowid)
    added_p += 1

conn.commit()
print(f"  + {added_p} bệnh nhân mới")

cur.execute("SELECT id FROM patient WHERE isActive=1 ORDER BY id")
ALL_PIDS = [r[0] for r in cur.fetchall()]
print(f"  Tổng bệnh nhân: {len(ALL_PIDS)}")

# ─── 2. LỊCH HẸN 2024 + 2025 THÊM ──────────────────────────────────────────
print("\n[2] Thêm 350 lịch hẹn (2024 + 2025 + 2026)...")

cur.execute("SELECT code FROM appointment ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
apt_num = int(row[0].split('-')[-1]) if row else 0

STATUSES_PAST   = ['COMPLETED']*5 + ['CONFIRMED','ABSENT','CANCELLED']
STATUSES_FUTURE = ['PENDING']*3 + ['CONFIRMED']*2

added_apt = 0
apt_batch = []  # (apt_id, pid, did, apt_dt, sid, status)

# 2024 appointments: 100 cái
for _ in range(100):
    apt_num += 1
    year = 2024
    month = random.randint(1, 12)
    day   = random.randint(1, 28)
    hour  = random.choice([8,9,10,11,13,14,15,16])
    apt_dt = datetime.datetime(year, month, day, hour, random.choice([0,30]), 0)
    pid  = random.choice(ALL_PIDS)
    did  = random.choice(DOCTORS)
    sid  = random.choice(SVC_IDS)
    st   = random.choice(STATUSES_PAST)
    code = f'APT-{apt_dt.strftime("%Y%m%d")}-{apt_num:04d}'
    cur.execute("""INSERT INTO appointment
        (code,patientName,patientPhone,patientDob,patientGender,
         doctorId,serviceId,patientId,appointmentDate,status,
         createdBy,note,createdAt,updatedAt)
        SELECT %s,p.fullName,p.phone,p.dateOfBirth,p.gender,
               %s,%s,%s,%s,%s,%s,'Khám định kỳ',NOW(),NOW()
        FROM patient p WHERE p.id=%s""",
        (code,did,sid,pid,apt_dt,st,ADMIN_ID,pid))
    apt_batch.append((cur.lastrowid, pid, did, apt_dt, sid, st))
    added_apt += 1

# 2025 appointments: 150 cái
for _ in range(150):
    apt_num += 1
    month = random.randint(1, 12)
    day   = random.randint(1, 28)
    hour  = random.choice([8,9,10,11,13,14,15,16])
    apt_dt = datetime.datetime(2025, month, day, hour, random.choice([0,30]), 0)
    pid  = random.choice(ALL_PIDS)
    did  = random.choice(DOCTORS)
    sid  = random.choice(SVC_IDS)
    st   = random.choice(STATUSES_PAST)
    code = f'APT-{apt_dt.strftime("%Y%m%d")}-{apt_num:04d}'
    cur.execute("""INSERT INTO appointment
        (code,patientName,patientPhone,patientDob,patientGender,
         doctorId,serviceId,patientId,appointmentDate,status,
         createdBy,note,createdAt,updatedAt)
        SELECT %s,p.fullName,p.phone,p.dateOfBirth,p.gender,
               %s,%s,%s,%s,%s,%s,'Khám định kỳ 2025',NOW(),NOW()
        FROM patient p WHERE p.id=%s""",
        (code,did,sid,pid,apt_dt,st,ADMIN_ID,pid))
    apt_batch.append((cur.lastrowid, pid, did, apt_dt, sid, st))
    added_apt += 1

# 2026 future: 100 cái (July–Dec)
for _ in range(100):
    apt_num += 1
    month = random.randint(7, 12)
    day   = random.randint(1, 28)
    hour  = random.choice([8,9,10,11,13,14,15,16])
    apt_dt = datetime.datetime(2026, month, day, hour, random.choice([0,30]), 0)
    pid  = random.choice(ALL_PIDS)
    did  = random.choice(DOCTORS)
    sid  = random.choice(SVC_IDS)
    st   = random.choice(STATUSES_FUTURE)
    code = f'APT-{apt_dt.strftime("%Y%m%d")}-{apt_num:04d}'
    cur.execute("""INSERT INTO appointment
        (code,patientName,patientPhone,patientDob,patientGender,
         doctorId,serviceId,patientId,appointmentDate,status,
         createdBy,note,createdAt,updatedAt)
        SELECT %s,p.fullName,p.phone,p.dateOfBirth,p.gender,
               %s,%s,%s,%s,%s,%s,'Lịch hẹn tương lai',NOW(),NOW()
        FROM patient p WHERE p.id=%s""",
        (code,did,sid,pid,apt_dt,st,ADMIN_ID,pid))
    apt_batch.append((cur.lastrowid, pid, did, apt_dt, sid, st))
    added_apt += 1

conn.commit()
print(f"  + {added_apt} lịch hẹn thêm mới")

# ─── 3. RECEPTIONS TỪ LỊCH HẸN 2024/2025 ────────────────────────────────────
print("\n[3] Receptions từ lịch hẹn 2024/2025...")

cur.execute("SELECT appointmentId FROM reception WHERE appointmentId IS NOT NULL")
used_apt = {r[0] for r in cur.fetchall()}

cur.execute("SELECT code FROM reception ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
rec_num = int(row[0].split('-')[-1]) if row else 0

VISIT_R = ['NEW_EXAM','REVISIT','TREATMENT','SCALING','CONSULTATION','BRACES']
REC_STATUS_BY_APT = {
    'COMPLETED': 'COMPLETED',
    'CHECKED_IN': 'IN_TREATMENT',
    'IN_PROGRESS': 'IN_TREATMENT',
    'ABSENT': 'ABSENT',
}

added_rec = 0
rec_batch = []

for (apt_id, pid, did, apt_dt, sid, apt_st) in apt_batch:
    if apt_id in used_apt:
        continue
    if apt_st not in ('COMPLETED','CHECKED_IN','IN_PROGRESS','ABSENT'):
        continue
    rec_num += 1
    date_key = apt_dt.strftime('%Y%m%d')
    # Tránh trùng số trong ngày
    code = f'TD-{date_key}-{rec_num:04d}'
    rec_st = REC_STATUS_BY_APT.get(apt_st, 'WAITING')
    chair  = random.choice(CHAIR_IDS)
    rec_id_user = random.choice(RECEPTIONISTS)
    vr = random.choice(VISIT_R)
    cur.execute("""INSERT INTO reception
        (code,patientId,appointmentId,receptionistId,doctorId,
         chairId,arrivedAt,visitReason,status,queuePriority,
         createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,5,NOW(),NOW())""",
        (code,pid,apt_id,rec_id_user,did,chair,apt_dt,vr,rec_st))
    rec_id = cur.lastrowid
    rec_batch.append((rec_id, pid, did, apt_dt, rec_st, sid))
    used_apt.add(apt_id)
    added_rec += 1

# ─── Walk-in receptions 2024/2025 (200 cái) ──────────────────────────────────
for _ in range(200):
    rec_num += 1
    year  = random.choice([2024, 2024, 2025, 2025, 2025])
    month = random.randint(1, 12)
    day   = random.randint(1, 28)
    hour  = random.randint(7, 17)
    arrived = datetime.datetime(year, month, day, hour, random.randint(0,59), 0)
    pid   = random.choice(ALL_PIDS)
    did   = random.choice(DOCTORS)
    sid   = random.choice(SVC_IDS)
    date_key = arrived.strftime('%Y%m%d')
    code  = f'TD-{date_key}-{rec_num:04d}'
    rec_st = random.choice(['COMPLETED','COMPLETED','COMPLETED','WAITING_PAYMENT','ABSENT'])
    chair  = random.choice(CHAIR_IDS)
    rec_id_user = random.choice(RECEPTIONISTS)
    vr = random.choice(VISIT_R)
    cur.execute("""INSERT INTO reception
        (code,patientId,receptionistId,doctorId,
         chairId,arrivedAt,visitReason,status,queuePriority,
         createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,5,NOW(),NOW())""",
        (code,pid,rec_id_user,did,chair,arrived,vr,rec_st))
    rec_id = cur.lastrowid
    rec_batch.append((rec_id, pid, did, arrived, rec_st, sid))
    added_rec += 1

conn.commit()
print(f"  + {added_rec} receptions thêm mới")

# ─── 4. DENTAL RECORDS CHO RECEPTIONS MỚI ────────────────────────────────────
print("\n[4] Dental records...")

cur.execute("SELECT receptionId FROM dental_record")
used_dr_rec = {r[0] for r in cur.fetchall()}

cur.execute("SELECT code FROM dental_record ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
dr_num = int(row[0].split('-')[-1]) if row else 0

ICD10 = [
    ('K02.0','Sâu răng ở men'),
    ('K02.1','Sâu răng đến ngà'),
    ('K02.2','Sâu răng đến tủy'),
    ('K04.0','Viêm tủy cấp'),
    ('K04.1','Hoại tử tủy răng'),
    ('K05.0','Viêm nướu cấp tính'),
    ('K05.1','Viêm nướu mạn tính'),
    ('K05.2','Viêm nha chu cấp tính'),
    ('K05.3','Viêm nha chu mạn tính'),
    ('K06.1','Phì đại nướu'),
    ('K07.2','Răng mọc lệch – khớp cắn sai'),
    ('K08.0','Mất răng do nhổ'),
    ('K08.1','Mất răng do tai nạn'),
    ('K10.3','Viêm xương hàm'),
]
SYMPTOMS_LIST = [
    'Đau nhói khi tiếp xúc thức ăn nóng lạnh, ngọt',
    'Ê buốt kéo dài, đau lan lên vùng thái dương',
    'Chảy máu nướu thường xuyên khi chải răng',
    'Răng bị sâu lớn, vỡ mẻ một phần lớn',
    'Sưng nướu, có dịch mủ xung quanh chân răng',
    'Đau hàm, khó há miệng, nghe tiếng click',
    'Răng lung lay độ 1-2, nướu tụt',
    'Nhức răng về đêm, không ngủ được',
    'Hôi miệng nặng dù vệ sinh răng miệng đúng cách',
    'Mất răng gây khó nhai, ảnh hưởng thẩm mỹ',
]
AFTERTCARE = [
    'Súc miệng nước muối ấm 2-3 lần/ngày. Tránh ăn đồ cứng, dính trong 24h.',
    'Uống thuốc giảm đau theo đơn nếu cần. Tái khám sau 1 tuần.',
    'Không ăn uống trong 2 giờ sau điều trị. Giữ vệ sinh tốt.',
    'Đeo máng nhai ban đêm. Hạn chế ăn đồ cứng.',
    'Chải răng nhẹ nhàng vùng điều trị. Dùng chỉ nha khoa hằng ngày.',
    'Tránh thức ăn quá nóng hoặc lạnh. Tái khám 3 tháng/lần.',
]
TOOTH_NUMBERS = ['11','12','13','14','15','16','17','21','22','23','24','25','26','27',
                 '31','32','33','34','35','36','37','41','42','43','44','45','46','47',
                 'Hàm trên','Hàm dưới','Toàn hàm']

added_dr = 0
dr_batch = []

for (rec_id, pid, did, arrived, rec_st, sid) in rec_batch:
    if rec_id in used_dr_rec:
        continue
    if rec_st not in ('COMPLETED','WAITING_PAYMENT','IN_TREATMENT'):
        continue
    dr_num += 1
    date_key = arrived.strftime('%Y%m%d') if hasattr(arrived,'strftime') else TODAY.strftime('%Y%m%d')
    code = f'HR-{date_key}-{dr_num:04d}'
    icd  = random.choice(ICD10)
    sym  = random.choice(SYMPTOMS_LIST)
    afc  = random.choice(AFTERTCARE)
    dr_st = 'SIGNED' if rec_st == 'COMPLETED' else 'DRAFT'
    signed_at = (arrived + datetime.timedelta(hours=1)) if dr_st == 'SIGNED' else None
    follow_up = None
    if rec_st == 'COMPLETED' and random.random() > 0.4:
        follow_up = (arrived + datetime.timedelta(days=random.randint(7,90))).date()

    cur.execute("""INSERT INTO dental_record
        (code,receptionId,patientId,doctorId,
         visitReason,symptoms,icd10Code,icd10Description,
         clinicalNotes,aftercareNotes,followUpDate,
         status,signedAt,createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())""",
        (code,rec_id,pid,did,
         f'Bệnh nhân {random.choice(["đến khám","tái khám","điều trị theo kế hoạch"])}',
         sym, icd[0], icd[1],
         f'Phát hiện {icd[1].lower()}. Đã thực hiện {random.choice(["trám","nhổ","điều trị tủy","cạo vôi","tư vấn"])}.',
         afc, follow_up, dr_st, signed_at))
    dr_id = cur.lastrowid
    used_dr_rec.add(rec_id)

    # 1-3 dịch vụ mỗi bệnh án
    n_svc = random.randint(1, 3)
    used_svc = set()
    for _ in range(n_svc):
        s = random.choice(SVC_IDS)
        if s in used_svc: continue
        used_svc.add(s)
        tooth = random.choice(TOOTH_NUMBERS)
        price_row = svc_price_map.get(s)
        unit_p = price_row[1] if price_row else 300000
        qty = 1
        cur.execute("""INSERT INTO dental_record_service
            (recordId,serviceId,toothNumber,unitPrice,quantity,note)
            VALUES (%s,%s,%s,%s,%s,'Điều trị theo chỉ định bác sĩ')""",
            (dr_id, s, tooth, unit_p, qty))

    dr_batch.append((dr_id, rec_id, pid, did, sid, arrived, dr_st))
    added_dr += 1

conn.commit()
print(f"  + {added_dr} dental records thêm mới")

# ─── 5. INVOICES CHO DENTAL RECORDS MỚI ─────────────────────────────────────
print("\n[5] Invoices...")

cur.execute("SELECT dentalRecordId FROM invoice")
used_inv_dr = {r[0] for r in cur.fetchall()}
cur.execute("SELECT receptionId FROM invoice")
used_inv_rec = {r[0] for r in cur.fetchall()}

cur.execute("SELECT code FROM invoice ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
inv_num = int(row[0].split('-')[-1]) if row else 0

PAY_METHODS = ['CASH','CASH','CASH','CARD','CARD','MOMO','VNPAY','ZALOPAY']
DISC_RATES  = [0,0,0,0,5,10,15,20]

added_inv = 0

for (dr_id, rec_id, pid, did, sid, arrived, dr_st) in dr_batch:
    if dr_id in used_inv_dr or rec_id in used_inv_rec:
        continue

    # Tổng dịch vụ
    cur.execute("""SELECT SUM(unitPrice*quantity) FROM dental_record_service WHERE recordId=%s""", (dr_id,))
    row = cur.fetchone()
    subtotal = int(row[0] or 0)
    if subtotal == 0:
        continue

    disc_pct = random.choice(DISC_RATES)
    disc_amt = int(subtotal * disc_pct / 100)
    total    = subtotal - disc_amt
    bhyt     = int(total * random.choice([0,0,0,0.1,0.3])) if random.random()>0.85 else 0

    inv_num += 1
    date_key = arrived.strftime('%Y%m%d') if hasattr(arrived,'strftime') else TODAY.strftime('%Y%m%d')
    code = f'HD-{date_key}-{inv_num:04d}'

    inv_st  = 'PAID' if dr_st == 'SIGNED' else random.choice(['WAITING_PAYMENT','PAID'])
    paid_at = (arrived + datetime.timedelta(hours=random.randint(1,4))) if inv_st == 'PAID' else None
    method  = random.choice(PAY_METHODS) if inv_st == 'PAID' else None
    conf_by = ADMIN_ID if inv_st == 'PAID' else None

    cur.execute("""INSERT INTO invoice
        (code,receptionId,dentalRecordId,patientId,doctorId,
         subtotal,discountAmount,discountPct,totalAmount,bhytAmount,
         paymentMethod,paidAt,status,confirmedBy,
         createdAt,updatedAt)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())""",
        (code,rec_id,dr_id,pid,did,
         subtotal,disc_amt,disc_pct,total,bhyt,
         method,paid_at,inv_st,conf_by))
    inv_id = cur.lastrowid

    # Invoice items (từ dental_record_service)
    cur.execute("""SELECT drs.serviceId, s.name, drs.toothNumber, drs.unitPrice, drs.quantity
                   FROM dental_record_service drs JOIN service s ON s.id=drs.serviceId
                   WHERE drs.recordId=%s""", (dr_id,))
    for srow in cur.fetchall():
        amt = srow[3] * srow[4]
        cur.execute("""INSERT INTO invoice_item
            (invoiceId,serviceId,serviceName,toothNumber,unitPrice,quantity,bhytCovered,amount)
            VALUES (%s,%s,%s,%s,%s,%s,0,%s)""",
            (inv_id,srow[0],srow[1],srow[2],srow[3],srow[4],amt))

    used_inv_dr.add(dr_id)
    used_inv_rec.add(rec_id)
    added_inv += 1

conn.commit()
print(f"  + {added_inv} invoices thêm mới")

# ─── 6. PAYSLIPS 2024 ────────────────────────────────────────────────────────
print("\n[6] Payslips 2024 (12 tháng)...")

cur.execute("SELECT userId, month FROM payslip")
existing_ps = {(r[0],r[1]) for r in cur.fetchall()}

def get_hourly_rate_for(month_str):
    cur.execute("""SELECT amount FROM hourlyrate
                   WHERE startDate <= %s ORDER BY startDate DESC LIMIT 1""",
                (month_str + '-28',))
    r = cur.fetchone()
    return r[0] if r else 200000

def get_fixed_sal(uid, month_str):
    cur.execute("""SELECT amount FROM fixedsalary
                   WHERE userId=%s AND startDate <= %s ORDER BY startDate DESC LIMIT 1""",
                (uid, month_str+'-28'))
    r = cur.fetchone()
    return r[0] if r else 7000000

def get_allow_total(role, month_str):
    cur.execute("""SELECT COALESCE(SUM(amount),0) FROM allowance
                   WHERE (appliesTo=%s OR appliesTo='BOTH')
                   AND startDate <= %s""", (role, month_str+'-28'))
    return cur.fetchone()[0] or 0

ALL_STAFF_ROLES = {
    'DOCTOR':       [(uid,'DOCTOR')      for uid in DOCTORS],
    'RECEPTIONIST': [(uid,'RECEPTIONIST') for uid in RECEPTIONISTS],
    'ACCOUNTANT':   [(uid,'ACCOUNTANT')  for uid in ACCOUNTANTS],
}
MONTHS_2024 = [f'2024-{m:02d}' for m in range(1,13)]
MONTHS_2026_REST = [f'2026-{m:02d}' for m in range(7,13)]

added_ps = 0
for months in [MONTHS_2024, MONTHS_2026_REST]:
    for role_grp, pairs in ALL_STAFF_ROLES.items():
        for (uid, role) in pairs:
            for month in months:
                if (uid, month) in existing_ps:
                    continue
                if role == 'DOCTOR':
                    sessions  = random.randint(14, 23)
                    hours     = round(sessions * random.uniform(5.5, 8.5), 2)
                    rate      = get_hourly_rate_for(month)
                    sal_amt   = int(hours * rate)
                    allowance = 0
                    deduction = random.randint(0, 300000)
                else:
                    sessions  = None
                    hours     = None
                    sal_amt   = get_fixed_sal(uid, month)
                    allowance = int(get_allow_total(role, month))
                    deduction = random.randint(0, 400000)
                net = sal_amt + allowance - deduction
                ps_st = 'FINALIZED' if month < '2026-05' else ('APPROVED' if month < '2026-06' else 'DRAFT')
                cur.execute("""INSERT INTO payslip
                    (userId,month,role,sessionCount,hoursWorked,
                     salaryAmount,allowance,deduction,netSalary,
                     status,note,createdBy,createdAt,updatedAt)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())""",
                    (uid,month,role,sessions,hours,
                     sal_amt,allowance,deduction,net,
                     ps_st,f'Phiếu lương {month}',ADMIN_ID))
                existing_ps.add((uid,month))
                added_ps += 1

conn.commit()
print(f"  + {added_ps} payslips thêm mới")

# ─── 7. DOCTOR SCHEDULES 2024/2025 ───────────────────────────────────────────
print("\n[7] Doctor schedules 2024/2025 (lấy mẫu đại diện)...")

cur.execute("SELECT doctorId, shiftId, workDate FROM doctorschedule")
existing_sched = {(r[0],r[1],r[2].strftime('%Y-%m-%d') if hasattr(r[2],'strftime') else str(r[2])[:10])
                  for r in cur.fetchall()}

SHIFT_IDS = [1,2,3]
doctor_shift_map = {
    4:  [1,1,2,1,2],
    7:  [1,1,2,1,2],
    8:  [2,1,1,2,1],
    14: [1,2,1,2,1],
    16: [2,2,1,1,2],
}

cur.execute("SELECT id, doctorId FROM servicegroupdoctor")
doc_sg = {}
for r in cur.fetchall():
    doc_sg[r[1]] = r[0]

added_sched = 0
# Sample: 1 week per month for 2024 and 2025
for year in [2024, 2025]:
    for month in range(1, 13):
        # Pick 2nd Monday of month
        first = datetime.date(year, month, 1)
        dow = first.weekday()  # 0=Mon
        first_mon = first + datetime.timedelta(days=(7-dow)%7)
        second_mon = first_mon + datetime.timedelta(days=7)
        # 5-day week
        for d_offset in range(5):
            work_date = second_mon + datetime.timedelta(days=d_offset)
            dow_idx = d_offset
            for did in DOCTORS:
                shifts_for = doctor_shift_map.get(did, [1,2,1,2,1])
                shift_id = shifts_for[dow_idx]
                key = (did, shift_id, work_date.strftime('%Y-%m-%d'))
                if key in existing_sched:
                    continue
                # get sg
                cur.execute("SELECT serviceGroupId FROM servicegroupdoctor WHERE doctorId=%s LIMIT 1", (did,))
                sg_row = cur.fetchone()
                sg_id = sg_row[0] if sg_row else None
                try:
                    cur.execute("""INSERT INTO doctorschedule
                        (doctorId,shiftId,workDate,serviceGroupId,isOverride,createdBy,createdAt,updatedAt)
                        VALUES (%s,%s,%s,%s,0,%s,NOW(),NOW())""",
                        (did,shift_id,work_date,sg_id,ADMIN_ID))
                    existing_sched.add(key)
                    added_sched += 1
                except Exception:
                    pass

conn.commit()
print(f"  + {added_sched} doctor schedules 2024/2025")

# ─── 8. SMS LOGS ─────────────────────────────────────────────────────────────
print("\n[8] SMS logs...")

SMS_TYPES = ['APPOINTMENT_REMINDER','APPOINTMENT_CONFIRMED','APPOINTMENT_CANCELLED',
             'CHECKIN_CONFIRM','BIRTHDAY_WISH','FOLLOWUP_REMINDER']
SMS_CONTENTS = {
    'APPOINTMENT_REMINDER':  'Phòng khám nhắc lịch hẹn của quý khách vào ngày mai. Vui lòng đến đúng giờ.',
    'APPOINTMENT_CONFIRMED': 'Lịch hẹn của quý khách đã được xác nhận thành công.',
    'APPOINTMENT_CANCELLED': 'Lịch hẹn của quý khách đã bị hủy. Liên hệ 1900xxxx để đặt lại.',
    'CHECKIN_CONFIRM':       'Quý khách đã check-in thành công. Vui lòng chờ tên được gọi.',
    'BIRTHDAY_WISH':         'Phòng khám chúc mừng sinh nhật quý khách! Tặng voucher giảm 10%.',
    'FOLLOWUP_REMINDER':     'Nhắc nhở tái khám theo lịch hẹn của bác sĩ. Liên hệ để đặt lịch.',
}
SMS_STATUSES = ['SENT','SENT','SENT','FAILED','PENDING']

cur.execute("SELECT COUNT(*) FROM smslog")
existing_sms = cur.fetchone()[0]
added_sms = 0

if existing_sms < 200:
    cur.execute("SELECT fullName, phone FROM patient ORDER BY RAND() LIMIT 100")
    patients_for_sms = cur.fetchall()
    for (pname, pphone) in patients_for_sms:
        for _ in range(random.randint(1,3)):
            stype = random.choice(SMS_TYPES)
            st    = random.choice(SMS_STATUSES)
            days_ago = random.randint(1, 365)
            sent_at = (NOW - datetime.timedelta(days=days_ago)) if st == 'SENT' else None
            cur.execute("""INSERT INTO smslog
                (recipientName,phone,type,status,content,retryCount,sentAt,createdAt)
                VALUES (%s,%s,%s,%s,%s,0,%s,NOW())""",
                (pname,pphone,stype,st,SMS_CONTENTS[stype],sent_at))
            added_sms += 1

conn.commit()
print(f"  + {added_sms} SMS logs")

# ─── 9. SYSTEM LOGS ──────────────────────────────────────────────────────────
print("\n[9] System logs...")

LOG_ACTIONS = [
    ('LOGIN','Đăng nhập hệ thống','AUTH'),
    ('LOGOUT','Đăng xuất','AUTH'),
    ('CREATE_PATIENT','Tạo mới bệnh nhân','PATIENT'),
    ('UPDATE_PATIENT','Cập nhật thông tin bệnh nhân','PATIENT'),
    ('CREATE_APPOINTMENT','Đặt lịch hẹn mới','APPOINTMENT'),
    ('UPDATE_APPOINTMENT','Cập nhật lịch hẹn','APPOINTMENT'),
    ('CHECKIN','Tiếp đón bệnh nhân','RECEPTION'),
    ('CREATE_DENTAL_RECORD','Tạo bệnh án','DENTAL_RECORD'),
    ('SIGN_DENTAL_RECORD','Ký xác nhận bệnh án','DENTAL_RECORD'),
    ('CREATE_INVOICE','Tạo hóa đơn','INVOICE'),
    ('PAY_INVOICE','Thanh toán hóa đơn','INVOICE'),
    ('CREATE_PAYSLIP','Tạo phiếu lương','SALARY'),
    ('APPROVE_PAYSLIP','Duyệt phiếu lương','SALARY'),
    ('VIEW_REPORT','Xem báo cáo','REPORT'),
    ('EXPORT_REPORT','Xuất báo cáo','REPORT'),
]

ALL_USER_IDS = [1,2,7,8,11,12,14,15,16,17]
cur.execute("SELECT COUNT(*) FROM systemlog")
existing_logs = cur.fetchone()[0]
added_logs = 0

if existing_logs < 1000:
    need = 600
    for _ in range(need):
        action_row = random.choice(LOG_ACTIONS)
        uid = random.choice(ALL_USER_IDS)
        days_ago = random.randint(0, 365)
        log_dt = NOW - datetime.timedelta(days=days_ago, hours=random.randint(0,23))
        ip = f'192.168.1.{random.randint(1,254)}'
        cur.execute("""INSERT INTO systemlog (userId,action,detail,ip,module,status,createdAt)
                       VALUES (%s,%s,%s,%s,%s,'SUCCESS',%s)""",
                    (uid, action_row[0], action_row[1], ip, action_row[2], log_dt))
        added_logs += 1

conn.commit()
print(f"  + {added_logs} system logs")

# ─── TỔNG KẾT ────────────────────────────────────────────────────────────────
print("\n=== TỔNG KẾT SEED MORE ===")
TABLES = [
    ('patient','Bệnh nhân'),('appointment','Lịch hẹn'),
    ('reception','Tiếp đón'),('dental_record','Bệnh án'),
    ('invoice','Hóa đơn'),('dental_record_service','Dịch vụ bệnh án'),
    ('invoice_item','Chi tiết hóa đơn'),('payslip','Phiếu lương'),
    ('doctorschedule','Lịch trực bác sĩ'),('smslog','SMS log'),
    ('systemlog','System log'),
]
for (tbl, label) in TABLES:
    cur.execute(f'SELECT COUNT(*) FROM `{tbl}`')
    print(f"  {label:25s}: {cur.fetchone()[0]:>6}")

conn.close()
print("\n✅ SEED MORE HOÀN THÀNH!")
