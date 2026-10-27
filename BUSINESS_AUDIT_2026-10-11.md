# Rà soát nghiệp vụ gửi xe tháng — 11/10/2026

Phạm vi: API, ràng buộc database, job, các thao tác nghiệp vụ trên Admin và app cư dân/bảo vệ. Kiểm thử tích hợp sử dụng database MySQL/MariaDB tạm riêng; dữ liệu demo không bị reset hay xóa.

## Các lỗi đã sửa và hành vi hiện tại

| Nhóm | Vấn đề trước sửa | Hành vi sau sửa |
| --- | --- | --- |
| Xe gửi dài ngày | Cron đổi lượt quá 24h thành ABNORMAL và giải phóng chỗ dù xe chưa ra | Giữ lượt và sức chứa đến khi có xác minh xe ra. Không tự suy đoán xe mất lượt checkout |
| Duyệt đăng ký | Chưa tính hồ sơ đã duyệt chưa trả tiền; hai hồ sơ có thể chiếm cùng chỗ | Duyệt giữ chỗ trong khoảng thời hạn; kiểm tra công suất đỉnh của các khoảng vé/giữ chỗ, khóa bãi khi duyệt |
| Thanh toán | Không kiểm tra lại hiệu lực hồ sơ, tình trạng xe/cư dân/gói/bãi hoặc sức chứa | Kiểm tra lại trước phát hành vé; thất bại rollback giao dịch; số tiền lấy từ báo giá đã chốt |
| Hủy và thu tiền | Các bước kiểm tra rời rạc có thể tạo hồ sơ đã hủy nhưng đã thu tiền | Khóa cùng xe, bãi và hồ sơ; chỉ một thao tác được hoàn tất |
| Thanh toán lặp | Retry đồng thời có thể trả lỗi unique hoặc tạo trạng thái lệch | Cùng requestId và cùng yêu cầu trả lại giao dịch đã có; một hồ sơ chỉ có một lần phát hành vé |
| Hoàn tiền | Có thể thu lại tiền trên hồ sơ từng hoàn và nhận về vé cũ đã thu hồi | Hồ sơ hoàn tiền chuyển CANCELLED, vé REVOKED; không thu lại tiền cho cùng hồ sơ |
| Yêu cầu trùng | Sau duyệt bỏ khóa đăng ký mở dù chưa thanh toán | Giữ khóa đến khi trả tiền, hủy hoặc quá hạn; chặn đăng ký mới và gia hạn trùng |
| Gia hạn | Vé hết hạn bị từ chối vì ngày bắt đầu quá khứ; có thể tạo thời hạn chồng lấn | Gia hạn từ max(hiện tại, hết hạn vé cũ); nối tiếp không có khoảng hở; chặn chồng lấn kể cả vé tương lai |
| Vé khóa | Có thể dùng gia hạn để vượt trạng thái khóa | Vé đang khóa không được gia hạn; quản lý khóa xác minh sau báo mất sẽ ngăn cư dân tự mở lại |
| Ngày tháng | setMonth khiến 31/01 + 1 tháng tràn sang tháng 3; phụ thuộc timezone máy | Cộng tháng có chặn ngày cuối tháng, tính theo UTC+7; từ chối ngày lịch không tồn tại |
| Giá | Gói nhiều tháng vẫn chỉ tính một giá tháng | Giá mỗi tháng theo bãi ưu tiên giá chung, nhân số tháng bằng Decimal; snapshot quotedAmount giữ nguyên |
| Gói đã sử dụng | Đổi loại xe/thời hạn làm thay đổi nghĩa hồ sơ cũ | Gói đã có lịch sử không đổi loại xe/thời hạn; cần tạo gói mới |
| Bảng giá | Tạo đồng thời có thể chồng lấn; sửa giá cũ làm sai lịch sử | Khóa theo gói, kiểm tra khoảng giá; không sửa số tiền/phạm vi/ngày bắt đầu của giá đã dùng |
| Kích hoạt vé | Vé đến hạn phải chờ cron 00:05, có thể gián đoạn gần cả ngày | Đồng bộ khi lấy/quét vé và job mỗi phút; hết hạn vé cũ trước khi kích hoạt vé kế tiếp |
| Vé hết hạn trong bãi | Kiểm tra ra giống kiểm tra vào khiến xe không thể ra | Mode OUT xác minh QR và lượt đang gửi để cho ra, lưu ghi chú; vẫn từ chối vào |
| Bãi đóng/xe ngừng | QR vẫn có thể cho xe vào | Chặn lượt vào khi bãi/xe/cư dân/tài khoản ngừng hoạt động; xử lý lượt ra riêng |
| Quét trên app | Quét là ghi lượt, không xác nhận xe/bãi thực tế | Chọn bãi, nhập biển số, xác thực rồi đối chiếu và xác nhận; retry mạng dùng lại requestId |
| Xác minh thủ công | API có nhưng Admin không có thao tác; có race với checkout thường | Admin có “Xác minh xe ra”, yêu cầu cổng/lý do, lưu audit; khóa xe để chỉ đóng một lần |
| Hiệu chỉnh lượt | Có thể mở lại lượt hoặc đặt giờ ra trước giờ vào, làm lệch openVehicleKey | Không đổi giữa lượt mở/đã đóng qua hiệu chỉnh; kiểm tra thời gian, cổng và lý do |
| Mã chống lặp | Có thể dùng requestId của xe/biên bản khác và nhận nhầm kết quả | Đối chiếu xe, người thực hiện, cổng/bãi và nội dung biên bản |
| Dữ liệu QR | Danh sách lượt/vi phạm của bảo vệ chứa qrToken của người khác | Chỉ trả thông tin vé cần đối chiếu, không trả token qua danh sách |
| Xe có lịch sử | Sửa mô tả gửi kèm biển số cũ bị chặn; sửa danh tính xe làm sai lịch sử | Cho sửa mô tả/no-op; đổi biển số/loại xe đã có lịch sử cần tạo phương tiện mới |
| Biên bản | Có thể sửa mức phạt sau xử lý, ghép vé và lượt không khớp | Chặn sửa biên bản RESOLVED; xác minh liên kết xe/vé/lượt, lưu audit |
| Tài khoản | Có thể khóa/hạ quyền quản trị viên cuối; RESIDENT không hồ sơ có nguy cơ mất bộ lọc sở hữu | Giữ một ADMIN hoạt động; chặn vai trò cư dân thiếu hồ sơ; thu hồi refresh token khi đổi quyền/trạng thái |
| Căn hộ/hồ sơ | Cư dân có thể tự liên kết căn hộ và đọc danh sách căn hộ khác | Chỉ quản lý xác minh/gắn căn hộ; cư dân đọc căn hộ của mình qua hồ sơ |
| Form quản trị | Nhãn trạng thái hồ sơ dùng trạng thái vé; tạo cư dân trống số điện thoại bị lỗi | Hiển thị hồ sơ/vé/thanh toán riêng; chuẩn hóa thông tin tùy chọn trống |
| Bộ test | test:watch/Vitest trực tiếp vẫn có thể ghi vào database demo | Chặn chạy trực tiếp; npm test và test:system tạo database tên riêng, tự dọn sau chạy |

## Quy tắc vận hành đã chọn

- Khoảng hiệu lực là **[startDate, endDate)**. Vé tiếp theo bắt đầu đúng endDate vé cũ. “Một tháng” là tháng lịch theo Việt Nam, chặn vào ngày cuối tháng khi cần.
- `monthlyPrice` và `PriceConfig.amount` là đơn giá **mỗi tháng**; tổng hồ sơ = đơn giá × durationMonths. Giá theo bãi ưu tiên giá chung; effectiveTo không bao gồm thời điểm kết thúc.
- Yêu cầu chờ duyệt hoặc đã duyệt chưa trả tiền hết hạn sau 30 ngày kể từ lúc tạo (giữ chính sách sẵn có). Sau khi cấp vé không hủy hồ sơ qua nút hủy yêu cầu.
- Thu tiền trễ không trừ mất ngày sử dụng: thời hạn bắt đầu không trước thời điểm phát hành. Server kiểm tra lại sức chứa cho khoảng mới trước khi nhận thanh toán.
- Hoàn tiền là **ghi nhận quản lý đã hoàn toàn bộ tiền thực tế**, không phải lệnh chuyển khoản ngân hàng. Không hoàn khi xe còn lượt chưa ra. Hệ thống chưa tính hoàn một phần/phí theo ngày đã dùng.
- Hủy vé hoặc hoàn tiền hủy các yêu cầu gia hạn liên quan chưa được cấp vé. Vé gia hạn đã trả tiền là quyền sử dụng riêng, không bị tự ý thu hồi theo vé gốc.
- QR hết hạn cho xe đang gửi ra sau đối chiếu; không tự đặt mức phạt/quá hạn. QR mất/khóa/không xác minh được cần quản lý đối chiếu chủ xe/camera, ghi lý do.
- Lượt ABNORMAL cũ không có giờ ra được tính là chưa xác minh, không tự giải phóng chỗ. Không dùng thời gian đỗ dài để kết luận xe đã ra.
- Cư dân dùng tài khoản cư dân; nhân viên dùng tài khoản riêng để giữ quyền sở hữu và lịch sử.

## Kiểm chứng

Kết quả chạy lại ngày 11/10/2026:

- Backend: **82/82 test đạt**, typecheck, lint và build đạt.
- Web Admin: lint/build đạt; smoke đăng nhập, 13 route và trang 404 đạt.
- Trình duyệt: duyệt → chuyển khoản → cấp vé → vào bãi → chặn hoàn tiền khi xe còn trong bãi → xác minh ra → hoàn tiền/thu hồi vé đạt.
- Mobile API: 10 API cư dân, 4 API bảo vệ và xác thực QR thật đạt.
- Database của lượt kiểm thử hệ thống đã tự dọn; database demo chỉ được đọc bởi audit dữ liệu.
- Kiểm tra dependency phát hiện Expo/expo-camera lệch bản vá; đã chỉnh yêu cầu phiên bản thành `~57.0.27` / `~57.0.6` để đồng bộ SDK.
- Expo Doctor đạt **21/21**; Expo export cho Android và iOS thành công sau cập nhật SDK patch.
- Đã cập nhật dependency gián tiếp `shell-quote` để loại cảnh báo critical. `npm audit` mobile còn **15 cảnh báo high**, chủ yếu chuỗi Expo/Metro qua `braces` và `node-forge`. Chưa coi phần dependency là sạch bảo mật; không chạy `audit fix --force` vì công cụ đề xuất hạ Expo xuống 44 / React Native xuống 0.72, không tương thích SDK hiện tại. Cần đợt xử lý dependency riêng và kiểm chứng tương thích trước triển khai công khai.

```powershell
cd D:\BTL_đoan4\backend
npm run typecheck
npm run lint
npm test
npm run test:system
npm run build
npm run audit:data
```

- `tests/integration.test.ts`: các luồng gốc, phân quyền, QR, thanh toán, sức chứa và đồng thời.
- `tests/real-world.test.ts`: các ca thực tế bổ sung, trong đó có tranh chỗ cuối, hủy/thu tiền đồng thời, gia hạn, kỳ hạn/giá, xe gửi dài ngày, QR hết hạn, dữ liệu cũ và bảo vệ quyền sở hữu.
- `npm run test:system`: build Admin và chạy smoke 13 route + 404; thao tác thật qua trình duyệt từ duyệt, chuyển khoản, cấp vé, xe vào, chặn hoàn tiền, xác minh ra, hoàn tiền/thu hồi vé; chạy API smoke mobile. Backend/database/cổng kiểm thử được tạo riêng và dừng/dọn sau chạy.
- Android và iOS kiểm tra bằng Expo export; Expo Doctor kiểm tra dependency. Build không thay thế thử camera/mạng trên điện thoại thật.
- `scripts/audit-data.ts` chỉ đọc dữ liệu hiện tại; không tự sửa hoặc xóa lịch sử.

## Dữ liệu demo cũ cần đối chiếu

Lượt **34** (xe **117**) và **37** (xe **126**) có trạng thái ABNORMAL nhưng không có checkOutAt. Cần quản lý xác minh xe thực tế đã ra, sau đó dùng Admin → Lượt ra vào → Xác minh xe ra, ghi căn cứ và cổng. Bản sửa không tự điền thời gian hoặc xóa các lượt này. Hai vé cũ đang chờ đồng bộ trạng thái hết hạn sẽ được xử lý khi job/luồng vé chạy.

Tại thời điểm audit chỉ đọc: không phát hiện PAID thiếu vé, hồ sơ CANCELLED có PAID, RESIDENT thiếu hồ sơ, vé còn hạn chồng lấn hoặc sức chứa vượt mức theo các kiểm tra trong script.

## Phạm vi chưa có trong sản phẩm

- Chưa tích hợp đối soát/chuyển tiền ngân hàng, hoàn một phần, biểu phí quá hạn; không mô phỏng các tính năng này thành giao dịch thật.
- Vi phạm hiện gắn với phương tiện đã có hồ sơ. Xe lạ chưa có hồ sơ cần quản lý xác minh; chưa có sổ sự cố khách vãng lai độc lập.
- Chưa có API tạo nhân viên trực tiếp, gửi thông báo đại trà và bộ lọc thời gian cho báo cáo; các trang hiện ghi rõ giới hạn.
- Chưa có OCR biển số, barrier phần cứng hoặc kiểm chứng danh tính tự động. Bước bảo vệ/quản lý đối chiếu thực tế vẫn bắt buộc.
- Chưa kiểm chứng camera iPhone/Android thật hoặc diễn tập với nhiều máy ở bãi xe trong phiên làm việc này.

Không cần reset database demo hay chạy lại seed để dùng các sửa đổi. Khởi động lại backend, Web Admin và Expo sau khi cập nhật mã nguồn.
