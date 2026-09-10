# ViGov — Rà soát & gia cố bảo mật (task P4-36, WBS #36)

Phạm vi: nền tảng ViGov Phase 1 gồm `backend/` (NestJS 11 + MongoDB + JWT),
`admin-web/` (Next.js 16), `zalo-miniapp/` (Vite + React).

> **Cập nhật 09/09/2026** — module `mobile/` (app Flutter) đã được **bỏ khỏi dự án**:
> kênh công dân chỉ còn Zalo Mini App. Các phát hiện nhắc tới `mobile` bên dưới
> (**C-03**, **T-06**, mục 10) được giữ nguyên vì đây là biên bản rà soát ngày
> 28/08/2026 — chúng không còn áp dụng, không cần xử lý lại.

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
| 22 | Kiểm soát quyền cấp link tệp riêng tư | ✅ Đã sửa | `GET /files/:id/signed-url`: công dân chỉ ký được tệp do chính mình tải lên. Tệp thuộc phiếu của họ nhưng do cán bộ tải lên thì được cấp link qua `mintSignedUrl` từ endpoint đã lọc `citizenPhone` (TB-16) |
| 23 | Chặn tệp thực thi được trong trình duyệt | ✅ Đã sửa | Cấm HTML/SVG/JS…; tệp lạ buộc `attachment` |
| 24 | Chống path traversal khi lưu tệp | ✅ Có sẵn | Regex khoá an toàn + đối chiếu đường dẫn tuyệt đối |
| 25 | Giới hạn dung lượng tệp tải lên | ✅ Có sẵn | Multer `limits.fileSize` + kiểm tra lại ở service |
| 26 | Chữ ký link tệp riêng tư | ✅ Có sẵn | HMAC-SHA256, so sánh bằng `timingSafeEqual`, TTL tối đa 24 giờ |
| 27 | Nhật ký thao tác (audit log) che trường nhạy cảm | ✅ Có sẵn | `AuditInterceptor` che password/token/otp/**apiKey** |
| 28 | Escape từ khoá người dùng trước khi ghép `$regex` | ✅ Có sẵn | Users, Feedback, Search đều escape |
| 29 | Thu hồi token khi khoá tài khoản / thu hồi phiên | ✅ Có sẵn | `sid` trong payload JWT + `SessionRegistry` tra lại phiên/trạng thái chủ tài khoản (nhớ tạm 10 giây) |
| 30 | Refresh token + xoay vòng token | ✅ Có sẵn | `POST /auth/refresh`, băm bcrypt lưu trên `login_sessions`, xoay vòng mỗi lượt, dùng lại token cũ thì thu hồi phiên |
| 31 | Xác thực MongoDB / RabbitMQ | ❌ Chưa làm | Xem mục 4 — việc cần làm trước production |
| 32 | HTTPS/TLS đầu vào | ❌ Chưa làm | Do hạ tầng triển khai đảm nhiệm |
| 33 | Xác thực thật ở admin-web / mobile / Zalo Mini App | ✅ Có sẵn | Cả 3 client gọi API thật; chế độ mock chỉ còn là lựa chọn có chủ ý để trình diễn giao diện |
| 34 | Quét mã tự động (SAST/DAST), pentest | ❌ Ngoài phạm vi | Xem mục 5 |
| 35 | Tệp nghiệp vụ bắt buộc `isPrivate` ở MỌI đường gắn | ✅ Đã làm | `findPrivateById` — gồm cả `resultImageFileIds` của phản ánh (bổ sung sau khi rà lại TB-09) |
| 36 | Công dân chỉ đọc được tệp của phiếu CHÍNH MÌNH | ✅ Đã làm | `mintSignedUrl` chỉ nhận mã tệp lấy từ bản ghi đã lọc theo `citizenPhone` (TB-16) |
| 37 | Ảnh riêng tư hiển thị được trong webview Zalo | ✅ Đã sửa | `Cross-Origin-Resource-Policy: cross-origin` cho tệp đã qua kiểm chữ ký (TB-17) |
| 38 | Endpoint mở cho công dân được khai TƯỜNG MINH | ⚠️ Một phần | `@AnyAuthenticated('<lý do>')` — đã khai 2 route kho tệp; còn 12 route, xem TB-18 |
| 39 | Mã hoá khoá API nhà cung cấp trước khi lưu vào MongoDB | ✅ Đã làm 10/09/2026 | AES-256-GCM, khoá suy từ `JWT_SECRET` bằng HKDF (`libs/shared/src/crypto/secret-box.ts`). Bản `mongodump` lọt ra ngoài mà không có tệp env thì không giải mã được. Trường `select: false`; API chỉ trả khoá đã che |

---

## 2. Danh sách phát hiện theo mức độ

### Mức CAO

| Mã | Phát hiện | Trạng thái |
|---|---|---|
| **C-01** | **Ai đăng nhập cũng xin được link đọc tệp riêng tư bất kỳ.** `GET /files/:id/signed-url` chỉ đi qua `JwtAuthGuard` mà không kiểm tra chủ sở hữu. Một tài khoản công dân (định danh chỉ bằng OTP) chỉ cần dò mã ObjectId là lấy được link ký sẵn để đọc bản scan văn bản, đơn thư nội bộ. | ✅ **ĐÃ SỬA** |
| **C-02** | **Stored XSS qua tệp tải lên.** Mục đích `other` không giới hạn MIME, còn route đọc tệp luôn trả `Content-Disposition: inline`. Kẻ xấu tải lên tệp `text/html` (hoặc `image/svg+xml`) chứa script rồi phát tán link `/api/v1/files/<id>` — mã chạy ngay trên tên miền API. | ✅ **ĐÃ SỬA** — gia cố thêm 10/09/2026: `other` chuyển sang danh sách trắng, và loại tệp nay kiểm qua ba tầng (MIME · đuôi tệp · magic bytes) thay vì chỉ MIME do client khai |
| **C-03** | **Xác thực phía client hoàn toàn là mock.** `admin-web/src/services/auth.ts` so sánh mật khẩu ngay trong trình duyệt với `NEXT_PUBLIC_DEMO_*` rồi ghi phiên vào `localStorage`; `AuthGuard.tsx` chỉ ẩn giao diện phía client, không có middleware chặn ở tầng route. Mobile (`identity_service.dart`) và Zalo Mini App cũng lưu phiên mock. **Không được đưa lên môi trường thật ở trạng thái này.** | ✅ **ĐÃ SỬA** — cả 3 client đăng nhập qua API thật (P5-01/02/03); mock nay phải bật tường minh bằng cờ môi trường và bị cấm ở staging/production |
| **C-04** | **`JWT_SECRET` mẫu dùng chung cho cả ký token và ký link tệp.** Nếu lên production mà quên đổi, mọi token và mọi link tệp riêng tư đều giả mạo được. | ✅ **ĐÃ SỬA** (chặn khởi động) — vẫn phải đổi khoá thật, xem mục 4 |
| **C-05** | **Bản scan gửi ra dịch vụ OCR miễn phí đặt ở nước ngoài.** Khi `OCR_PROVIDER=ocrspace`, mỗi bản scan cán bộ tải lên được gửi tới ocr.space để đọc chữ. Văn bản hành chính có thể chứa họ tên, địa chỉ, số điện thoại công dân; gửi ra ngoài như vậy chưa có cơ sở pháp lý theo NĐ 13/2023 và chưa có thoả thuận xử lý dữ liệu với nhà cung cấp. *Ghi chú lịch sử: bản đầu có khối chặn ở production nhưng đọc sai tên khoá cấu hình (`nodeEnv` thay vì `env`) nên khối đó chưa bao giờ chạy, và không test nào chạm tới nên lỗi lọt qua CI.* | ⚠ **RỦI RO ĐƯỢC CHẤP NHẬN 10/09/2026** — chủ sản phẩm quyết định cho phép chọn provider tự do và **tự chịu trách nhiệm** với dữ liệu đưa vào; khối chặn theo môi trường đã **bỏ hẳn** (mã không phân biệt production/dev). Bù lại có hai lớp luôn bật: **cảnh báo hiện trên giao diện** mỗi lần cán bộ quét, và **một dòng `warn` mỗi lượt gọi** làm vết. Còn phải chốt nhà cung cấp trong nước — xem mục 4 việc `0-bis` |

### Mức TRUNG BÌNH

| Mã | Phát hiện | Trạng thái |
|---|---|---|
| **TB-01** | **Khoá tài khoản / thu hồi phiên không làm token hết hiệu lực.** `JwtAuthGuard` chỉ kiểm tra chữ ký, không tra lại `staff_users.status`, `citizen_users.status` hay `login_sessions.revoked`. Người bị khoá vẫn dùng được token cũ tới 8 giờ. | ✅ **ĐÃ SỬA** (P5-08) — payload mang `sid`, `SessionRegistry.isActive` tra `login_sessions.revoked` + trạng thái khoá/xoá mềm của chủ tài khoản; hiệu lực chậm nhất 10 giây do bộ nhớ đệm |
| **TB-02** | **Rò rỉ số điện thoại đầy đủ ở phân hệ Phản ánh.** `GET /feedback` và `GET /feedback/:code` trả `citizenPhone` nguyên vẹn, trong khi phân hệ Người dùng đã có chính sách che số. | ✅ **ĐÃ SỬA** |
| **TB-03** | **Không có hạn mức riêng cho endpoint đăng nhập / OTP.** Hạn mức chung 120 lượt/phút đủ để dò mật khẩu và quét mã OTP 6 chữ số (mã sống 5 phút, không đếm số lần sai). | ✅ **ĐÃ SỬA** (5 lượt/phút + tối đa 5 lần sai OTP) |
| **TB-04** | **OTP sinh bằng `Math.random()`** — không phải nguồn ngẫu nhiên mật mã, có thể dự đoán. | ✅ **ĐÃ SỬA** (`crypto.randomInt`) |
| **TB-05** | **Không giới hạn kích thước thân yêu cầu JSON.** Mặc định của Express là 100KB nhưng dự án chưa khai báo tường minh; các trường mô tả cho phép tới 5.000 ký tự. | ✅ **ĐÃ SỬA** (`BODY_LIMIT`) |
| **TB-06** | **CORS mở cho mọi nguồn** (`app.enableCors()` không tham số). | ✅ **ĐÃ SỬA** (whitelist `CORS_ORIGINS`) |
| **TB-07** | **Thiếu toàn bộ security header** (nosniff, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy, CSP) và vẫn để lộ `X-Powered-By: Express`. | ✅ **ĐÃ SỬA** |
| **TB-08** | **Kho OTP nằm trong bộ nhớ tiến trình.** Khi chạy nhiều instance sau load balancer, mã sinh ở instance A không xác thực được ở instance B; đồng thời bộ đếm nhập sai cũng không dùng chung. | ✅ **ĐÃ SỬA** — `OtpStore` có hai driver chọn bằng `OTP_STORE`: `memory` (mặc định, một instance) và `mongo` (bảng `otp_codes` có TTL index). Dùng Mongo chứ không Redis để không thêm một dịch vụ phải dựng/bảo mật/sao lưu. Cả hai driver chỉ lưu **HMAC** của mã, không lưu mã dạng rõ. **Chạy nhiều instance thì BẮT BUỘC đặt `OTP_STORE=mongo`** |
| **TB-09** | **Tệp công khai đọc được không cần đăng nhập.** `GET /files/:id` để `@Public()`; tệp `isPrivate = false` chỉ được bảo vệ bằng độ khó đoán của ObjectId — mà ObjectId chứa dấu thời gian và bộ đếm nên đoán được một phần. | ⚠️ Còn tồn đọng — quy ước: mọi tệp nghiệp vụ (scan văn bản, ảnh phản ánh) phải tải lên với `isPrivate = true`. Quy ước này nay được **cưỡng chế bằng mã** ở MỌI đường gắn tệp vào bản ghi nghiệp vụ, qua `FilesService.findPrivateById`: tệp đính kèm nhiệm vụ, ảnh hiện trường và ảnh nghiệm thu của phản ánh, bản scan và tệp đính kèm văn bản — tệp công khai bị từ chối 400. Tệp nội dung CMS (ảnh bìa, audio truyền thanh, video) vẫn công khai **có chủ ý**: đó là nội dung đăng cho công dân xem. **Cập nhật:** trước đây `FeedbackService.resolve` là lỗ hở duy nhất còn lại — nó nhận `resultImageFileIds` mà KHÔNG kiểm tệp riêng tư, nên tài liệu này khai quá thực tế. Nay đã kiểm; xem thêm TB-16 về đường cấp link cho công dân |
| **TB-16** | **Công dân không xem được ảnh nghiệm thu của phiếu mình gửi.** `FilesService.assertCanSign` phân quyền ký link theo **người tải lên** (`uploadedBy`), nên ảnh nghiệm thu do cán bộ chụp bị chặn với chính công dân chủ phiếu. Cách dễ nhất để "chữa" là đặt ảnh nghiệm thu thành công khai — và đó là cách sai: ảnh "đã tháo biển quảng cáo nhà số 12" là ảnh một căn nhà cụ thể, dữ liệu cá nhân theo NĐ 13/2023. | ✅ Đã sửa — phân quyền theo **bản ghi nghiệp vụ** thay vì theo người tải lên. `GET /feedback/citizen/mine/**` (đã lọc `{ code, citizenPhone }` ngay trong truy vấn) tự cấp link ký sẵn cho cả `imageUrls` và `resultImageUrls` qua `FilesService.mintSignedUrl`, hiệu lực 1 giờ. Không tệp nào phải để công khai. `assertCanSign` **giữ nguyên** cho `GET /files/:id/signed-url` — endpoint nhận mã tệp thẳng từ client vẫn chặn công dân ký tệp của cán bộ (có test e2e xác nhận 403) |
| **TB-17** | **Ảnh riêng tư không hiển thị được trong Zalo Mini App.** `securityHeaders` đặt `Cross-Origin-Resource-Policy: same-site` cho toàn bộ API, và `GET /files/:id` chỉ nới thành `cross-origin` cho tệp CÔNG KHAI. Mini App chạy ở `h5.zdn.vn` — khác site với tên miền API — nên trình duyệt **chặn im lặng** mọi thẻ `<img>` trỏ tới tệp riêng tư: người dân gửi ảnh xong mở phiếu ra chỉ thấy ô ảnh trống, không có lỗi nào để lần theo. Mà ảnh phản ánh BẮT BUỘC riêng tư (TB-09), nên đúng thứ cần hiển thị lại là thứ duy nhất bị chặn. | ✅ Đã sửa — đặt `cross-origin` cho mọi tệp phục vụ qua `GET /files/:id`. CORP không có danh sách cho phép (chỉ same-origin / same-site / cross-origin) nên phục vụ webview khác site thì buộc phải nới. **Đánh đổi đã cân:** tệp riêng tư tới được chỗ đặt header thì ĐÃ qua kiểm chữ ký ở `openForStream`, nên điều kiện đọc vẫn là "có link ký sẵn còn hiệu lực" y như trước; phần mất đi chỉ là việc trang ngoài không nhúng được một link ĐÃ bị lộ — mà link đã lộ thì mở trực tiếp cũng đọc được. Lớp bảo vệ thật vì vậy là **TTL ngắn**: `DEFAULT_SIGNED_URL_TTL_SECONDS` 5 phút, `CITIZEN_IMAGE_URL_TTL_SECONDS` 1 giờ — **không nâng hai giá trị này để "tiện"**. Có test e2e khẳng định header, vì đây là lỗi im lặng (header đúng cú pháp, `curl` tải được, chỉ webview chặn) |
| **TB-18** | **12 endpoint chưa khai quyền tường minh; trong đó 6 endpoint danh mục đang mở cho token công dân.** `JwtAuthGuard` không có `@RequirePermission` thì cho qua mọi vai trò đã đăng nhập — đúng ý đồ ở kho tệp và `/geo`, nhưng `GET /catalogs/staff` trả **danh bạ cán bộ** (họ tên, bộ phận) và `GET /catalogs/areas` · `article-categories` · `video-topics` · `radio-categories` · `budget-years` trả danh mục điều hành nội bộ. Rà các client: Mini App và app Flutter chỉ gọi `/catalogs/public/directory` (đã `@Public()`), **không** client công dân nào gọi 6 endpoint trên — nghĩa là siết lại không làm hỏng luồng nào. Ngoài ra `GET /auth/me/sessions`, `DELETE /auth/me/sessions/:id`, `GET /notification`, `GET /geo/*` là dữ liệu của chính người gọi hoặc dịch vụ dùng chung, mở cho công dân là đúng. | ⚠️ Còn tồn đọng — đã khai `@AnyAuthenticated('<lý do>')` cho 2 route của kho tệp (`POST /files/upload`, `GET /files/:id/signed-url`) kèm test 401 / cán bộ 200 / công dân 200. **12 route còn lại chưa xử lý** vì phải chọn giữa hai hướng: (a) `@AnyAuthenticated` — khai đúng hiện trạng, giữ nguyên hành vi; (b) `@RequirePermission` cho nhóm `catalogs` — **đổi hành vi**, token công dân sẽ nhận 403, cần chốt phân hệ/quyền cho từng danh mục sao cho vai trò *officer* / *receptionist* vẫn dùng được dropdown phân công. Cách rà lại: chạy lại logic của `.claude/hooks/rbac_audit_guard.py` trên toàn bộ `*.controller.ts` (hook chỉ soi tệp vừa sửa) |
| **TB-10** | **Dò tài khoản qua thời gian phản hồi.** `staffLogin` chỉ chạy `bcrypt.compare` khi tìm thấy tài khoản, nên sai tên đăng nhập trả lời nhanh hơn hẳn sai mật khẩu. | ⚠️ Còn tồn đọng — mức rủi ro thấp sau khi đã siết 5 lượt/phút; xử lý bằng cách luôn so sánh với một hash giả |

### Mức THẤP

| Mã | Phát hiện | Trạng thái |
|---|---|---|
| **T-01** | Chưa cấu hình `trust proxy`: sau nginx thì `req.ip` là IP của proxy, làm rate-limit đếm gộp mọi người dùng và nhật ký ghi sai IP. | ✅ **ĐÃ SỬA** (biến `TRUST_PROXY`) |
| **T-02** | Tệp riêng tư được đọc khỏi ổ lưu trữ **trước** khi kiểm tra chữ ký — yêu cầu không hợp lệ vẫn khiến máy chủ đọc đĩa/S3 (lãng phí, dễ bị lạm dụng để gây tải). | ✅ **ĐÃ SỬA** (`openForDownload`) |
| **T-03** | `POST /users/staff` trả mật khẩu tạm trong phản hồi HTTP. Chấp nhận được ở Phase 1 (hiển thị một lần cho quản trị viên) nhưng mật khẩu sẽ nằm trong log/proxy nếu chưa bật HTTPS. | ⚠️ Chấp nhận rủi ro có điều kiện — bắt buộc bật HTTPS trước khi dùng thật |
| **T-04** | Quyền `users:edit` cho phép cả vai trò *Tiếp nhận một cửa* khoá tài khoản công dân và xem danh sách chặn. | ⚠️ Chờ khách chốt — câu hỏi mở #15 |
| **T-05** | `admin-web` đọc mật khẩu demo từ `NEXT_PUBLIC_DEMO_PASSWORD`; biến `NEXT_PUBLIC_*` được nhúng thẳng vào gói JavaScript gửi cho trình duyệt. | ⚠️ Giảm nhẹ — `.env.example` nay để `NEXT_PUBLIC_USE_MOCKS=false` và **bỏ trống** hai biến demo, nên bản sao y mẫu không mang mật khẩu nào. Chỉ còn rủi ro khi ai đó tự điền lại; cách dứt điểm là gỡ hẳn nhánh mock khỏi `services/auth.ts` khi không cần trình diễn offline nữa |
| **T-06** | Mobile lưu phiên trong `SharedPreferences` (không mã hoá). | ✅ **ĐÃ SỬA** — chuyển sang `flutter_secure_storage` (Keychain trên iOS, AES/GCM với khoá trong KeyStore trên Android). `restore()` di trú một lần phiên của bản cũ rồi xoá sạch bản ghi cũ, nên cập nhật app không đá người đang đăng nhập ra ngoài |
| **T-07** | Zalo Mini App lưu phiên trong `localStorage` — chấp nhận được với môi trường Zalo nhưng không được lưu token dài hạn ở đây. | ⚠️ Còn tồn đọng |
| **T-08** | Luồng định danh Zalo chưa kiểm chứng được đầu-cuối với Zalo Open API. | ⚠️ Chờ bên ngoài — `exchangeZaloToken()` đã gọi Zalo Graph API thật, nhưng Zalo **chưa cấp quyền** `getPhoneNumber` nên hiện phải dùng `CITIZEN_OTP_BYPASS_CODE`; xoá biến này ngay khi được cấp quyền |
| **T-09** | Chưa có refresh token / xoay vòng token dù đã khai báo `REFRESH_EXPIRES_IN`. Token sống 8 giờ, mất token là mất phiên trong 8 giờ. | ✅ **ĐÃ SỬA** — `POST /auth/refresh` có xoay vòng và phát hiện dùng lại token cũ (dùng lại thì thu hồi cả phiên). Đánh đổi đã nhận: ai biết `sid` có thể cố tình đóng phiên đó |
| **T-10** | Chưa có chính sách độ mạnh mật khẩu cán bộ và chưa buộc đổi mật khẩu tạm ở lần đăng nhập đầu. | ✅ **ĐÃ SỬA** — chính sách dùng chung ở `libs/shared/src/auth/password-policy.ts` (≥10 ký tự, có chữ và số, không phải mật khẩu phổ biến, không chứa tên đăng nhập) áp cho cả ba đường đổi mật khẩu. Cờ `mustChangePassword` bật khi tạo tài khoản và khi quản trị viên đặt lại; `JwtAuthGuard` chặn MỌI endpoint trừ đường đổi mật khẩu cho tới khi chủ tài khoản tự đặt lại |
| **T-11** | **Tệp Office có macro được phép tải lên** (`.docm .xlsm .pptm .dotm .xltm .potm`). Macro Office là đường lây mã độc phổ biến nhất trong môi trường hành chính: người nhận tải tệp về, mở ra rồi bấm "Enable Content" theo quán tính. Hệ thống **không quét được macro** bên trong. | ⚠️ **Rủi ro đã chấp nhận có ý thức** — khách yêu cầu 10/09/2026 vì cán bộ xã đang dùng biểu mẫu Excel/Word có macro trong công việc thật. Xem mục 4, việc 13 |
| **T-12** | **Tệp nén được phép tải lên** (`.zip .rar .7z`) và hệ thống **không quét được nội dung bên trong** — một tệp thực thi giấu trong `.zip` vẫn vào được kho. | ⚠️ **Rủi ro đã chấp nhận có ý thức** — khách chốt 10/09/2026; cán bộ hay gửi nhiều văn bản một lượt. Chỉ gây hại khi người nhận giải nén rồi chạy |

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

0-bis. **Đưa nhà cung cấp OCR về `mock` hoặc về nhà cung cấp đã có hợp đồng** (phát hiện
   **C-05**). Kiểm ở **Cấu hình → Tích hợp** trên Web Quản trị *và* biến `OCR_PROVIDER` —
   cấu hình ở giao diện thắng biến môi trường, nên sửa env một mình là chưa đủ.
   Để `ocrspace` là mỗi bản scan cán bộ tải lên đều được gửi sang dịch vụ miễn phí
   đặt ở **máy chủ nước ngoài** — chưa có cơ sở pháp lý theo NĐ 13/2023 và chưa có thoả thuận
   xử lý dữ liệu với nhà cung cấp.
   *Trong lúc còn dùng cho bản demo:* chỉ tải lên văn bản mẫu tự tạo (`docs/mau-kiem-thu/`),
   không tải văn bản thật của công dân. Hai endpoint OCR đòi quyền `documents:edit` nên công
   dân không gọi được — phạm vi phơi bày giới hạn ở người dùng Web Quản trị. Rà số lượt bản
   scan đã rời khỏi hệ thống bằng
   `docker compose logs backend | grep "dịch vụ OCR miễn phí"`.
   *Điều kiện để đổi:* đã chốt nhà cung cấp OCR (câu hỏi mở #1) — **ưu tiên nhà cung cấp
   trong nước** để bảo đảm tính pháp lý — và đã viết adapter cho nhà cung cấp đó.

0. **Xoá `CITIZEN_OTP_BYPASS_CODE`** khỏi `.env` (để trống). Đây là mã cố định cho phép định danh
   **bất kỳ số điện thoại nào** ở màn OTP, dựng tạm cho giai đoạn Zalo chưa cấp quyền
   `getPhoneNumber` và mã OTP thật còn chưa gửi được qua SMS/ZNS. Còn giá trị là còn một lối vào
   không qua xác thực thật. Backend cảnh báo mỗi lần khởi động và ghi `warn` kèm số điện thoại +
   IP mỗi lần mã được dùng — rà `docker compose logs backend | grep "mã tạm thời"` để biết đã có
   ai dùng chưa. *Điều kiện để xoá được: quyền `getPhoneNumber` đã cấp và luồng đổi token Zalo
   chạy thật, HOẶC đã nối SMS/ZNS cho OTP.*
   **Lưu ý về sức mạnh mã:** mã buộc phải là 6 chữ số vì ô nhập OTP của Mini App cố định 6 ký tự
   số — không thể đặt dài hơn. Nghĩa là không gian chỉ 10⁶ và thứ duy nhất chặn dò là hạn mức
   `AUTH_THROTTLE` 5 lượt/phút mỗi IP. **Đừng nới hạn mức đó chừng nào biến này còn bật**, và
   đừng chọn dãy dễ đoán (`123456`, `000000`, `112233`).
1. **Đổi `JWT_SECRET`.** Sinh chuỗi ngẫu nhiên ≥ 32 ký tự (`openssl rand -base64 48`), lưu trong
   trình quản lý bí mật, không commit. Khoá này ký cả token đăng nhập lẫn link tệp riêng tư.
   *API Gateway đã được chặn khởi động nếu `NODE_ENV=production` mà khoá còn là giá trị mẫu.*
   **Đổi khoá này còn làm mất khả năng giải mã khoá API của nhà cung cấp đã lưu ở
   Cấu hình → Tích hợp** (khoá mã hoá suy từ `JWT_SECRET` bằng HKDF —
   `libs/shared/src/crypto/secret-box.ts`). Hệ thống không sập: nó coi như chưa có khoá, ghi
   `error` vào log, giao diện báo cần nhập lại. Đổi `JWT_SECRET` thì **nhập lại khoá API**
   ngay sau đó. Thứ tự đúng: đổi `JWT_SECRET` → khởi động lại → vào Cấu hình nhập lại khoá.
2. **Bật HTTPS/TLS** ở nginx/load balancer, chuyển hướng toàn bộ HTTP → HTTPS. HSTS chỉ được gắn
   khi `NODE_ENV=production`, nên phải có TLS trước rồi mới bật cờ production.
3. **Khai báo whitelist CORS thật**: `CORS_ORIGINS=https://<tên-miền-web-quản-trị>,https://h5.zdn.vn`.
   Để trống hoặc `*` ở production sẽ làm ứng dụng không khởi động được (đây là hành vi cố ý).
4. **Đặt `TRUST_PROXY`** đúng số lớp proxy (thường là `1`), nếu không rate-limit và nhật ký sẽ ghi
   nhầm IP của nginx cho mọi người dùng.
5. **Bật xác thực MongoDB**: tạo user riêng cho ViGov với quyền `readWrite` trên đúng một database,
   `MONGO_URI=mongodb://vigov:<mật-khẩu>@host:27017/vigov?authSource=admin`, chặn cổng 27017 khỏi Internet.
6. **Đặt `OTP_STORE=mongo` nếu chạy nhiều hơn một instance backend.** Mặc định `memory` giữ mã OTP
   trong bộ nhớ tiến trình: sau bộ cân bằng tải, mã sinh ở instance A không xác thực được ở instance B,
   và bộ đếm nhập sai không dùng chung nên người dò chỉ cần đổi instance là được thêm lượt.
7. **Bật xác thực RabbitMQ**: xoá tài khoản `guest/guest` mặc định trong `RABBITMQ_URI`, tạo vhost và
   user riêng, giới hạn quyền theo queue.
8. **Sao lưu MongoDB**: lịch `mongodump` hằng ngày + giữ tối thiểu 30 bản, kiểm thử khôi phục định kỳ,
   lưu bản sao ở nơi khác máy chủ ứng dụng. Dữ liệu phản ánh của công dân là dữ liệu cá nhân.
9. **Rà quyền truy cập thư mục `uploads`**: đặt ngoài thư mục mã nguồn, quyền `0750`, chủ sở hữu là
   user chạy tiến trình Node, **không** để nginx phục vụ tĩnh thư mục này (mọi truy cập phải đi qua
   API để được kiểm tra chữ ký). Cân nhắc chuyển hẳn sang S3/MinIO với bucket private.
10. **Hoàn tất xác thực thật ở 3 client** (phát hiện **C-03**): admin-web gọi `/auth/staff/login` và
   bảo vệ route bằng middleware phía máy chủ; mobile chuyển token sang `flutter_secure_storage`;
   gỡ toàn bộ `NEXT_PUBLIC_DEMO_*`.
11. **Bổ sung thu hồi phiên** (phát hiện **TB-01**) trước khi phát hành cho người dùng thật —
    nếu không, thao tác "khoá tài khoản" trên Web Quản trị chỉ có tác dụng sau tối đa 8 giờ.
11. **Quy ước tệp riêng tư**: mọi bản scan văn bản, ảnh phản ánh tải lên phải đặt `isPrivate = true`
    (phát hiện **TB-09**). Nay đã được mã cưỡng chế ở mọi đường gắn tệp, **không** còn là quy ước suông.
    Đi kèm: rà lại `CITIZEN_IMAGE_URL_TTL_SECONDS` (mặc định 1 giờ) — link ký sẵn là **giấy thông hành**,
    ai giữ được link là đọc được tệp trong khoảng đó, nên đừng nâng thời hạn này lên để "tiện" (**TB-16**).
12. **Bật ghi log tập trung** và giữ nhật ký thao tác (`AuditInterceptor`) tối thiểu 12 tháng.

---

13. **Phổ biến rủi ro tệp đính kèm cho người dùng hệ thống.** Kho tệp nay nhận tệp Office
    **có macro** (`.docm .xlsm .pptm`) và tệp **nén** (`.zip .rar .7z`) — hai nhóm hệ thống
    KHÔNG kiểm được nội dung bên trong (phát hiện **T-11**, **T-12**). Cả hai đều là quyết định
    của khách hàng, không phải sơ suất, nhưng đã mở thì phải bù bằng con người và quy trình:

    - Nhắc cán bộ **không bấm "Enable Content"** khi mở tệp Office nhận từ hệ thống, trừ khi
      biết rõ người gửi và mục đích. Đây là bước duy nhất chặn macro chạy.
    - Bật phần mềm diệt virus có quét thời gian thực trên máy cán bộ. Máy chủ không quét được
      macro, nên chốt chặn cuối nằm ở máy trạm.
    - Cấu hình Group Policy của Office: **chặn macro trong tệp đến từ Internet** (Microsoft đã
      mặc định bật từ 2022, nhưng máy cài bản cũ hoặc đã tắt thì phải bật lại).
    - Cảnh báo người dân **không giải nén rồi chạy** tệp lạ nhận qua hệ thống.

    *Nếu về sau có sự cố mã độc qua đường này:* đảo quyết định bằng cách đưa các đuôi macro
    trở lại `BLOCKED_EXTENSIONS` ở
    `backend/apps/api-gateway/src/modules/files/file-type.guard.ts` (khối chú thích ở đó ghi
    đúng chỗ cần sửa và test nào sẽ đỏ). Cân nhắc thêm kho tệp có quét mã độc
    (ClamAV hoặc dịch vụ quét của nhà cung cấp) — hiện thuộc mục 5, ngoài phạm vi Phase 1.

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
| `backend/apps/api-gateway/src/modules/files/file-type.guard.ts` | Kiểm loại tệp ba tầng: MIME · đuôi tệp (danh sách đen + danh sách trắng theo `purpose`) · magic bytes đọc nội dung thật (**C-02**, bổ sung 10/09/2026). Cũng là nơi ghi rõ quyết định cho phép Office có macro (**T-11**) và tệp nén (**T-12**) |
| `backend/apps/api-gateway/src/modules/files/files.controller.ts` | Truyền người gọi vào `signedUrl`, `Content-Disposition: attachment` cho định dạng không an toàn, thêm `nosniff` (**C-01**, **C-02**) |
| `backend/apps/api-gateway/src/modules/feedback/feedback.service.ts` | Che số điện thoại công dân ở mọi phản hồi cho cán bộ (**TB-02**) |
| `backend/apps/api-gateway/src/modules/auth/auth.controller.ts` | Hạn mức 5 lượt/phút cho login, OTP, định danh Zalo (**TB-03**) |
| `backend/apps/api-gateway/src/modules/auth/auth.service.ts` | Giới hạn 5 lần nhập sai OTP (**TB-03**), sinh OTP bằng `crypto.randomInt` (**TB-04**) |
| `backend/test/smoke.e2e-spec.ts` | Đồng bộ `ValidationPipe` với `main.ts` (thêm `forbidNonWhitelisted`) |
