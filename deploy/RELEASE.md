# ViGov — Hồ sơ phát hành Zalo Mini App (task P4-37)

> Kênh công dân phát hành qua **Zalo Mini App Store**.
> Nộp kiểm duyệt ngay khi code-complete để lead time review chạy song song với QA nội bộ.

> **Cập nhật 09/09/2026** — dự án bỏ app Flutter (`mobile/`), nên hai kênh Google Play
> và App Store trong bản trước của tài liệu này không còn áp dụng. Kênh công dân duy
> nhất là Zalo Mini App.

---

## 0. Việc khách hàng phải chuẩn bị trước (không tính ngày công)

| Việc | Bên chịu trách nhiệm | Ghi chú |
|---|---|---|
| Zalo Official Account + Zalo Developers | Khách hàng | Điều kiện bắt buộc để chạy Mini App và gửi ZNS |
| Tên miền + chứng chỉ TLS cho backend | Khách hàng | Zalo yêu cầu API chạy HTTPS |
| Trang Chính sách quyền riêng tư (URL công khai) | Khách hàng + đội phát triển | Bắt buộc |
| Logo, ảnh chụp màn hình, mô tả ứng dụng | Đội phát triển soạn, khách duyệt | Xem mục 2 |

---

## 1. Zalo Mini App Store

### Chuẩn bị kỹ thuật
- Đăng nhập Zalo Developers, tạo Mini App gắn với Official Account của UBND xã.
- Điền `VITE_ZALO_APP_ID`, `VITE_ZALO_OA_ID` vào `.env` production; đặt `VITE_USE_MOCKS=false` để adapter `src/services/zalo.ts` gọi `zmp-sdk` thật.
- Kiểm tra `zalo-miniapp/app-config.json` (tiêu đề, màu header, thanh trạng thái).
- Build: `npm run build` → thư mục `dist/`, nộp bằng `zmp deploy` (Zalo Mini App CLI) hoặc tải lên qua Developers Console.
- Khai báo quyền dùng trong Mini App: số điện thoại, vị trí, camera/thư viện ảnh, quét QR.
- **Khai tên miền tile bản đồ** trong danh sách domain của Mini App — chưa khai thì tile im lặng không tải và màn hình bản đồ chỉ có nền trống (xem `../docs/03-ZALO-MINIAPP.md`).

### Khai báo dữ liệu và quyền riêng tư
- Khai đúng dữ liệu thu thập: số điện thoại (định danh), vị trí chính xác (gửi phản ánh), ảnh (ảnh hiện trường). Nêu rõ mục đích và việc không chia sẻ cho bên thứ ba.
- Chính sách quyền riêng tư (URL công khai) và thông tin liên hệ hỗ trợ.

### Lưu ý riêng
- Template **ZNS phải được Zalo duyệt riêng** (không đi cùng duyệt Mini App): thời gian **vài ngày đến 1 tuần**, nộp càng sớm càng tốt.
- Mini App của cơ quan nhà nước có thể được yêu cầu bổ sung giấy tờ chứng minh đơn vị.
- Zalo **chưa cấp quyền** `getPhoneNumber` cho Mini App này nên định danh hiện phải dùng `CITIZEN_OTP_BYPASS_CODE`; xin quyền sớm và xoá biến này ngay khi được cấp.

---

## 2. Tài sản phát hành (đội phát triển soạn, khách duyệt)

| Hạng mục | Yêu cầu |
|---|---|
| Icon ứng dụng | Theo kích thước Zalo Developers yêu cầu tại thời điểm nộp |
| Ảnh chụp màn hình | Tối thiểu 4 ảnh: Trang chủ, Gửi phản ánh, Phản ánh của tôi, Tin tức |
| Tên hiển thị | "ViGov — Điều hành số cấp xã" (kiểm tra giới hạn ký tự) |
| Mô tả ngắn | Kênh tương tác giữa người dân và UBND xã: gửi phản ánh kèm ảnh và vị trí, theo dõi tiến độ xử lý, tra cứu hồ sơ một cửa, đọc tin tức và nghe truyền thanh của xã. |
| Mô tả dài | Nêu 6 nhóm tính năng, cam kết SLA xử lý phản ánh, thông tin đơn vị vận hành |
| Chính sách quyền riêng tư | URL công khai; nêu rõ dữ liệu thu thập, mục đích, thời gian lưu, quyền của người dùng |
| Thông tin liên hệ hỗ trợ | Email + tổng đài một cửa của xã |

---

## 3. Rủi ro lịch phát hành

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Zalo chậm duyệt template ZNS | Không gửi được thông báo cho công dân | Nộp template ngay khi code-complete; app vẫn chạy, chỉ thiếu thông báo |
| Zalo chưa cấp quyền `getPhoneNumber` | Định danh phải dùng mã OTP tạm | Xin quyền từ sớm; nêu rõ trong ghi chú gửi kiểm duyệt |
| Bị từ chối vì thiếu mô tả quyền / giấy tờ đơn vị | Trễ 3–7 ngày mỗi vòng | Dùng checklist mục 1 trước khi nộp |
| Backend chưa có HTTPS/tên miền | Zalo từ chối | Hoàn tất TLS trước khi nộp (xem `README.md`) |
| Chưa khai tên miền tile bản đồ | Màn hình bản đồ trống, không báo lỗi | Khai domain trước khi nộp, hoặc để `VITE_MAP_PROVIDER=mock` |
