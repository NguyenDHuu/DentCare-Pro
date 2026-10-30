
import sys
import io
import requests
import pymysql

# Hien thi tieng Viet tren PowerShell
sys.stdout = io.TextIOWrapper(
    sys.stdout.buffer,
    encoding="utf-8",
    errors="replace"
)

# Dia chi backend DentCare Pro
BASE = "http://localhost:5000"

# Cau hinh MySQL theo file .env cua du an
DB_CONFIG = {
    "host": "localhost",
    "port": 3307,
    "user": "root",
    "password": "DentCare@2026_Huu",
    "database": "dental_clinic",
    "charset": "utf8mb4",
    "connect_timeout": 5
}


def db():
    """Ket noi toi database DentCare Pro."""
    return pymysql.connect(**DB_CONFIG)


def get_token(response):
    """Lay token tu phan hoi dang nhap."""
    try:
        data = response.json()
        return data.get("token") or data.get("accessToken") or ""
    except (ValueError, AttributeError):
        return ""


def main():
    conn = None
    cur = None

    try:
        # 1. Dang nhap tai khoan admin
        print("Dang dang nhap tai khoan admin...")

        try:
            r = requests.post(
                f"{BASE}/api/auth/login",
                json={
                    "username": "testadmin_x1",
                    "password": "Admin@123"
                },
                timeout=10
            )
        except requests.RequestException as exc:
            print(f"Khong ket noi duoc backend: {exc}")
            print("Hay kiem tra backend tai http://localhost:5000")
            return

        print(f"Admin login: HTTP {r.status_code}")

        token = get_token(r)

        if not token:
            print("Khong lay duoc token admin.")
            print(f"Phan hoi server: {r.text[:500]}")
            print("Hay kiem tra tai khoan testadmin_x1 va mat khau.")
            return

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Ket noi database va tim du lieu kiem thu
        print("\nDang ket noi MySQL...")

        conn = db()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT id, fullName
            FROM patient
            WHERE isActive = 1
            LIMIT 1
            """
        )
        patient = cur.fetchone()

        cur.execute(
            """
            SELECT u.id, u.username
            FROM `user` u
            JOIN userrole ur ON u.id = ur.userId
            JOIN role ro ON ro.id = ur.roleId
            WHERE ro.name = 'RECEPTIONIST'
              AND u.isActive = 1
            LIMIT 1
            """
        )
        receptionist = cur.fetchone()

        cur.execute(
            """
            SELECT u.id
            FROM `user` u
            JOIN userrole ur ON u.id = ur.userId
            JOIN role ro ON ro.id = ur.roleId
            WHERE ro.name = 'DOCTOR'
              AND u.isActive = 1
            LIMIT 1
            """
        )
        doctor = cur.fetchone()

        if not patient:
            print("Khong tim thay benh nhan dang hoat dong.")
            print("Hay kiem tra du lieu trong bang patient.")
            return

        if not receptionist:
            print("Khong tim thay tai khoan RECEPTIONIST dang hoat dong.")
            return

        if not doctor:
            print("Khong tim thay tai khoan DOCTOR dang hoat dong.")
            return

        print(f"Patient: id={patient[0]}, name={patient[1]}")
        print(
            f"Receptionist: id={receptionist[0]}, "
            f"username={receptionist[1]}"
        )
        print(f"Doctor: id={doctor[0]}")

        cur.close()
        cur = None
        conn.close()
        conn = None

        # 3. Dat lai mat khau tai khoan le tan bang API admin
        # Luu y: thao tac nay se thay doi mat khau tai khoan kiem thu.
        print("\nDang dat lai mat khau tai khoan le tan...")

        reset_response = requests.post(
            f"{BASE}/api/auth/users/{receptionist[0]}/reset-password",
            json={"newPassword": "Test@12345"},
            headers=headers,
            timeout=10
        )

        print(
            "Reset password: "
            f"HTTP {reset_response.status_code}"
        )

        # 4. Dang nhap tai khoan le tan
        login_response = requests.post(
            f"{BASE}/api/auth/login",
            json={
                "username": receptionist[1],
                "password": "Test@12345"
            },
            timeout=10
        )

        receptionist_token = get_token(login_response)

        print(
            "Receptionist login: "
            f"HTTP {login_response.status_code}"
        )

        if receptionist_token:
            reception_headers = {
                "Authorization": f"Bearer {receptionist_token}"
            }
        else:
            print(
                "Khong dang nhap duoc bang tai khoan le tan. "
                "Thu su dung token admin de kiem tra API."
            )
            reception_headers = headers

        # 5. Goi API check-in
        payload = {
            "patientId": patient[0],
            "doctorId": doctor[0],
            "visitReason": "TREATMENT"
        }

        print("\nDang gui yeu cau check-in...")

        response = requests.post(
            f"{BASE}/api/reception/checkin",
            json=payload,
            headers=reception_headers,
            timeout=15
        )

        print(f"\nCheck-in -> HTTP {response.status_code}")
        print(f"Response: {response.text[:500]}")

        if response.status_code == 201:
            try:
                data = response.json()
            except ValueError:
                data = {}

            print("\nCHECK-IN THANH CONG!")
            print(f"code={data.get('code')}")
            print(f"scheduleId={data.get('scheduleId')}")
            print(f"status={data.get('status')}")

        elif response.status_code == 409:
            print(
                "\nBenh nhan co the da co luot kham trung lap. "
                "Can xem noi dung response de xac nhan."
            )

        elif response.status_code in (401, 403):
            print(
                "\nTai khoan khong du quyen hoac token khong hop le. "
                "Hay kiem tra quyen cua admin/le tan va API."
            )

        else:
            print(
                "\nCheck-in chua thanh cong. "
                "Hay dua vao ma HTTP va response phia tren de xu ly."
            )

    except pymysql.MySQLError as exc:
        print(f"Loi ket noi/truy van MySQL: {exc}")
        print(
            "Hay kiem tra MySQL dang chay o cong 3307, "
            "mat khau, database dental_clinic va cau truc bang."
        )

    except requests.RequestException as exc:
        print(f"Loi khi goi API: {exc}")

    except Exception as exc:
        print(f"Loi khong mong doi: {type(exc).__name__}: {exc}")

    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
