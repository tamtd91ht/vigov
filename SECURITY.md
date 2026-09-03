# ViGov — Rà soát & gia cố bảo mật (task P4-36, WBS #36)

Phạm vi: nền tảng ViGov Phase 1 gồm `backend/` (NestJS 11 + MongoDB + JWT),
`admin-web/` (Next.js 16), `mobile/` (Flutter), `zalo-miniapp/` (Vite + React).

Ngày rà soát: 28/08/2026 · Người thực hiện: đội phát triển ViGov
Kiểm chứng sau khi sửa: `npx tsc --noEmit -p apps/api-gateway/tsconfig.app.json` sạch lỗi,
`npm run test:e2e` PASS 11/11.

---

## 1. Bảng checklist gia cố

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Header `X-Content-Type-Options: nosniff` | ✅ Đã làm | `apps/api-gateway/src/security.middleware.ts` |
| 2 | Header `X-Frame-Options: DENY` | ✅ Đã làm | Chống clickjacking |
| 3 | Header `Referrer-Policy: no-referrer` | ✅ Đã làm | |
| 4 | Header `X-XSS-Protection: 0` | ✅ Đã làm | Tắt bộ lọc XSS cũ theo khuyến nghị hiện hành |
| 5 | `Strict-Transport-Security` (chỉ production) | ✅ Đã làm | `HSTS_MAX_AGE`, mặc định 1 năm + `includeSubDomains` |
| 6 | `Permissions-Policy` tối thiểu | ✅ Đã làm | Tắt camera, mic, GPS, thanh toán, USB… |
| 7 | `Content-Security-Policy` cho API | ✅ Đã làm | `default-src 'none'; frame-ancestors 'none'` |
| 8 | Tắt `x-powered-by` | ✅ Đã làm | `app.disable('x-powered-by')` + `res.removeHeader` |
| 9 | CORS theo whitelist đọc từ cấu hình | ✅ Đã làm | `CORS_ORIGINS`; production để `*` sẽ **không khởi động được** |
| 10 | Giới hạn kích thước thân yêu cầu | ✅ Đã làm | `BODY_LIMIT` mặc định `1mb` (JSON + form) |
| 11 | `ValidationPipe` + `forbidNonWhitelisted` | ✅ Đã làm | Chặn gán thêm thuộc tính (mass assignment) |
| 12 | Chặn khởi động production khi còn `JWT_SECRET` mẫu | ✅ Đã làm | `assertProductionSecrets()`, yêu cầu ≥ 32 ký tự |
| 13 | `trust proxy` cấu hình được | ✅ Đã làm | `TRUST_PROXY`; nếu không đặt, sau nginx rate-limit sẽ đếm nhầm IP |
| 14 | Rate-limit toàn cục | ✅ Có sẵn | `ThrottlerModule` 120 lượt/60 giây |
| 15 | Rate-limit riêng cho nhóm xác thực | ✅ Đã làm | 5 lượt/phút cho login, OTP, định danh Zalo |
| 16 | Giới hạn số lần nhập sai OTP | ✅ Đã làm | 5 lần sai → huỷ mã, phải xin mã mới |
| 17 | Sinh OTP bằng nguồn ngẫu nhiên mật mã | ✅ Đã làm | Thay `Math.random()` bằng `crypto.randomInt()` |
| 18 | Băm mật khẩu | ✅ Có sẵn | bcrypt, 10 vòng; `passwordHash` khai báo `select: false` |
| 19 | RBAC theo phân hệ cho mọi endpoint quản trị | ✅ Có sẵn | `JwtAuthGuard` toàn cục + `@RequirePermission` |
| 20 | Cách ly dữ liệu công dân | ✅ Có sẵn | `/feedback/citizen/**` lọc theo `citizenPhone` của phiên |
| 21 | Che số điện thoại trước khi trả ra API | ✅ Đã bổ sung | Trước đây phân hệ Phản ánh vẫn trả số đầy đủ |
| 22 | Kiểm soát quyền cấp link tệp riêng tư | ✅ Đã sửa | Công dân chỉ ký được tệp do chính mình tải lên |
| 23 | Chặn tệp thực thi được trong trình duyệt | ✅ Đã sửa | Cấm HTML/SVG/JS…; tệp lạ buộc `attachment` |
| 24 | Chống path traversal khi lưu tệp | ✅ Có sẵn | Regex khoá an toàn + đối chiếu đường dẫn tuyệt đối |
| 25 | Giới hạn dung lượng tệp tải lên | ✅ Có sẵn | Multer `limits.fileSize` + kiểm tra lại ở service |
| 26 | Chữ ký link tệp riêng tư | ✅ Có sẵn | HMAC-SHA256, so sánh bằng `timingSafeEqual`, TTL tối đa 24 giờ |
| 27 | Nhật ký thao tác (audit log) che trường nhạy cảm | ✅ Có sẵn | `AuditInterceptor` che password/token/otp |
| 28 | Escape từ khoá người dùng trước khi ghép `$regex` | ✅ Có sẵn | Users, Feedback, Search đều escape |
| 29 | Thu hồi token khi khoá tài khoản / thu hồi phiên | ❌ Chưa làm | Xem phát hiện **TB-01** |
| 30 | Refresh token + xoay vòng token | ❌ Chưa làm | Có `REFRESH_EXPIRES_IN` nhưng chưa có luồng cấp lại |
| 31 | Xác thực MongoDB / RabbitMQ | ❌ Chưa làm | Xem mục 4 — việc cần làm trước production |
| 32 | HTTPS/TLS đầu vào | ❌ Chưa làm | Do hạ tầng triển khai đảm nhiệm |
| 33 | Xác thực thật ở admin-web / mobile / Zalo Mini App | ❌ Chưa làm | Cả 3 client còn ở chế độ mock — xem **C-03** |
| 34 | Quét mã tự động (SAST/DAST), pentest | ❌ Ngoài phạm vi | Xem mục 5 |

---

## 2. Danh sách phát hiện theo mức độ

### Mức CAO

| Mã | Phát hiện | Trạng thái |
|---|---|---|
| **C-01** | **Ai đăng nhập cũng xin được link đọc tệp riêng tư bất kỳ.** `GET /files/:id/signed-url` chỉ đi qua `JwtAuthGuard` mà không kiểm tra chủ sở hữu. Một tài khoản công dân (định danh chỉ bằng OTP) chỉ cần dò mã ObjectId là lấy được link ký sẵn để đọc bản scan văn bản, đơn thư nội bộ. | ✅ **ĐÃ SỬA** |
| **C-02** | **Stored XSS qua tệp tải lên.** Mục đích `other` không giới hạn MIME, còn route đọc tệp luôn trả `Content-Disposition: inline`. Kẻ xấu tải lên tệp `text/html` (hoặc `image/svg+xml`) chứa script rồi phát tán link `/api/v1/files/<id>` — mã chạy ngay trên tên miền API. | ✅ **ĐÃ SỬA** |
| **C-03** | **Xác thực phía client hoàn toàn là mock.** `admin-web/src/services/auth.ts` so sánh mật khẩu ngay trong trình duyệt với `NEXT_PUBLIC_DEMO_*` rồi ghi phiên vào `localStorage`; `AuthGuard.tsx` chỉ ẩn giao diện phía client, không có middleware chặn ở tầng route. Mobile (`identity_service.dart`) và Zalo Mini App cũng lưu phiên mock. **Không được đưa lên môi trường thật ở trạng thái này.** | ⚠️ **CÒN TỒN ĐỌNG** — thuộc hạng mục nối backend thật (P3/P4) |
| **C-04** | **`JWT_SECRET` mẫu dùng chung cho cả ký token và ký link tệp.** Nếu lên production mà quên đổi, mọi token và mọi link tệp riêng tư đều giả mạo được. | ✅ **ĐÃ SỬA** (chặn khởi động) — vẫn phải đổi khoá thật, xem mục 4 |

### Mức TRUNG BÌNH

| Mã | Phát hiện | Trạng thái |
|---|---|---|
| **TB-01** | **Khoá tài khoản / thu hồi phiên không làm token hết hiệu lực.** `JwtAuthGuard` chỉ kiểm tra chữ ký, không tra lại `staff_users.status`, `citizen_users.status` hay `login_sessions.revoked`. Người bị khoá vẫn dùng được token cũ tới 8 giờ. | ⚠️ Còn tồn đọng — cần đưa `sessionId` vào payload JWT + tra cứu (hoặc danh sách đen token trên Redis) |
| **TB-02** | **Rò rỉ số điện thoại đầy đủ ở phân hệ Phản ánh.** `GET /feedback` và `GET /feedback/:code` trả `citizenPhone` nguyên vẹn, trong khi phân hệ Người dùng đã có chính sách che số. | ✅ **ĐÃ SỬA** |
| **TB-03** | **Không có hạn mức riêng cho endpoint đăng nhập / OTP.** Hạn mức chung 120 lượt/phút đủ để dò mật khẩu và quét mã OTP 6 chữ số (mã sống 5 phút, không đếm số lần sai). | ✅ **ĐÃ SỬA** (5 lượt/phút + tối đa 5 lần sai OTP) |
| **TB-04** | **OTP sinh bằng `Math.random()`** — không phải nguồn ngẫu nhiên mật mã, có thể dự đoán. | ✅ **ĐÃ SỬA** (`crypto.randomInt`) |
| **TB-05** | **Không giới hạn kích thước thân yêu cầu JSON.** Mặc định của Express là 100KB nhưng dự án chưa khai báo tường minh; các trường mô tả cho phép tới 5.000 ký tự. | ✅ **ĐÃ SỬA** (`BODY_LIMIT`) |
| **TB-06** | **CORS mở cho mọi nguồn** (`app.enableCors()` không tham số). | ✅ **ĐÃ SỬA** (whitelist `CORS_ORIGINS`) |
| **TB-07** | **Thiếu toàn bộ security header** (nosniff, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy, CSP) và vẫn để lộ `X-Powered-By: Express`. | ✅ **ĐÃ SỬA** |
| **TB-08** | **Kho OTP nằm trong bộ nhớ tiến trình** (`Map` trong `AuthService`). Khi chạy nhiều instance sau load balancer, mã sinh ở instance A không xác thực được ở instance B; đồng thời hạn mức chống dò cũng không dùng chung. | ⚠️ Còn tồn đọng — chuyển sang Redis khi mở rộng nhiều instance (đã ghi chú sẵn trong mã) |
| **TB-09** | **Tệp công khai đọc được không cần đăng nhập.** `GET /files/:id` để `@Public()`; tệp `isPrivate = false` chỉ được bảo vệ bằng độ khó đoán của ObjectId — mà ObjectId chứa dấu thời gian và bộ đếm nên đoán được một phần. | ⚠️ Còn tồn đọng — quy ước: mọi tệp nghiệp vụ (scan văn bản, ảnh phản ánh) phải tải lên với `isPrivate = true`; cần rà lại phía client khi nối backend thật |
| **TB-10** | **Dò tài khoản qua thời gian phản hồi.** `staffLogin` chỉ chạy `bcrypt.compare` khi tìm thấy tài khoản, nên sai tên đăng nhập trả lời nhanh hơn hẳn sai mật khẩu. | ⚠️ Còn tồn đọng — mức rủi ro thấp sau khi đã siết 5 lượt/phút; xử lý bằng cách luôn so sánh với một hash giả |

### Mức THẤP

| Mã | Phát hiện | Trạng thái |
|---|---|---|
| **T-01** | Chưa cấu hình `trust proxy`: sau nginx thì `req.ip` là IP của proxy, làm rate-limit đếm gộp mọi người dùng và nhật ký ghi sai IP. | ✅ **ĐÃ SỬA** (biến `TRUST_PROXY`) |
| **T-02** | Tệp riêng tư được đọc khỏi ổ lưu trữ **trước** khi kiểm tra chữ ký — yêu cầu không hợp lệ vẫn khiến máy chủ đọc đĩa/S3 (lãng phí, dễ bị lạm dụng để gây tải). | ✅ **ĐÃ SỬA** (`openForDownload`) |
| **T-03** | `POST /users/staff` trả mật khẩu tạm trong phản hồi HTTP. Chấp nhận được ở Phase 1 (hiển thị một lần cho quản trị viên) nhưng mật khẩu sẽ nằm trong log/proxy nếu chưa bật HTTPS. | ⚠️ Chấp nhận rủi ro có điều kiện — bắt buộc bật HTTPS trước khi dùng thật |
| **T-04** | Quyền `users:edit` cho phép cả vai trò *Tiếp nhận một cửa* khoá tài khoản công dân và xem danh sách chặn. | ⚠️ Chờ khách chốt — câu hỏi mở #15 |
| **T-05** | `admin-web` đọc mật khẩu demo từ `NEXT_PUBLIC_DEMO_PASSWORD`; biến `NEXT_PUBLIC_*` được nhúng thẳng vào gói JavaScript gửi cho trình duyệt. | ⚠️ Còn tồn đọng — gỡ bỏ khi nối backend thật |
| **T-06** | Mobile lưu phiên trong `SharedPreferences` (không mã hoá). Khi có JWT thật phải chuyển sang `flutter_secure_storage` (Keychain/Keystore). | ⚠️ Còn tồn đọng |
| **T-07** | Zalo Mini App lưu phiên trong `localStorage` — chấp nhận được với môi trường Zalo nhưng không được lưu token dài hạn ở đây. | ⚠️ Còn tồn đọng |
| **T-08** | `exchangeZaloToken()` hiện luôn trả `null`; luồng định danh Zalo chưa có kiểm chứng thật với Zalo Open API. | ⚠️ Chờ tích hợp — câu hỏi mở #3 |
| **T-09** | Chưa có refresh token / xoay vòng token dù đã khai báo `REFRESH_EXPIRES_IN`. Token sống 8 giờ, mất token là mất phiên trong 8 giờ. | ⚠️ Còn tồn đọng |
| **T-10** | Chưa có chính sách độ mạnh mật khẩu cán bộ và chưa buộc đổi mật khẩu tạm ở lần đăng nhập đầu. | ⚠️ Còn tồn đọng |

---

## 3. Kết quả `npm audit` (3 module)

Lệnh chạy: `npm audit --production` (chỉ đọc kết quả, **không** chạy `npm audit fix`).

| Module | Nghiêm trọng | Cao | Trung bình | Thấp | Ghi chú |
|---|---|---|---|---|---|
| `backend` | 0 | 0 | **2** | 0 | `uuid < 11.1.1` (GHSA-w5hq-g745-h8pq — thiếu kiểm tra biên bộ đệm ở v3/v5/v6 khi truyền sẵn `buf`), kéo theo từ `exceljs` |
| `admin-web` | 0 | 0 | 0 | 0 | Sạch |
| `zalo-miniapp` | 0 | 0 | **2** | 0 | `@sentry/browser < 7.119.1` (GHSA-593m-55hh-j8gv — prototype pollution gadget), kéo theo từ `zmp-sdk` |

Đánh giá và hướng xử lý:

- **backend / uuid**: ViGov chỉ dùng `exceljs` để **ghi** tệp .xlsx báo cáo và không truyền tham số `buf`
  cho `uuid`, nên không chạm vào đường dẫn mã bị lỗi. `npm audit fix --force` sẽ hạ `exceljs` xuống 3.4.0
  (thay đổi phá vỡ API) — **không thực hiện**. Theo dõi bản `exceljs` mới nâng `uuid`, hoặc ghim
  `uuid@^11.1.1` bằng `overrides` trong một lần cập nhật phụ thuộc có kiểm thử đầy đủ.
- **zalo-miniapp / @sentry/browser**: là phụ thuộc bắc cầu của `zmp-sdk` (SDK bắt buộc của nền tảng Zalo).
  Không tự nâng được nếu Zalo chưa phát hành `zmp-sdk` mới. Theo dõi bản phát hành của Zalo;
  `npm audit fix --force` sẽ hạ `zmp-sdk` xuống 2.9.4 — **không thực hiện**.
- Cả hai đều ở mức **trung bình**, không có lỗ hổng mức cao/nghiêm trọng nào ở phụ thuộc chạy thật.

---

## 4. Việc BẮT BUỘC làm trước khi lên production

0. **Xoá `CITIZEN_OTP_BYPASS_CODE`** khỏi `.env` (để trống). Đây là mã cố định cho phép định danh
   **bất kỳ số điện thoại nào** ở màn OTP, dựng tạm cho giai đoạn Zalo chưa cấp quyền
   `getPhoneNumber` và mã OTP thật còn chưa gửi được qua SMS/ZNS. Còn giá trị là còn một lối vào
   không qua xác thực thật. Backend cảnh báo mỗi lần khởi động và ghi `warn` kèm số điện thoại +
   IP mỗi lần mã được dùng — rà `docker compose logs backend | grep "mã tạm thời"` để biết đã có
   ai dùng chưa. *Điều kiện để xoá được: quyền `getPhoneNumber` đã cấp và luồng đổi token Zalo
   chạy thật, HOẶC đã nối SMS/ZNS cho OTP.*
1. **Đổi `JWT_SECRET`.** Sinh chuỗi ngẫu nhiên ≥ 32 ký tự (`openssl rand -base64 48`), lưu trong
   trình quản lý bí mật, không commit. Khoá này ký cả token đăng nhập lẫn link tệp riêng tư.
   *API Gateway đã được chặn khởi động nếu `NODE_ENV=production` mà khoá còn là giá trị mẫu.*
2. **Bật HTTPS/TLS** ở nginx/load balancer, chuyển hướng toàn bộ HTTP → HTTPS. HSTS chỉ được gắn
   khi `NODE_ENV=production`, nên phải có TLS trước rồi mới bật cờ production.
3. **Khai báo whitelist CORS thật**: `CORS_ORIGINS=https://<tên-miền-web-quản-trị>,https://h5.zdn.vn`.
   Để trống hoặc `*` ở production sẽ làm ứng dụng không khởi động được (đây là hành vi cố ý).
4. **Đặt `TRUST_PROXY`** đúng số lớp proxy (thường là `1`), nếu không rate-limit và nhật ký sẽ ghi
   nhầm IP của nginx cho mọi người dùng.
5. **Bật xác thực MongoDB**: tạo user riêng cho ViGov với quyền `readWrite` trên đúng một database,
   `MONGO_URI=mongodb://vigov:<mật-khẩu>@host:27017/vigov?authSource=admin`, chặn cổng 27017 khỏi Internet.
6. **Bật xác thực RabbitMQ**: xoá tài khoản `guest/guest` mặc định trong `RABBITMQ_URI`, tạo vhost và
   user riêng, giới hạn quyền theo queue.
7. **Sao lưu MongoDB**: lịch `mongodump` hằng ngày + giữ tối thiểu 30 bản, kiểm thử khôi phục định kỳ,
   lưu bản sao ở nơi khác máy chủ ứng dụng. Dữ liệu phản ánh của công dân là dữ liệu cá nhân.
8. **Rà quyền truy cập thư mục `uploads`**: đặt ngoài thư mục mã nguồn, quyền `0750`, chủ sở hữu là
   user chạy tiến trình Node, **không** để nginx phục vụ tĩnh thư mục này (mọi truy cập phải đi qua
   API để được kiểm tra chữ ký). Cân nhắc chuyển hẳn sang S3/MinIO với bucket private.
9. **Hoàn tất xác thực thật ở 3 client** (phát hiện **C-03**): admin-web gọi `/auth/staff/login` và
   bảo vệ route bằng middleware phía máy chủ; mobile chuyển token sang `flutter_secure_storage`;
   gỡ toàn bộ `NEXT_PUBLIC_DEMO_*`.
10. **Bổ sung thu hồi phiên** (phát hiện **TB-01**) trước khi phát hành cho người dùng thật —
    nếu không, thao tác "khoá tài khoản" trên Web Quản trị chỉ có tác dụng sau tối đa 8 giờ.
11. **Quy ước tệp riêng tư**: mọi bản scan văn bản, ảnh phản ánh tải lên phải đặt `isPrivate = true`
    (phát hiện **TB-09**).
12. **Bật ghi log tập trung** và giữ nhật ký thao tác (`AuditInterceptor`) tối thiểu 12 tháng.

---

## 5. Ngoài phạm vi Phase 1

Các hạng mục dưới đây **không** thuộc khối lượng công việc Phase 1, cần lập kế hoạch và dự toán riêng:

- **Kiểm thử xâm nhập (pentest) chuyên sâu** do đơn vị độc lập thực hiện, kèm báo cáo và vòng vá lỗi.
- **WAF (Web Application Firewall)** trước API Gateway — lọc OWASP Top 10, chống bot, chống DDoS tầng ứng dụng.
- **SIEM / giám sát an ninh tập trung** — thu thập log, phát hiện bất thường, cảnh báo thời gian thực.
- Mã hoá dữ liệu ở tầng lưu trữ (encryption at rest) cho MongoDB và kho tệp.
- Quản lý bí mật tập trung (HashiCorp Vault, AWS Secrets Manager) thay cho tệp `.env`.
- Xác thực đa yếu tố (MFA) cho tài khoản quản trị hệ thống.
- Đánh giá tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân và quy định an toàn thông tin
  cấp độ hệ thống theo Nghị định 85/2016/NĐ-CP.
- Quét mã tự động trong CI (SAST/DAST/dependency scanning) và quy trình vá lỗ hổng có SLA.
- Diễn tập khôi phục sau thảm hoạ (DR drill).

---

## Phụ lục — Các tệp đã thay đổi trong task P4-36

| Tệp | Nội dung |
|---|---|
| `backend/apps/api-gateway/src/security.middleware.ts` | **Mới.** Security header thủ công (thay helmet), dựng whitelist CORS, kiểm tra bí mật production |
| `backend/apps/api-gateway/src/main.ts` | Gắn security header, CORS whitelist, giới hạn body, `trust proxy`, tắt `x-powered-by`, `forbidNonWhitelisted` |
| `backend/libs/shared/src/config/configuration.ts` | Thêm `security.corsOrigins`, `security.bodyLimit`, `security.hstsMaxAge`, `security.trustProxy` |
| `backend/.env.example` | Thêm `CORS_ORIGINS`, `BODY_LIMIT`, `HSTS_MAX_AGE`, `TRUST_PROXY`, `STORAGE_MAX_FILE_SIZE` + cảnh báo `JWT_SECRET` |
| `backend/apps/api-gateway/src/modules/files/files.service.ts` | Kiểm tra quyền cấp link tệp riêng tư (**C-01**), chặn MIME thực thi được (**C-02**), `openForDownload` kiểm chữ ký trước khi đọc đĩa (**T-02**) |
| `backend/apps/api-gateway/src/modules/files/files.controller.ts` | Truyền người gọi vào `signedUrl`, `Content-Disposition: attachment` cho định dạng không an toàn, thêm `nosniff` (**C-01**, **C-02**) |
| `backend/apps/api-gateway/src/modules/feedback/feedback.service.ts` | Che số điện thoại công dân ở mọi phản hồi cho cán bộ (**TB-02**) |
| `backend/apps/api-gateway/src/modules/auth/auth.controller.ts` | Hạn mức 5 lượt/phút cho login, OTP, định danh Zalo (**TB-03**) |
| `backend/apps/api-gateway/src/modules/auth/auth.service.ts` | Giới hạn 5 lần nhập sai OTP (**TB-03**), sinh OTP bằng `crypto.randomInt` (**TB-04**) |
| `backend/test/smoke.e2e-spec.ts` | Đồng bộ `ValidationPipe` với `main.ts` (thêm `forbidNonWhitelisted`) |
