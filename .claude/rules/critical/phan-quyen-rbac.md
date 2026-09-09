# Luật: Phân quyền RBAC và phiên đăng nhập
# Mức: TỐI QUAN TRỌNG | Cưỡng chế: BẮT BUỘC
# Ngăn: endpoint không quyền, leo thang quyền, token đã thu hồi vẫn dùng được

## Khung phân quyền (Phase 1 — theo PHÂN HỆ, không theo từng hành động)

Nguồn chuẩn: `backend/libs/shared/src/auth/roles.ts` — phải khớp với
`admin-web/src/config/roles.config.ts`. Sửa một bên mà không sửa bên kia là giao diện
hiện nút mà API từ chối, hoặc ngược lại.

| Quyền | Thứ bậc | Nghĩa |
|---|---|---|
| `view` | 1 | Xem |
| `edit` | 2 | Xem + tạo/sửa |
| `approve` | 3 | Xem + sửa + phê duyệt |
| `admin` | 4 | Toàn quyền phân hệ |

Vai trò: `admin` · `leader` (lãnh đạo phê duyệt) · `officer` (chuyên viên xử lý) ·
`accountant` (kế toán – giải ngân) · `receptionist` (tiếp nhận một cửa).
Phân hệ: `overview` `tasks` `documents` `disbursement` `feedback` `map` `reports`
`cms` `users` `settings`.

## MUST

| # | Luật |
|---|------|
| 1 | **Mọi** endpoint mới khai báo tường minh một trong hai: `@RequirePermission(phân_hệ, quyền)` hoặc `@Public()`. Không có mặc định ngầm |
| 2 | `@Public()` chỉ dành cho: đăng nhập, xin OTP, health check, đọc nội dung CMS công khai, tra cứu công khai đã che dữ liệu. Kèm comment `// CÔNG KHAI — <vì sao>` |
| 3 | Danh tính (`sub`, `username`, `roleKey`) **chỉ** lấy từ `req.user` do `JwtAuthGuard` gán. Không đọc từ body/header khác |
| 4 | Endpoint công dân dùng cách ly theo `citizenPhone`, không dùng RBAC → `cach-ly-du-lieu-cong-dan.md` |
| 5 | Token mang `sid`; `JwtAuthGuard` tra `SessionRegistry.isActive(sid)` mỗi request. Thêm đường phát token mới thì **phải** phát kèm `sid` |
| 6 | Thu hồi phiên khi: khoá tài khoản, xoá tài khoản, đổi vai trò, đổi mật khẩu, phát hiện dùng lại refresh token cũ |
| 7 | `mustChangePassword = true` thì chặn mọi endpoint trừ đường tự đổi mật khẩu (`@AllowPendingPassword`) |
| 8 | Test cho endpoint mới: 401 (không token), 403 (sai quyền), 200 (đúng quyền) |
| 9 | Thêm phân hệ mới vào `MODULES` → cập nhật quyền cho **cả 5 vai trò**, không để `undefined` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Kiểm quyền bằng `if (user.roleKey === 'admin')` rải trong service — quyền chỉ kiểm ở guard qua `hasPermission` |
| 2 | Gắn `@AllowPendingPassword` cho endpoint nghiệp vụ — nó chỉ dành cho đường thoát khỏi mật khẩu tạm |
| 3 | Dựa vào giao diện ẩn nút như một lớp phân quyền. Ẩn nút là trải nghiệm; chặn ở API là bảo mật |
| 4 | Nới `AUTH_THROTTLE` (5 lượt/phút cho login/OTP) khi `CITIZEN_OTP_BYPASS_CODE` còn bật — đó là thứ duy nhất chặn dò mã 6 chữ số |
| 5 | Tăng thời hạn token (`JWT_EXPIRES_IN`) để "tiện dùng" — thu hồi phiên có độ trễ 10 giây do bộ đệm, token dài hạn khuếch đại rủi ro |
| 6 | Trả thông tin phân biệt "sai tên đăng nhập" vs "sai mật khẩu" |
| 7 | Thêm vai trò mới mà không rà lại toàn bộ bảng quyền — vai trò thiếu quyền sẽ gặp 403 ở chỗ không ai lường |

## Điều kiện DỪNG

- Thêm controller/route mới mà không quyết định được nó cần quyền gì → hỏi, đừng để trống
- Cần "một endpoint bỏ qua guard cho tiện" → không có ngoại lệ này

## Rủi ro còn tồn (SECURITY.md)

| Mã | Nội dung | Ứng xử |
|---|---|---|
| T-04 | `users:edit` cho phép cả *Tiếp nhận một cửa* khoá tài khoản công dân | Câu hỏi mở #15 — không tự nới thêm |
| TB-10 | Dò tài khoản qua thời gian phản hồi ở `staffLogin` | Sửa bằng cách luôn `bcrypt.compare` với hash giả |

→ `cach-ly-du-lieu-cong-dan.md` · `nhat-ky-thao-tac.md` · `skills/phien-va-token`
