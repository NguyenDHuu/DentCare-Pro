import sys, io, pymysql
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
conn = pymysql.connect(host='localhost', user='root', password='123456',
                       database='dental_clinic', charset='utf8mb4')
cur = conn.cursor()
cur.execute("DESCRIBE reception")
for r in cur.fetchall():
    print(r)
conn.close()
