# ViGov — Tài liệu Backend (API Gateway)

Tài liệu bàn giao cho đội tiếp nhận. Mô tả kiến trúc, quy ước và những chỗ dễ
vấp của backend ViGov.

| | |
|---|---|
| Công nghệ | NestJS 11 · TypeScript · MongoDB (Mongoose 8) · RabbitMQ · Socket.IO |
| Thư mục | `../backend/` |
| Cổng mặc định | `3001`, tiền tố `/api/v1` |
| Quy mô | 19 module · 125 route · 21 collection |
| Kiểm thử | 167 unit test + 46 e2e (2 tệp) |

---

## 1. Cấu trúc thư mục

```
backend/
├─ apps/api-gateway/src/
│  ├─ main.ts                 Bootstrap: CORS, helmet, body limit, trust proxy
│  ├─ app.module.ts           ConfigModule, Mongoose, Throttler, gom 19 module
│  ├─ seed.ts                 Nạp dữ liệu khởi tạo (idempotent)
│  ├─ seed-data/              Dữ liệu seed + tiện ích chuyển đổi
│  └─ modules/<tên>/          Mỗi phân hệ một thư mục
│     ├─ *.controller.ts      Định tuyến + phân quyền
│     ├─ *.service.ts         Nghiệp vụ
│     ├─ *.module.ts          Khai báo model dùng trong module
│     ├─ dto/                 DTO + ràng buộc dữ liệu vào
│     └─ schemas/             Schema riêng của module (nếu có)
└─ libs/shared/src/
   ├─ auth/                   RBAC, JwtAuthGuard, sổ phiên đăng nhập
   ├─ config/configuration.ts Toàn bộ biến môi trường đọc qua đây
   ├─ events/events.ts        Hợp đồng sự kiện giữa các module
   └─ schemas/                Schema dùng chung nhiều module
```

**Quy ước đặt schema.** Schema dùng ở nhiều module đặt tại `libs/shared/src/schemas`
(`tasks`, `documents`, `feedbacks`, `staff_users`, `citizen_users`…). Schema chỉ
một module dùng thì để cục bộ trong module đó — ví dụ `org_nodes`,
`feedback_categories` (module Settings), `gov_contacts` (module Catalogs). Đưa hết
vào `shared` sẽ làm ranh giới module nhoè đi.

---

## 2. Mười chín module

| Module | Route | Vai trò |
|---|---|---|
| `users` | 19 | Tài khoản cán bộ, tài khoản công dân, phiên đăng nhập, danh sách chặn |
| `content` | 19 | CMS: bài viết, video, bản tin truyền thanh — kèm nhóm `/public` cho công dân |
| `settings` | 12 | SLA, cây tổ chức, lĩnh vực phản ánh, danh mục vai trò |
| `feedback` | 10 | Phản ánh của người dân, luồng xử lý và SLA |
| `catalogs` | 9 | Danh mục dùng chung cho dropdown + danh bạ công khai |
| `map` | 8 | Bản đồ kinh tế số: lớp dữ liệu và ghim |
| `documents` | 8 | Văn bản đến, đơn thư, OCR |
| `disbursement` | 8 | Giải ngân, đề nghị, vướng mắc |
| `tasks` | 7 | Nhiệm vụ, checklist, bình luận |
| `reports` | 5 | Tổng hợp, dashboard, kết xuất |
| `auth` | 5 | Đăng nhập cán bộ, OTP công dân, định danh Zalo |
| `notification` | 4 | Hộp thư trong ứng dụng, gửi hàng loạt |
| `files` | 4 | Kho tệp, liên kết ký số có hạn |
| `workflow` | 3 | Luồng liên phân hệ, cảnh báo SLA theo lịch |
| `search` | 1 | Tìm kiếm toàn cục |
| `audit` | 1 | Nhật ký thao tác |
| `integrations` | — | Adapter OCR / GIS / ZNS / FCM |
| `realtime` | — | Cổng Socket.IO |
| `messaging` | — | Publisher/consumer RabbitMQ |

---

## 3. Xác thực và phân quyền

### 3.1 Hai luồng đăng nhập

| Đối tượng | Endpoint | Cơ chế |
|---|---|---|
| Cán bộ | `POST /auth/staff/login` | Tài khoản + mật khẩu (bcrypt), giới hạn 5 lượt/phút |
| Công dân | `POST /auth/citizen/otp/request` → `/verify` | OTP 6 số, có hạn mức chống dò |
| Công dân qua Zalo | `POST /auth/citizen/zalo/identify` | Token định danh của Zalo |

### 3.2 RBAC

**5 vai trò** × **10 phân hệ** × **4 mức quyền** (`view` < `edit` < `approve` < `admin`).

- Vai trò: `admin`, `leader`, `officer`, `accountant`, `receptionist`
- Phân hệ: `overview`, `tasks`, `documents`, `disbursement`, `feedback`, `map`,
  `reports`, `cms`, `users`, `settings`
- Định nghĩa tại `libs/shared/src/auth/roles.ts`, đồng bộ với
  `../admin-web/src/config/roles.config.ts` — **sửa một bên phải sửa cả hai**.

`JwtAuthGuard` là guard toàn cục. Endpoint công khai phải đánh dấu `@Public()`;
endpoint cần quyền cụ thể dùng `@RequirePermission('module', 'level')`.

Công dân (`roleKey: citizen`) bị 403 ở mọi API quản trị — đã có test bảo vệ.

### 3.3 Thu hồi phiên

JWT mang `sid` trỏ tới bản ghi `login_sessions`. Mỗi request, `JwtAuthGuard` tra
`SessionRegistry.isActive(sid)`:

- Không tìm thấy bản ghi phiên → coi như **đã thu hồi** → 401
- `revoked = true` → 401
- Chủ tài khoản bị khoá hoặc đã xoá → 401

Kết quả tra được nhớ tạm **10 giây** (`session-registry.ts`), nên thao tác khoá
tài khoản có hiệu lực chậm nhất sau 10 giây. Khi chạy nhiều instance, mỗi
instance có bộ nhớ đệm riêng — vẫn đúng, chỉ trễ như nhau.

> **Điểm dễ vấp khi vận hành.** Nếu `login_sessions` bị xoá (ví dụ chạy seed với
> `--fresh`), **mọi token đang lưu ở trình duyệt lập tức hết hiệu lực** và người
> dùng bị đăng xuất. Đây là hành vi đúng nhưng hay gây hoang mang.

---

## 4. Hợp đồng sự kiện

`libs/shared/src/events/events.ts` định nghĩa tên và kiểu dữ liệu của sự kiện đi
qua RabbitMQ. Module phát và module nhận không import lẫn nhau, chỉ cùng import
hợp đồng này.

| Sự kiện | Phát khi | Hệ quả |
|---|---|---|
| `document.assigned` | Văn bản được phân công bộ phận chủ trì | Tạo nhiệm vụ theo dõi |
| `feedback.assigned` | Phản ánh được phân công cán bộ | Tạo nhiệm vụ xử lý |
| `feedback.created` | Công dân gửi phản ánh mới | Thông báo tiếp nhận |
| `feedback.resolved` | Phản ánh xử lý xong | Thông báo cho công dân |
| `task.deadline.warning` | Nhiệm vụ sắp/quá hạn | Nhắc người thực hiện |
| `disbursement.requested` | Đề nghị giải ngân chờ duyệt | Thông báo người duyệt |
| `notification.requested` | Yêu cầu gửi ZNS / push / in-app | Notification module xử lý |

**Còn dở:** `workflow.service.ts` có hai chỗ đánh dấu `TODO` chưa phát sự kiện
(thông báo ZNS cho công dân ở dòng 219, cảnh báo SLA cho cán bộ ở dòng 281).

---

## 5. Bảo vệ dữ liệu cá nhân

Số điện thoại công dân **luôn được che** trước khi trả ra API:
`0987654321` → `098•••321`. Cài đặt tại `users.service.ts`.

Bốn nơi trả dữ liệu đã che: danh sách công dân, phiên đăng nhập, danh sách chặn,
và số người gửi trong phiếu phản ánh.

> **Hệ quả quan trọng cho người tích hợp.** Số đã che **không tra ngược được**, và
> hai công dân khác nhau có thể cho ra cùng một chuỗi che. Vì vậy mọi thao tác
> trên tài khoản công dân phải dùng **`id`**, không dùng số điện thoại:
>
> - Dùng: `PATCH /users/citizens/id/:id/lock`
> - Không dùng: `PATCH /users/citizens/:phone/lock` (chỉ giữ cho client cũ có số thật)
>
> Đây từng là lỗi thật: giao diện gửi số đã che lên route theo số thật và nhận
> 404 ở mọi lần khoá tài khoản.

---

## 6. Quy ước bắt buộc

**Không hardcode.** Mọi cấu hình đọc qua `ConfigService`, khai báo tại
`libs/shared/src/config/configuration.ts`. Không đọc `process.env` rải rác.

**Adapter cho dịch vụ bên thứ ba.** OCR, GIS, ZNS, FCM đều đi qua adapter trong
module `integrations`. Đổi nhà cung cấp chỉ sửa một tệp adapter, không đụng tầng
nghiệp vụ. Hiện cả bốn chạy chế độ `mock` (chờ khách chốt — xem mục 9).

**Danh mục lấy từ dữ liệu thật.** `CatalogsService` suy danh mục từ giá trị phân
biệt của chính các collection nghiệp vụ, không khai hằng số cứng — thêm bản ghi
mới là danh mục tự có thêm lựa chọn.

Hai ngoại lệ có chủ ý, đều hợp nhất thêm bộ mặc định vì nếu trả rỗng thì **không
tạo được bản ghi đầu tiên**:
- `document-types` — form tiếp nhận văn bản cần danh sách này để tạo văn bản đầu tiên
- `feedback_categories` — Mini App cần lĩnh vực để người dân chọn khi gửi phản ánh

**Tên trường thống nhất 4 module.** `../admin-web/src/types/index.ts` là nguồn chuẩn.

---

## 7. Chạy và kiểm thử

```bash
cd backend
npm install
cp .env.example .env.local          # ứng dụng đọc .env.local, KHÔNG đọc .env
docker compose up -d                # mongo + rabbitmq cho môi trường phát triển
npm run seed                        # 10 tài khoản + cấu hình SLA
npm run start:dev                   # http://localhost:3001/api/v1

npm run typecheck
npm test                            # 167 unit test
npm run test:e2e                    # 46 test đầu-cuối, CẦN MongoDB
```

> Test e2e cần thư mục tạm còn trên **500 MB** — MongoDB từ chối tạo text index
> khi đĩa gần đầy, lỗi hiện ra là `text index required for $text query`.

Seed **idempotent** (upsert theo khoá tự nhiên): chạy lại không tạo bản ghi trùng,
nhưng cũng **không ghi đè mật khẩu đã đổi**. Muốn đặt lại mật khẩu tài khoản đã
tồn tại thì phải xoá bản ghi rồi seed lại.

---

## 8. Kiểm tra tình trạng

| Endpoint | Dùng để |
|---|---|
| `GET /health` | Tiến trình còn sống (liveness) |
| `GET /health/ready` | Sẵn sàng nhận việc — kèm trạng thái MongoDB và RabbitMQ |

`/health/ready` trả `messaging.blocked` để phát hiện RabbitMQ chặn publish khi
máy chủ hết dung lượng đĩa — sự cố đã gặp thật trong quá trình phát triển.

---

## 9. Việc còn dở và phụ thuộc bên ngoài

| Hạng mục | Tình trạng |
|---|---|
| OCR, GIS, ZNS, FCM | Adapter chạy mock — chờ khách chốt nhà cung cấp |
| Tra cứu hồ sơ (WBS #15) | **Không có endpoint** — tra vào hệ thống một cửa của tỉnh, hệ thống ngoài, chưa có đầu nối |
| Refresh token | Có biến `REFRESH_EXPIRES_IN` nhưng chưa có luồng cấp lại. Token sống 8 giờ |
| Kho OTP | Nằm trong bộ nhớ tiến trình — hỏng khi chạy nhiều instance |
| Socket.IO nhiều instance | Chưa có adapter Redis |
| Chức danh cán bộ | Đang dùng nhãn vai trò RBAC thay cho chức danh thật — chờ khách chốt |
| Kết xuất PDF/PPTX | Trả 501 có chủ ý ở Phase 1 |

Chi tiết rủi ro bảo mật và 12 việc bắt buộc trước production: xem `../SECURITY.md`.

---

## 10. Tài liệu liên quan

`02-ADMIN-WEB.md` · `03-ZALO-MINIAPP.md` · `04-TRIEN-KHAI.md` ·
`../SECURITY.md` · `../deploy/README.md` · `../plans/` (plan chi tiết từng task)
