import sys, io, pymysql
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = pymysql.connect(host='localhost', user='root', password='123456',
                       database='dental_clinic', charset='utf8mb4')
cur = conn.cursor()

print("=== Receptionist co fixedsalary hieu luc 2026-06 ===")
cur.execute("""
    SELECT u.id, u.username, u.fullName, r.name as role,
           fs.amount, fs.startDate, fs.endDate
    FROM fixedsalary fs
    JOIN `user` u ON u.id = fs.userId
    JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId
    WHERE r.name IN ('RECEPTIONIST','ACCOUNTANT')
      AND fs.startDate <= '2026-06-15'
      AND (fs.endDate IS NULL OR fs.endDate >= '2026-06-01')
    ORDER BY u.id
""")
for row in cur.fetchall():
    print(f"  userId={row[0]}, username={row[1]}, name={row[2]}, role={row[3]}, amount={row[4]}, {row[5]} ~ {row[6]}")

print("\n=== Doctor co lichtruc thang 2026-06 ===")
cur.execute("""
    SELECT ds.doctorId, u.username, u.fullName, COUNT(*) as cnt
    FROM doctorschedule ds
    JOIN `user` u ON u.id = ds.doctorId
    WHERE YEAR(ds.workDate)=2026 AND MONTH(ds.workDate)=6
    GROUP BY ds.doctorId
""")
for row in cur.fetchall():
    print(f"  doctorId={row[0]}, username={row[1]}, name={row[2]}, shifts={row[3]}")

print("\n=== Doctor KHONG co lichtruc thang 2026-06 ===")
cur.execute("""
    SELECT u.id, u.username, u.fullName
    FROM `user` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId
    WHERE r.name = 'DOCTOR' AND u.isActive = 1
      AND u.id NOT IN (
          SELECT DISTINCT doctorId FROM doctorschedule
          WHERE YEAR(workDate)=2026 AND MONTH(workDate)=6
      )
    LIMIT 5
""")
for row in cur.fetchall():
    print(f"  userId={row[0]}, username={row[1]}, fullName={row[2]}")

print("\n=== Receptionist/Accountant KHONG co fixedsalary hieu luc 2026-06 ===")
cur.execute("""
    SELECT u.id, u.username, u.fullName, r.name as role
    FROM `user` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId
    WHERE r.name IN ('RECEPTIONIST','ACCOUNTANT')
      AND u.isActive = 1
      AND u.id NOT IN (
          SELECT userId FROM fixedsalary
          WHERE startDate <= '2026-06-15'
            AND (endDate IS NULL OR endDate >= '2026-06-01')
      )
    LIMIT 5
""")
for row in cur.fetchall():
    print(f"  userId={row[0]}, username={row[1]}, name={row[2]}, role={row[3]}")

print("\n=== Payslip hien tai 2026-06 ===")
cur.execute("""
    SELECT p.id, p.userId, u.username, p.role, p.status, p.netSalary, p.month
    FROM payslip p JOIN `user` u ON u.id = p.userId
    WHERE p.month = '2026-06'
    ORDER BY p.userId
""")
for row in cur.fetchall():
    print(f"  id={row[0]}, userId={row[1]}, username={row[2]}, role={row[3]}, status={row[4]}, net={row[5]}")

print("\n=== Hourly rate hien tai ===")
cur.execute("SELECT id, amount, startDate, endDate FROM hourlyrate ORDER BY startDate DESC LIMIT 5")
for row in cur.fetchall():
    print(f"  id={row[0]}, amount={row[1]}, {row[2]} ~ {row[3]}")

print("\n=== Receptionist co reception CANCELLED thang 2026-06 ===")
cur.execute("""
    SELECT r.id, r.status, r.doctorId, r.scheduleId
    FROM reception r
    WHERE r.status IN ('CANCELLED','ABSENT')
    LIMIT 5
""")
for row in cur.fetchall():
    print(f"  receptionId={row[0]}, status={row[1]}, doctorId={row[2]}, scheduleId={row[3]}")

conn.close()
