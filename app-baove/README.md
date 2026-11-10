# PARK/OPS Mobile

Ứng dụng Expo/React Native dành cho hai vai trò `RESIDENT` và `GUARD`, kết nối trực tiếp backend tại `/api/v1`.

## Chạy ứng dụng

```bash
npm install
npm start
```

Tạo `.env.local` từ `.env.example`. Android Emulator dùng `http://10.0.2.2:4000/api/v1`; thiết bị thật phải thay bằng IP LAN của máy chạy backend.

Tài khoản demo (mật khẩu chung `Parking@123`):

- Cư dân: `resident1@parking.local`
- Bảo vệ: `guard1@parking.local`

## Kiến trúc

`Screen → component/hook → API service → Axios → Backend → MySQL`

- `src/store/AuthContext.jsx`: phiên đăng nhập, SecureStore, kiểm tra role và logout.
- `src/api/axiosClient.js`: Bearer token, refresh-token rotation và chuẩn hóa lỗi.
- `src/api/mobile.api.js`: toàn bộ endpoint Resident/Guard.
- `src/screens/resident`: luồng cư dân.
- `src/screens/guard`: scanner và nghiệp vụ bảo vệ.
- `src/components`: design system và trạng thái dùng chung.

## Nghiệp vụ quan trọng

- QR hiển thị từ `GET /tickets/:id/qr`, không tự tạo nội dung ở frontend.
- Bảo vệ chọn bãi/cổng, nhập biển số quan sát, quét QR và xác nhận đã đối chiếu trước khi ghi lượt. Kiểm tra ra bãi dùng `mode: OUT`: cho xe ra khi vé vừa hết hạn, không cho xe hết hạn vào lại. Mất QR hoặc vé khóa cần quản lý xác minh tại Admin → Lượt ra vào.
- Báo mất gọi server để đổi token và khóa vé; QR cũ hết hiệu lực. Tạo lại QR mở vé bằng token mới.
- Backend tiếp tục kiểm tra quyền và phạm vi sở hữu; frontend role routing không thay thế authorization server.
- Thanh toán chỉ hiển thị trạng thái/hướng dẫn vì backend hiện chỉ cho Manager/Admin xác nhận thanh toán.

## Kiểm tra

```bash
npm run doctor
npm run build:check
npm run test:api
```

Design reference nằm tại `src/assets/design-reference`. Chúng chỉ phục vụ định hướng thiết kế, không được đóng gói vào runtime.
- Gia hạn chỉ áp dụng vé hoạt động hoặc đã hết hạn; phải xử lý khóa trước khi gia hạn. Ngày đăng ký theo múi giờ Việt Nam. Giá dự kiến áp dụng giá bãi (nếu có), nhân số tháng; số tiền chốt nằm trên hồ sơ máy chủ.
- Bảo vệ tra phương tiện theo biển số khi lập biên bản; không phải tự nhập ID nội bộ. Phương tiện chưa có hồ sơ cần quản lý xác minh trước.
