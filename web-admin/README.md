# PARK/OPS — Admin Web quản lý gửi xe tháng

Admin Web dành cho `ADMIN` và `MANAGER` quản lý quy trình gửi xe tháng tại chung cư. Ứng dụng gọi trực tiếp backend hiện tại qua REST API `/api/v1`, không sử dụng dữ liệu giả.

## Công nghệ

- React 19, Vite 7, React Router 7
- Axios và interceptor refresh token
- Fluent UI cho component có khả năng truy cập bàn phím
- Phosphor Icons
- GSAP cho thanh chuyển trang và hiệu ứng trên trang đăng nhập
- Playwright Core để smoke test trên Microsoft Edge

Dự án hiện hữu ban đầu dùng JavaScript/JSX nên phần phát triển tiếp tục giữ stack đó để tránh đổi nền tảng không cần thiết. JSDoc và cách tách service/component giúp dữ liệu vẫn rõ ràng, dễ chuyển sang TypeScript sau này nếu đồ án yêu cầu.

## Cấu trúc

```text
src/
├── assets/design-reference/  Concept hình ảnh dùng làm chuẩn thiết kế
├── components/common/        Bảng, badge, toolbar, form, xác nhận
├── components/layout/        Sidebar và header
├── constants/                Menu và metadata route
├── context/                  Authentication và toast
├── hooks/                    Hook gọi tài nguyên API
├── layouts/                  Khung Admin chung
├── pages/                    Mỗi module nghiệp vụ một thư mục
├── routes/                   ProtectedRoute và RoleGuard
├── services/                 Toàn bộ lời gọi Axios/API
├── utils/                    Định dạng ngày và tiền
├── App.jsx
└── main.jsx
```

Luồng dữ liệu:

```text
Page → service API → Axios interceptor → Backend /api/v1 → Prisma → MySQL
```

Component không gọi Axios trực tiếp. Business rule và quyền cuối cùng vẫn do backend quyết định.

## Chạy ứng dụng

Backend phải chạy tại `http://localhost:4000`.

```bash
npm install
npm run dev
```

Mặc định Admin Web chạy tại `http://localhost:5173`.

Tạo `.env.local` khi backend dùng địa chỉ khác:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

## Tài khoản demo

- ADMIN: `admin@parking.local`
- MANAGER: `manager1@parking.local`
- Mật khẩu demo: `Parking@123`

`RESIDENT` và `GUARD` không được vào Admin Web. Frontend kiểm tra để hỗ trợ UX; backend vẫn xác minh JWT và role trên từng API.

## Authentication

1. `/login` gửi `email/password` tới `/auth/login`.
2. Lưu access token, refresh token và thông tin hiển thị.
3. `AuthContext` gọi `/auth/me` khi tải lại trang.
4. Axios gắn Bearer token cho mọi request.
5. Khi nhận 401, interceptor dùng refresh token một lần, lưu cặp token mới và gửi lại request.
6. Nếu refresh thất bại, xóa phiên và chuyển về login.
7. Logout thu hồi refresh token tại backend.

## Module

- Dashboard vận hành và công việc chờ xử lý
- Cư dân, căn hộ, phương tiện
- Duyệt/từ chối/hủy đăng ký; ghi nhận tiền mặt/chuyển khoản thực nhận, ghi nhận hoàn toàn bộ tiền sau quyết định của quản lý
- Vé tháng, QR, khóa/mở/hủy vé
- Bãi xe và sức chứa
- Gói gửi, lịch sử bảng giá
- Lượt xe ra/vào và xác minh xe ra thủ công cho quản lý khi mất QR/vé bị khóa; phải ghi cổng và lý do
- Vi phạm và kết quả xử lý
- Thông báo của tài khoản hiện tại
- Báo cáo doanh thu, công suất, vi phạm
- Tài khoản, khóa/mở và phân quyền — chỉ ADMIN

## API backend còn thiếu

Admin Web không làm giả chức năng khi backend chưa hỗ trợ:

- Chưa có API tạo tài khoản nhân viên trực tiếp; trang Nhân viên chỉ sửa, khóa và phân quyền tài khoản đã tồn tại.
- Chưa có API tạo thông báo phát rộng; trang Thông báo hiện chỉ xem và đánh dấu đã đọc.
- API báo cáo chưa nhận bộ lọc ngày/tháng/năm, loại xe hoặc khu vực; trang Báo cáo hiển thị số tổng hợp thật và ghi rõ giới hạn.
- API xe chưa trả căn hộ của chủ xe trong danh sách nên bảng phương tiện không tự suy đoán căn hộ.

## Thiết kế

Ngôn ngữ **Swiss industrial operations**: sidebar carbon, canvas ivory, một accent cam cảnh báo, typography rộng và số liệu mono. Dashboard dùng metric strip và đường phân cách thay cho card bo tròn hàng loạt. Loading, empty, error, toast, confirm, hover, focus và reduced-motion đều có trạng thái riêng.

Hai concept gốc được lưu tại `src/assets/design-reference/` để đối chiếu khi bảo trì.

## Kiểm tra

```bash
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run test:e2e
```

Smoke test dùng backend thật để đăng nhập ADMIN và mở lần lượt 13 route quản trị. Cần Microsoft Edge hoặc đặt `BROWSER_PATH` tới Chromium/Chrome phù hợp.
## Kiểm thử nghiệp vụ xuyên ứng dụng

Từ `backend`, chạy `npm run test:system`. Lệnh tự tạo database tạm và server/cổng riêng, build Admin, kiểm tra 13 route, rồi thao tác duyệt → chuyển khoản → vé → vào bãi → chặn hoàn tiền khi còn xe → xác minh ra → hoàn tiền/thu hồi vé. Không dùng dữ liệu demo để chạy kịch bản ghi này.

## Nâng cấp giao diện v3 (chỉ phần trình bày)

Không thay đổi service, API, quyền hay luồng nghiệp vụ. Các thay đổi:

- `three` — cảnh 3D bãi xe low-poly (`src/components/visual/ParkingScene3D.jsx`) trên trang Đăng nhập và hero Tổng quan. Tải lười (chunk riêng), tự dừng khi ra khỏi màn hình/tab ẩn, tôn trọng `prefers-reduced-motion`, tự quay về ảnh tĩnh khi không có WebGL; trang Đăng nhập dùng ảnh tĩnh dưới 901 px, trang Tổng quan dùng ảnh tĩnh dưới 1100 px.
- Tổng quan ưu tiên chỉ số và bảng chờ duyệt. Số liệu hiển thị ngay khi tải xong, các thanh doanh thu giữ số tiền và số giao dịch ở màn hình nhỏ.
- Bảng lệnh **Ctrl/⌘ + K** (`CommandPalette`): tìm trang/thao tác, gõ không dấu vẫn ra, điều khiển hoàn toàn bằng bàn phím.
- Header có nút tìm nhanh và đồng hồ; thanh tiến trình mảnh khi chuyển trang; nhãn nhóm (eyebrow) tự động trên tiêu đề trang.
- Báo cáo dùng thanh ngang để đọc số liệu từng bãi. Nút “Xem mô hình 3D” tải biểu đồ cột theo yêu cầu (đỏ khi ≥ 90%). Trang 404 dùng cảnh 3D bãi xe.
- Toast có thanh đếm ngược; dialog bo góc + nền mờ; thông báo dạng thẻ; badge dạng pill; cảnh báo Caps Lock ở ô mật khẩu.
- `src/styles/ui-upgrade.css`, `src/styles/ui-upgrade-2.css` — phản hồi khi nhấn, skeleton shimmer, biển số dạng tem, tabular-nums.

Skill AI dùng cho dự án nằm trong `../.claude/skills`: threejs-*, gsap-*, emil-design-eng, animation-performance, review-animations, apple-design, web-design-guidelines.
