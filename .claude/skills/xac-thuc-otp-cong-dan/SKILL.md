---
name: xac-thuc-otp-cong-dan
description: Dùng khi làm việc với định danh công dân, mã OTP, đổi token Zalo lấy số điện thoại, getPhoneNumber, mã tạm bypass, kho OTP. Kích hoạt bởi: OTP, định danh, xác thực công dân, số điện thoại, getPhoneNumber, Zalo token, CITIZEN_OTP_BYPASS_CODE, OtpStore, otp_codes, mã xác thực, SMS, ZNS.
---

# Kỹ năng: Định danh công dân bằng OTP
# Mức: TỐI QUAN TRỌNG | Ngăn: mạo danh công dân, dò mã OTP, lối vào không qua xác thực

## Tình trạng hiện tại — đọc trước khi sửa

Zalo **chưa cấp quyền** `getPhoneNumber`. Vì vậy đang tồn tại `CITIZEN_OTP_BYPASS_CODE`:
một mã cố định cho phép định danh **bất kỳ số điện thoại nào**. Đây là **lối vào không
qua xác thực thật** — phải để trống trước khi mở cho dân (SECURITY.md mục 4, việc 0).

Backend cảnh báo mỗi lần khởi động và ghi `warn` kèm số điện thoại + IP mỗi lần mã được
dùng. Kiểm tra đã có ai dùng: `docker compose logs backend | grep "mã tạm thời"`.

## Ràng buộc về độ mạnh mã

Ô nhập OTP của Mini App **cố định 6 ký tự số** — không thể đặt mã dài hơn. Nghĩa là
không gian chỉ 10⁶, và thứ **duy nhất** chặn dò là hạn mức `AUTH_THROTTLE` 5 lượt/phút
mỗi IP.

Hệ quả bắt buộc:

- **Không nới hạn mức đó** chừng nào `CITIZEN_OTP_BYPASS_CODE` còn bật
- **Không** chọn dãy dễ đoán làm mã tạm (`123456`, `000000`, `112233`)
- Giới hạn 5 lần nhập sai → huỷ mã, phải xin mã mới

## MUST

| # | Luật |
|---|------|
| 1 | Sinh OTP bằng `crypto.randomInt()` — **không** `Math.random()` |
| 2 | Kho OTP **chỉ lưu HMAC** của mã, không lưu dạng rõ (cả driver `memory` và `mongo`) |
| 3 | Chạy nhiều hơn một instance backend → **bắt buộc** `OTP_STORE=mongo`. Driver `memory` giữ mã trong bộ nhớ tiến trình: mã sinh ở instance A không xác thực được ở instance B, và bộ đếm nhập sai không dùng chung nên người dò chỉ cần đổi instance là được thêm lượt |
| 4 | `otp_codes` có TTL index — mã tự hết hạn, không xoá bằng cron |
| 5 | Đếm số lần nhập sai theo **mã**, không theo IP (đổi IP không được thêm lượt) |
| 6 | Đường định danh Zalo (`exchangeZaloToken`) đi qua adapter, đọc `ZALO_APP_SECRET` từ `ConfigService` |
| 7 | Số điện thoại chuẩn hoá về `0xxxxxxxxx` **trước** khi so sánh và lưu — nếu không, cùng một người tạo được hai danh tính |
| 8 | Mỗi lần dùng mã tạm ghi cảnh báo có số điện thoại (đã che) + IP |
| 9 | Xoá `CITIZEN_OTP_BYPASS_CODE` ngay khi có `getPhoneNumber` hoặc khi nối được SMS/ZNS |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Ghi log mã OTP dạng rõ — kể cả khi debug, kể cả ở môi trường phát triển |
| 2 | Trả mã OTP trong phản hồi HTTP (dù chỉ ở chế độ dev — nhánh đó sẽ đi lên production) |
| 3 | Nới `AUTH_THROTTLE` khi mã tạm còn bật |
| 4 | Bỏ giới hạn số lần nhập sai |
| 5 | Cho phép mã OTP dài hơn hoặc ngắn hơn 6 chữ số ở backend (ô nhập Mini App cố định 6) |
| 6 | Tin số điện thoại do client gửi kèm mã OTP mà không kiểm mã đó được phát cho **đúng** số đó |
| 7 | Đặt `CITIZEN_OTP_BYPASS_CODE` vào `.env.example` với một giá trị thật |
| 8 | Cho công dân tự đổi số điện thoại (đó là khoá cách ly dữ liệu) → `rules/critical/cach-ly-du-lieu-cong-dan.md` |

## Khi Zalo cấp quyền `getPhoneNumber`

Việc phải làm theo thứ tự:

1. Kiểm chứng `exchangeZaloToken()` chạy thật với token của Zalo
2. Bỏ trống `CITIZEN_OTP_BYPASS_CODE` ở mọi môi trường
3. Cập nhật `SECURITY.md`: chuyển việc 0 sang "đã hoàn thành", đóng phát hiện **T-08**
4. Cập nhật `docs/09-ZALO-XIN-QUYEN-API.md` và `docs/11-ZALO-4-QUYEN-API.md`
5. Rà lại `AUTH_THROTTLE` — có thể giữ nguyên, không nới

→ `rules/critical/cach-ly-du-lieu-cong-dan.md` · `skills/phien-va-token` · `skills/zalo-miniapp-platform`
