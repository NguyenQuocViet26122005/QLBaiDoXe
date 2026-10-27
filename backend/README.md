# Backend quản lý gửi xe tháng tại chung cư

## 1. Giới thiệu và mục tiêu

Đây là REST API cho đồ án **Phần mềm quản lý quy trình gửi xe tháng tại chung cư**. Hệ thống quản lý tài khoản, cư dân, căn hộ, xe, gói gửi xe, đăng ký, thanh toán, vé tháng, QR, lượt ra/vào, vi phạm, thông báo và báo cáo.

Mục tiêu chính là mô phỏng đúng quy trình thực tế, bảo vệ dữ liệu theo vai trò và ownership, đồng thời giữ mã nguồn đủ đơn giản để sinh viên có thể đọc, sửa và bảo vệ trước giảng viên.

## 2. Công nghệ

- Node.js + Express 5 + TypeScript
- MySQL 8 + Prisma ORM 7
- JWT access/refresh token, bcrypt
- Zod, Helmet, CORS, rate limiting
- QRCode, node-cron, Nodemailer
- Swagger/OpenAPI
- Vitest + Supertest

## 3. Kiến trúc và cấu trúc thư mục

Luồng chuẩn:

```text
HTTP request
→ route
→ authenticate/authorize + validator
→ controller
→ service
→ repository/Prisma
→ MySQL
→ response chuẩn
```

```text
src/
├── config/       Đọc env, kết nối Prisma, logger, mail và Swagger
├── constants/    Khóa và hằng số nghiệp vụ dùng chung
├── controllers/  Nhận request, gọi service, trả response; không giữ nghiệp vụ
├── middlewares/  Xác thực JWT, phân quyền, validate và xử lý lỗi tập trung
├── routes/       Khai báo URL, middleware và controller tương ứng
├── services/     Toàn bộ luật nghiệp vụ của hệ thống
├── repositories/ Truy vấn thường dùng được tách khỏi service
├── validators/   Schema Zod; chặn input sai và mass assignment
├── utils/        Lỗi, response, ngày tháng, token và normalize biển số
├── jobs/         Cron nhắc hạn, kích hoạt và hết hạn vé
├── types/        Mở rộng kiểu Request của Express
├── app.ts        Cấu hình Express, middleware, route và Swagger
└── server.ts     Mở cổng và đóng kết nối an toàn
prisma/
├── schema.prisma Mô hình 14 bảng, quan hệ, index và unique constraint
├── migrations/   Lịch sử thay đổi cấu trúc MySQL
└── seed.ts       Dữ liệu trình diễn
tests/            Integration test chạy qua HTTP API và MySQL thật
```

Việc tách như trên giúp controller mỏng, service dễ kiểm thử, route dễ nhìn quyền truy cập, còn Prisma chỉ chịu trách nhiệm giao tiếp cơ sở dữ liệu.

## 4. Cài đặt

Yêu cầu Node.js 20 trở lên, npm và MySQL 8 đang chạy.

```bash
cd backend
npm install
copy .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

API mặc định chạy ở `http://localhost:4000`. Health check ở `GET /health`, Swagger ở `http://localhost:4000/api-docs`.

## 5. Cấu hình `.env`

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng HTTP |
| `DATABASE_URL` | URL dùng bởi Prisma CLI/migration |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Kết nối runtime qua Prisma adapter |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Hai khóa khác nhau, tối thiểu 32 ký tự |
| `ACCESS_TOKEN_EXPIRES_IN` | Tuổi access token, mặc định 15 phút |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Tuổi refresh token |
| `CORS_ORIGINS` | Danh sách origin, phân cách bằng dấu phẩy |
| `SMTP_*`, `MAIL_FROM` | Cấu hình email; có thể để trống khi demo |
| `CRON_ENABLED` | Bật job tự động khi chạy server |

Không commit `.env`. Khi triển khai thật phải thay toàn bộ secret và mật khẩu mẫu.

## 6. Database, migration và seed

Tạo database/user MySQL:

```sql
CREATE DATABASE monthly_parking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'parking_user'@'localhost' IDENTIFIED BY 'parking_password';
GRANT ALL PRIVILEGES ON monthly_parking.* TO 'parking_user'@'localhost';
FLUSH PRIVILEGES;
```

Các lệnh thường dùng:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name ten_thay_doi
npm run prisma:seed
```

Seed xóa và tạo lại dữ liệu demo của database được cấu hình. Không chạy seed trên database production có dữ liệu thật.

## 7. Tài khoản demo

Mật khẩu chung: `Parking@123`

| Vai trò | Tài khoản |
|---|---|
| ADMIN | `admin@parking.local` |
| MANAGER | `manager1@parking.local`, `manager2@parking.local` |
| GUARD | `guard1@parking.local`, `guard2@parking.local` |
| RESIDENT | `resident1@parking.local` đến `resident5@parking.local` |

## 8. Nhóm API

Tất cả endpoint nghiệp vụ có prefix `/api/v1`.

- `/auth`: register, login, refresh, logout, me
- `/users`: quản lý vai trò/trạng thái, chỉ ADMIN
- `/residents`, `/apartments`, `/vehicles`: CRUD dữ liệu cơ bản
- `/plans`, `/areas`, `/prices`: cấu hình gói, bãi và bảng giá
- `/registrations`: tạo, duyệt, từ chối, hủy
- `/payments`: ghi nhận tiền mặt/chuyển khoản
- `/tickets`: xem QR, gia hạn, khóa, mở, hủy, báo mất
- `/parking`: verify QR, check-in, check-out, lịch sử
- `/violations`: lập, sửa và xử lý biên bản
- `/notifications`: danh sách, đọc một, đọc tất cả
- `/reports`: dashboard, doanh thu, bãi xe, vi phạm

Chi tiết request, parameter, mã lỗi và response xem trực tiếp trong Swagger `/api-docs`. Nhấn **Authorize** và nhập access token dạng `Bearer <token>`.

## 9. Luồng nghiệp vụ chính

```text
Cư dân đăng nhập → thêm xe → tạo đăng ký PENDING
→ MANAGER/ADMIN duyệt thành APPROVED
→ MANAGER/ADMIN ghi nhận thanh toán PAID
→ transaction tạo vé ACTIVE + token QR an toàn
→ GUARD verify QR → check-in PARKING
→ GUARD check-out → session COMPLETED
```

Gia hạn tạo đăng ký `RENEWAL`. Vé mới nối tiếp đúng thời điểm kết thúc vé cũ; vé đã hết hạn được gia hạn từ hiện tại. Vé mới chưa tới ngày bắt đầu ở trạng thái `PENDING`; hệ thống đồng bộ khi đọc/quét vé và qua job mỗi phút.

## 10. Business rules cần nhớ

- Một xe có nhiều vé trong lịch sử nhưng không được có các khoảng hiệu lực chồng lấn giữa vé `PENDING`, `ACTIVE`, `LOCKED`.
- `activeVehicleKey` unique nullable bảo vệ luật trên ngay tại database.
- Một xe chỉ có một lượt gửi mở; `openVehicleKey` và khóa giao dịch bảo vệ check-in đồng thời. Xe đỗ nhiều ngày vẫn chiếm chỗ. Lượt `ABNORMAL` cũ thiếu giờ ra cần quản lý xác minh.
- Biển số được trim, viết hoa, bỏ ký tự thừa và lưu unique dưới dạng chuẩn hóa.
- Cư dân chỉ xem/sửa xe, đăng ký, vé và vi phạm của chính mình; đây là lớp chống IDOR.
- QR chỉ chứa token ngẫu nhiên, không chứa họ tên, điện thoại hay thông tin nhạy cảm.
- Báo mất QR đổi token ngay; token cũ không thể dùng lại và vé bị khóa cho đến khi cấp lại.
- Refresh token chỉ lưu SHA-256 hash, được rotate khi refresh và thu hồi khi logout.
- Thanh toán `PAID` và tạo vé nằm trong cùng Prisma transaction.
- Job chạy lúc khởi động và mỗi phút; nhắc trước 7/3/1/0 ngày theo Việt Nam, chống gửi trùng bằng `dedupKey`. Job không tự coi xe đã ra bãi.
- API luôn trả `{ success, message, data }` hoặc `{ success, message, errorCode, errors }`.

## 11. Kiểm tra chất lượng

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check
```

Bộ integration test kiểm tra auth, refresh rotation, sai mật khẩu, ownership, phân quyền, normalize/trùng biển số, đăng ký/trùng đăng ký, approve/reject, thanh toán tạo vé, QR hợp lệ/sai/hết hạn/mất/khóa, gia hạn, check-in hai lần, check-out bất thường và xử lý vi phạm. `npm test` tạo database tạm riêng, migrate/seed và tự dọn sau chạy. Không chạy seed trên database demo sau test. Chạy `npm run test:system` để kiểm tra thêm trình duyệt Admin và API mobile trên database tạm; cần dependency của cả ba ứng dụng và Microsoft Edge. `npm run audit:data` chỉ đọc và báo bất nhất dữ liệu hiện tại.

## 12. Cách trình bày ngắn trước giảng viên

Route chỉ ánh xạ URL; middleware xác thực và phân quyền; Zod lọc input; controller chuyển tiếp dữ liệu; service giữ business rule; Prisma transaction bảo đảm dữ liệu đồng nhất; unique constraint chặn lỗi cạnh tranh; MySQL lưu lịch sử. Đây là kiến trúc monolith phân lớp, phù hợp quy mô đồ án và dễ bảo trì hơn đặt toàn bộ logic trong route.
## Quy tắc nghiệp vụ được rà soát ngày 11/10/2026

Xem `../BUSINESS_AUDIT_2026-10-11.md` để biết các quy tắc giữ chỗ, thanh toán, giá/thời hạn, xử lý mất QR, xe ra khi hết hạn và giới hạn kiểm chứng.
