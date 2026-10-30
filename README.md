# DentCare Pro — Hệ thống Quản lý Phòng khám Nha khoa

Ứng dụng quản lý phòng khám nha khoa gồm hai phần: **Backend** (Node.js + Express + Prisma + MySQL) và **Frontend** (React + TypeScript + Vite).

---

## Yêu cầu cài đặt

Đảm bảo máy bạn đã có các công cụ sau trước khi bắt đầu:

| Công cụ | Phiên bản tối thiểu | Tải về |
|---------|---------------------|--------|
| Node.js | 18.x trở lên | https://nodejs.org |
| MySQL | 8.0 trở lên | https://dev.mysql.com/downloads |
| Git | Bất kỳ | https://git-scm.com |

---

## Bước 1 — Clone dự án

```bash
git clone https://github.com/NhungVu248/dental-clinic.git
cd dental-clinic
```

---

## Bước 2 — Cài đặt Backend

### 2.1 Di chuyển vào thư mục backend

```bash
cd backend
```

### 2.2 Cài đặt các gói

```bash
npm install
```

### 2.3 Tạo file cấu hình môi trường

Sao chép file mẫu và điền thông tin của bạn:

```bash
cp .env.example .env
```

Mở file `.env` và chỉnh sửa các giá trị:

```env
# Kết nối MySQL — thay đúng user/password/tên database của bạn
DATABASE_URL="mysql://root:your_password@localhost:3306/dental_clinic"

# JWT — đặt chuỗi bí mật ngẫu nhiên, ít nhất 64 ký tự
JWT_SECRET="thay_bang_chuoi_bi_mat_cua_ban_it_nhat_64_ky_tu_vd_abc123xyz"
JWT_EXPIRES_IN="7d"

# Server
PORT=5000
CLIENT_URL="http://localhost:5173"

# Email SMTP (Gmail) — dùng App Password nếu tài khoản bật xác thực 2 bước
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your_email@gmail.com"
SMTP_PASS="your_app_password"
SMTP_FROM="DentCare Pro <your_email@gmail.com>"
```

> **Lưu ý tạo App Password Gmail:**
> Google Account → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng → Tạo mới

### 2.4 Tạo database MySQL

Mở MySQL và chạy lệnh sau:

```sql
CREATE DATABASE dental_clinic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2.5 Đồng bộ schema database

```bash
npx prisma db push
```

Lệnh này sẽ tự động tạo tất cả các bảng trong database theo schema đã định nghĩa.

### 2.6 Chạy server backend

```bash
npm run dev
```

Server sẽ khởi động tại: `http://localhost:5000`

Kiểm tra server hoạt động:

```bash
curl http://localhost:5000/health
# Kết quả: {"status":"OK"}
```

---

## Bước 3 — Cài đặt Frontend

Mở terminal **mới** (giữ nguyên terminal backend đang chạy), sau đó:

### 3.1 Di chuyển vào thư mục frontend

```bash
# Từ thư mục gốc dental-clinic
cd frontend
```

### 3.2 Cài đặt các gói

```bash
npm install
```

### 3.3 Chạy server frontend

```bash
npm run dev
```

Frontend sẽ khởi động tại: `http://localhost:5173`

---

## Bước 4 — Thiết lập lần đầu

1. Mở trình duyệt và truy cập `http://localhost:5173`
2. Hệ thống sẽ tự chuyển đến trang **Cài đặt ban đầu** (`/setup`)
3. Tạo tài khoản **Admin** đầu tiên với họ tên, tên đăng nhập, email và mật khẩu
4. Đăng nhập và bắt đầu sử dụng

---

## Cấu trúc dự án


## Các lệnh thường dùng

### Backend

```bash
npm run dev          # Chạy development server (nodemon)
npm run build        # Build TypeScript sang JavaScript
npm start            # Chạy production server

npx prisma db push   # Đồng bộ schema lên database
npx prisma studio    # Mở giao diện quản lý database trực quan
```

### Frontend

```bash
npm run dev          # Chạy development server (Vite)
npm run build        # Build production
npm run preview      # Xem trước bản build production
```

---

## Xử lý lỗi thường gặp

### ❌ `Cannot connect to database`
- Kiểm tra MySQL đang chạy
- Kiểm tra thông tin `DATABASE_URL` trong file `.env`
- Đảm bảo database `dental_clinic` đã được tạo

### ❌ `Invalid JWT secret`
- `JWT_SECRET` phải có ít nhất 64 ký tự
- Không được để trống hoặc dùng giá trị mặc định

### ❌ `SMTP connection failed`
- Kiểm tra `SMTP_USER` và `SMTP_PASS` trong `.env`
- Gmail yêu cầu **App Password** (không dùng mật khẩu đăng nhập thường)
- Cho phép "Less secure app access" hoặc dùng App Password

### ❌ `Port 5000 already in use`
- Đổi `PORT=5001` trong `.env` backend
- Cập nhật `CLIENT_URL` trong `.env` nếu cần

### ❌ Frontend báo lỗi kết nối API
- Đảm bảo backend đang chạy tại `http://localhost:5000`
- Kiểm tra `CLIENT_URL` trong `.env` backend khớp với địa chỉ frontend

---

## Công nghệ sử dụng

**Backend**
- [Node.js](https://nodejs.org) + [Express 5](https://expressjs.com)
- [Prisma ORM](https://prisma.io) + MySQL
- [JWT](https://jwt.io) + bcryptjs
- Nodemailer (SMTP)
- TypeScript

**Frontend**
- [React 19](https://react.dev) + TypeScript
- [Vite 8](https://vitejs.dev)
- [React Router v7](https://reactrouter.com)
- [TanStack Query v5](https://tanstack.com/query)
- [Zustand](https://zustand-demo.pmnd.rs)
- [Lucide React](https://lucide.dev)
- Axios
