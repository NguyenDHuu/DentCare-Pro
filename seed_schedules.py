# -*- coding: utf-8 -*-
"""
Seed thêm phân ca (doctorschedule):
  1. Gán nhóm dịch vụ cho BS 18 (đang chưa có nhóm) -> nhóm 1 + 5
  2. Nhân bản pattern ca trực của BS 14 sang BS 18 (cho bằng các BS khác)
  3. Thêm Ca tối (shift 3) luân phiên cho cả 6 BS từ 2026-06-15 -> 2026-09-30
"""
import pymysql
from datetime import date, timedelta, datetime

c = pymysql.connect(host='localhost', user='root', password='123456',
                    db='dental_clinic', charset='utf8mb4')
cur = c.cursor()

CREATED_BY = 1

# Nhóm chuyên môn chính của mỗi BS (dùng cho serviceGroupId của ca tối)
DOC_SPECIALTY = {4: 5, 7: 2, 8: 6, 14: 3, 16: 4, 18: 5}
ALL_DOCS = [4, 7, 8, 14, 16, 18]

# ── 1. Gán nhóm dịch vụ cho BS 18 ───────────────────────────────
added_groups = 0
for gid in (1, 5):
    cur.execute("SELECT 1 FROM servicegroupdoctor WHERE doctorId=18 AND serviceGroupId=%s", (gid,))
    if not cur.fetchone():
        cur.execute("INSERT INTO servicegroupdoctor (serviceGroupId, doctorId) VALUES (%s,18)", (gid,))
        added_groups += 1
print("Nhóm dịch vụ gán thêm cho BS18:", added_groups)


def schedule_exists(doctor_id, shift_id, work_date):
    cur.execute(
        "SELECT 1 FROM doctorschedule WHERE doctorId=%s AND shiftId=%s AND DATE(workDate)=%s",
        (doctor_id, shift_id, work_date))
    return cur.fetchone() is not None


def insert_schedule(doctor_id, shift_id, work_date, group_id, note=None):
    if schedule_exists(doctor_id, shift_id, work_date):
        return False
    now = datetime.now()
    cur.execute(
        """INSERT INTO doctorschedule
           (doctorId, shiftId, workDate, serviceGroupId, note, isOverride, createdBy, createdAt, updatedAt)
           VALUES (%s,%s,%s,%s,%s,0,%s,%s,%s)""",
        (doctor_id, shift_id, datetime.combine(work_date, datetime.min.time()),
         group_id, note, CREATED_BY, now, now))
    return True


# ── 2. Nhân bản pattern BS14 -> BS18 ────────────────────────────
cur.execute("SELECT shiftId, DATE(workDate) FROM doctorschedule WHERE doctorId=14")
model_rows = cur.fetchall()
dup = 0
for shift_id, wd in model_rows:
    if insert_schedule(18, shift_id, wd, group_id=1):
        dup += 1
print("Ca trực nhân bản sang BS18:", dup)

# ── 3. Thêm Ca tối (shift 3) luân phiên ─────────────────────────
START = date(2026, 6, 15)
END   = date(2026, 9, 30)
evening = 0
d = START
day_idx = 0
while d <= END:
    if d.weekday() < 6:  # Mon..Sat (bỏ Chủ nhật)
        # 2 bác sĩ trực tối, luân phiên đều qua 6 BS
        a = ALL_DOCS[day_idx % 6]
        b = ALL_DOCS[(day_idx + 1) % 6]
        for doc in (a, b):
            if insert_schedule(doc, 3, d, group_id=DOC_SPECIALTY[doc], note="Ca tối"):
                evening += 1
        day_idx += 1
    d += timedelta(days=1)
print("Ca tối thêm mới:", evening)

c.commit()

# ── Kết quả ─────────────────────────────────────────────────────
cur.execute("SELECT doctorId, COUNT(*) FROM doctorschedule GROUP BY doctorId ORDER BY doctorId")
print("\nTổng ca trực theo BS sau khi seed:")
for r in cur.fetchall():
    print("  ", r)
cur.execute("SELECT shiftId, COUNT(*) FROM doctorschedule GROUP BY shiftId ORDER BY shiftId")
print("Theo ca:")
for r in cur.fetchall():
    print("  ", r)
c.close()
