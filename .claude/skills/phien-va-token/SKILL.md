---
name: phien-va-token
description: Dùng khi làm việc với đăng nhập, JWT, refresh token, thu hồi phiên, khoá tài khoản, đổi mật khẩu, mật khẩu tạm. Kích hoạt bởi: JWT, token, refresh, đăng nhập, login, logout, phiên, session, SessionRegistry, sid, thu hồi, revoke, mustChangePassword, bcrypt, mật khẩu, password policy, khoá tài khoản.
---

# Kỹ năng: Phiên đăng nhập và token
# Mức: TỐI QUAN TRỌNG | Ngăn: token đã thu hồi vẫn dùng được, mất kiểm soát phiên

## Cơ chế hiện có

| Thành phần | Vai trò |
|---|---|
| `JwtAuthGuard` (`libs/shared/src/auth/jwt.guard.ts`) | Guard toàn cục: xác thực chữ ký → tra sổ phiên → chặn mật khẩu tạm → kiểm RBAC |
| `SessionRegistry` (`libs/shared/src/auth/session-registry.ts`) | Tra `login_sessions.revoked` + trạng thái khoá/xoá mềm của chủ tài khoản. Nhớ tạm 10 giây |
| `sid` trong payload JWT | Mã phiên — thứ làm cho việc thu hồi token trước hạn khả thi |
| `POST /auth/refresh` | Xoay vòng refresh token, băm bcrypt lưu trên `login_sessions` |
| `password-policy.ts` | Chính sách dùng chung cho **cả ba** đường đổi mật khẩu |
| `mustChangePassword` | Mật khẩu tạm chưa đổi → chặn mọi endpoint trừ đường tự đổi |

**Độ trễ thu hồi là 10 giây** (bộ đệm của `SessionRegistry`). Đây là đánh đổi đã nhận —
đừng nới thời gian đệm, và đừng dựa vào thu hồi như một cơ chế tức thời.

## MUST

| # | Luật |
|---|------|
| 1 | Mọi đường phát token mới **phải** phát kèm `sid` và ghi bản ghi `login_sessions` — token không có `sid` là token không thu hồi được |
| 2 | Thu hồi phiên khi: khoá tài khoản · xoá mềm tài khoản · đổi vai trò · đổi mật khẩu · quản trị viên đặt lại mật khẩu · phát hiện dùng lại refresh token cũ |
| 3 | Refresh token lưu dạng **băm bcrypt**, không lưu dạng rõ |
| 4 | Xoay vòng refresh mỗi lượt; dùng lại token cũ → **thu hồi cả phiên** |
| 5 | Đổi mật khẩu (cả ba đường: tự đổi, đổi mật khẩu tạm, quản trị đặt lại) đi qua `password-policy.ts` |
| 6 | Mật khẩu băm bcrypt; `passwordHash` khai `select: false` |
| 7 | `@AllowPendingPassword` chỉ gắn cho: đọc thông tin chính mình, đổi mật khẩu. Không gì khác |
| 8 | Đăng nhập sai không tiết lộ tài khoản có tồn tại hay không — cùng thông báo, cùng thời gian phản hồi |
| 9 | Hạn mức riêng cho nhóm xác thực: 5 lượt/phút (login, OTP, định danh Zalo) |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Tăng `JWT_EXPIRES_IN` (hiện 8 giờ) — token dài hạn khuếch đại độ trễ thu hồi |
| 2 | Bỏ tra `SessionRegistry` "cho nhanh" hoặc "để giảm truy vấn Mongo" |
| 3 | Lưu token dài hạn trong `localStorage` của Mini App → `skills/zalo-miniapp-platform` |
| 5 | Ghi log token, refresh token, `sid`, hay mật khẩu → `rules/critical/du-lieu-ca-nhan.md` |
| 6 | Nới `AUTH_THROTTLE` khi `CITIZEN_OTP_BYPASS_CODE` còn bật |
| 7 | Trả mật khẩu tạm trong phản hồi HTTP ở đường mới (đường `POST /users/staff` hiện có là rủi ro đã nhận, T-03) |
| 8 | Dùng `JWT_SECRET` cho mục đích thứ ba — nó đã ký **cả** token đăng nhập **và** link tệp riêng tư |

## Khi thêm một loại tài khoản / đường đăng nhập mới

Trả lời trước khi viết mã:

1. Payload gồm gì? (`sub`, `username`, `roleKey`, `sid` — thiếu `sid` là không thu hồi được)
2. Ai khoá được tài khoản này, và khoá xong thì phiên bị thu hồi bằng cách nào?
3. Có mật khẩu không? Nếu có, đi qua `password-policy.ts` chưa?
4. Hạn mức chống dò là bao nhiêu?
5. Cách ly dữ liệu theo gì — RBAC hay chủ sở hữu? → `rules/critical/cach-ly-du-lieu-cong-dan.md`
6. Test 401/403/200 đã có chưa?

→ `rules/critical/phan-quyen-rbac.md` · `skills/xac-thuc-otp-cong-dan`
