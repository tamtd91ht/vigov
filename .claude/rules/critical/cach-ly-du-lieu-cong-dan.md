# Luật: Cách ly dữ liệu giữa các công dân
# Mức: TỐI QUAN TRỌNG | Cưỡng chế: BẮT BUỘC (không thương lượng)
# Ngăn: công dân A đọc được dữ liệu công dân B, dò mã hồ sơ, lộ đơn thư

## Vì sao đây là luật riêng, không gộp vào RBAC

Cán bộ được phân quyền theo phân hệ (`view/edit/approve/admin`). Công dân **không có
vai trò** — chỉ có một danh tính là số điện thoại đã qua OTP. Nghĩa là không có quyền
nào để kiểm tra; thứ duy nhất cách ly dữ liệu công dân là **bộ lọc trong truy vấn**.
Quên một bộ lọc là rò rỉ toàn bộ.

Điều tệ hơn: định danh công dân hiện chỉ là OTP 6 chữ số qua Zalo, và trong giai đoạn
chưa có quyền `getPhoneNumber` còn có `CITIZEN_OTP_BYPASS_CODE`. Nghĩa là **phải coi
danh tính công dân là yếu**, và mọi truy vấn phải phòng vệ như thể người gọi đang cố ý
dò dữ liệu người khác.

## MUST

| # | Luật |
|---|------|
| 1 | Nguồn `citizenPhone` **duy nhất** là phiên đã xác thực (`req.user`), lấy từ token. Không bao giờ từ body, path param, hay query |
| 2 | Mọi truy vấn dữ liệu công dân có bộ lọc `{ citizenPhone }` **ngay trong `findOne`/`find`**, không lọc sau bằng JavaScript |
| 3 | Endpoint công dân đặt dưới tiền tố riêng và đặt tên rõ ràng: `/feedback/citizen/**`, hậu tố `Mine` cho hàm service (`listMine`, `detailMine`, `rateMine`) |
| 4 | Tra cứu theo mã (`code`, `arrivalNo`) của công dân **luôn** kèm `citizenPhone` trong cùng một `findOne` — mã hồ sơ không phải là bí mật, nó in trên giấy |
| 5 | Ký link tệp riêng tư: công dân chỉ ký được tệp **do chính mình tải lên** (kiểm `uploadedBy`) |
| 6 | Tra cứu công khai (không đăng nhập) chỉ trả trường đã che và **không** trả nội dung đơn thư |
| 7 | Đổi số điện thoại của một tài khoản công dân = đổi khoá cách ly → phải chặn, hoặc phải di trú toàn bộ dữ liệu kèm ghi vết |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Endpoint công dân nhận `citizenPhone` làm tham số đầu vào |
| 2 | `findById(id)` trần trên bản ghi có chủ là công dân, rồi mới so `citizenPhone` bằng `if` |
| 3 | Dùng cùng một hàm service cho cả cán bộ và công dân (một bên có lọc, một bên không → sớm muộn gọi sai) |
| 4 | Trả về `_id` / ObjectId của bản ghi công dân cho client công dân khi mã nghiệp vụ (`code`) đã đủ dùng |
| 5 | Dựa vào việc "ObjectId khó đoán" như một lớp bảo vệ — ObjectId chứa dấu thời gian và bộ đếm |
| 6 | Đếm / thống kê gộp trên dữ liệu công dân rồi trả cho client công dân |
| 7 | Cho công dân đọc timeline nội bộ (ai xử lý, ghi chú nội bộ của cán bộ) |

## Điều kiện DỪNG

Bất kỳ truy vấn nào chạm collection có trường `citizenPhone` / `applicantPhone` mà
không có bộ lọc theo chủ sở hữu → **DỪNG NGAY**, không viết tiếp.

## Cách kiểm tra một endpoint công dân

1. Bỏ token đi — endpoint có trả dữ liệu không? (phải 401, trừ endpoint tra cứu công khai đã che)
2. Đổi token sang công dân khác nhưng giữ nguyên `code` trong URL — có đọc được không? (phải 404)
3. Đổi `code` sang mã hồ sơ của người khác — có đọc được không? (phải 404, **không** phải 403 — 403 tiết lộ là mã đó tồn tại)
4. Có test tự động cho cả ba trường hợp trên chưa? → `skills/kiem-thu-vigov`

→ `du-lieu-ca-nhan.md` · `phan-quyen-rbac.md` · `skills/xac-thuc-otp-cong-dan`
