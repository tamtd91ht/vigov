# ViGov — Tài liệu Backend (API Gateway)

Tài liệu bàn giao cho đội tiếp nhận. Mô tả kiến trúc, quy ước và những chỗ dễ
vấp của backend ViGov.

| | |
|---|---|
| Công nghệ | NestJS 11 · TypeScript · MongoDB (Mongoose 8) · RabbitMQ · Socket.IO |
| Thư mục | `../backend/` |
| Cổng mặc định | `3001`, tiền tố `/api/v1` |
| Quy mô | 21 module · 135 route · 22 collection |
| Kiểm thử | 300 unit test + 46 e2e (2 tệp) |

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

## 2. Hai mươi module

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
| `tasks` | 9 | Nhiệm vụ, checklist, bình luận, tệp minh chứng |
| `reports` | 5 | Tổng hợp, dashboard, kết xuất Excel / PDF / PowerPoint |
| `auth` | 7 | Đăng nhập cán bộ, OTP công dân, định danh Zalo, cấp lại token, đổi mật khẩu |
| `dossiers` | 1 | Tra cứu hồ sơ một cửa theo mã (công khai) |
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

Cả ba endpoint trên trả về `{ accessToken, refreshToken, user }`.

Cán bộ tự đổi mật khẩu của mình: `PATCH /auth/me/password` với
`{ currentPassword, newPassword }` → `{ updated: true, revokedSessions: n }`.
Sai mật khẩu hiện tại trả **400, không phải 401** — client coi 401 là phiên hết
hạn và tự đăng xuất, nên trả 401 ở đây là gõ sai mật khẩu một lần bị đá ra trang
đăng nhập. Quy ước chung: endpoint mang token hợp lệ thì lỗi nghiệp vụ đừng dùng
401. Danh tính lấy từ token nên không ai đổi được mật khẩu của người khác qua đây; đổi xong thì **các phiên khác** của chính người đó
bị thu hồi (phiên đang thao tác được giữ lại), dùng lại đúng cơ chế của trang
Bảo mật.

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

### 3.4 Cấp lại token (refresh) — T-09

`POST /auth/refresh` (`@Public()`, hạn mức 5 lượt/phút như cả nhóm auth):

```
{ refreshToken }  →  { accessToken, refreshToken, expiresInSeconds }
```

Refresh token có dạng `<mã phiên>.<bí mật 32 byte>`. Phần mã phiên chỉ để **tra**
bản ghi (bcrypt không tra ngược được, không có nó thì mỗi lần refresh phải quét
cả bảng phiên); thứ xác thực là phần bí mật.

Trên bản ghi `login_sessions` lưu **băm bcrypt** của bí mật (`refreshTokenHash`,
khai `select: false`) và hạn dùng (`refreshExpiresAt`, theo `REFRESH_EXPIRES_IN`).
Không bao giờ lưu token thô: bảng phiên xuất hiện trong backup và công cụ quản
trị, mà token thô cầm được là mở lại phiên suốt 7 ngày.

**Xoay vòng.** Mỗi lần refresh sinh bí mật mới và **ghi đè** băm cũ, nên token
vừa dùng lập tức hết hiệu lực.

**Phát hiện dùng lại.** Gửi một refresh token đã bị xoay vòng → phiên bị
`revoked = true`, bộ nhớ đệm `SessionRegistry` được xoá ngay, trả 401 và ghi
nhật ký mức `warn` (kèm mã phiên và IP, **không** kèm token). Hoặc token bị lộ,
hoặc có người phát lại — cả hai đều phải đóng phiên.

**Trượt trong các trường hợp:** phiên đã thu hồi, chủ tài khoản bị khoá hoặc xoá
mềm (kiểm qua `SessionRegistry.isActive`, đúng cơ chế `JwtAuthGuard` dùng — không
có đường kiểm tra thứ hai), refresh token hết hạn, token sai dạng, tài khoản đã
bị xoá.

Access token mới được dựng lại từ **dữ liệu hiện tại** của chủ phiên, không nhân
bản payload cũ: `JwtAuthGuard` tin thẳng `roleKey` trong token, nên refresh mà
giữ nguyên vai trò cũ là kéo dài vô hạn một quyền đã bị thu hồi.

Phía client: Zalo Mini App gặp 401 thì **thử refresh đúng một lần** rồi mới bắt
định danh lại (`src/services/api.ts`, các lời gọi đồng thời được gộp về một lượt
refresh — nếu không, lời gọi thứ hai gửi token vừa xoay vòng và bị chính cơ chế
phát hiện dùng lại đá ra). App Flutter **chỉ lưu** `refreshToken` cho lần sau,
không dựng interceptor — lý do ghi trong `lib/services/api_client.dart`.

---

### 3.5 Hồ sơ một cửa (WBS #15)

`GET /dossiers/lookup/:code` — `@Public()`, hạn mức **20 lượt/phút** mỗi IP.

```
{ code, procedure, applicantName, applicantPhone, department, assignee, status,
  submittedAt, dueAt, note,
  steps: [ { key, label, at, done } ]   // 4 bước: received → appraising
}                                       //          → awaiting_signature → returned
```

- Mã tra cứu được **chuẩn hoá**: cắt khoảng trắng hai đầu và đưa về chữ HOA.
  Không làm vậy thì hồ sơ có thật vẫn báo "không tìm thấy" khi người dân gõ chữ
  thường — lỗi lặng lẽ nhất của cả màn hình này.
- `applicantPhone` **luôn ở dạng che** (`091•••311`), theo đúng chính sách của
  `UsersService.maskPhone`. Endpoint là công khai nên không có ngoại lệ.
- Không thấy mã → **404** kèm thông báo tiếng Việt có nhắc lại mã đã tra.
- `steps[].done` được **suy từ `status`**, không lưu riêng: bước trước bước hiện
  tại là xong; bước hiện tại chỉ tính là xong khi hồ sơ đã ở bước cuối
  (`returned`). Lưu cờ riêng cho từng bước là mở đường cho dữ liệu tự mâu thuẫn.
- `steps[].at` lấy từ `stepTimes` trên bản ghi (`{ key, at }`). Không dùng
  `timeline` cho việc này vì `TimelineStep` chỉ có `meta` là chuỗi hiển thị đã
  định dạng, không tra ngược ra mốc ISO. Hai trường tồn tại song song có chủ ý:
  `stepTimes` cho máy đọc, `timeline` cho người đọc.
- Hạn mức 20 lượt/phút là cần thiết: mã hồ sơ có dạng đoán được
  (`HS-<năm>-<số thứ tự>`) và mỗi kết quả đều mang tên người nộp hồ sơ.

#### Nguồn dữ liệu hồ sơ — GHI CHÚ QUAN TRỌNG

**Phase 1 KHÔNG có CRUD quản trị hồ sơ.** WBS #15 chỉ yêu cầu *tra cứu*, nên
module `dossiers` cố tình chỉ có duy nhất một endpoint đọc — không có
tạo / sửa / xoá, không có danh sách cho Web Quản trị.

**Dữ liệu hiện tại trong collection `dossiers` là dữ liệu SEED** (ba hồ sơ mẫu,
port từ mock của Zalo Mini App và app Flutter — xem
`apps/api-gateway/src/seed-data/dossiers.seed.ts`). Nó dùng để trình diễn, không
phải hồ sơ thật.

**Nguồn dữ liệu thật phải đến từ hệ thống một cửa** (cấp tỉnh/thành) **qua liên
thông** — đó là một hệ thống ngoài, và hạng mục liên thông đó **khách đã xác
nhận nằm ngoài phạm vi WBS**. Khi có đầu nối, thay phần đọc dữ liệu trong
`DossiersService.lookup` (hoặc thêm một job đồng bộ vào collection này) mà không
phải đổi hợp đồng API — cả hai client đã bám theo hình dạng phản hồi ở trên.

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

### 5.1 Xoá tài khoản công dân là xoá MỀM

`PATCH /users/citizens/id/:id/delete` (quyền `users:admin`) chỉ đặt `deletedAt`
trên `citizen_users`, **không xoá tài liệu**: số điện thoại là khoá liên kết tới
hồ sơ một cửa và phản ánh đã gửi — những dữ liệu xã có nghĩa vụ lưu trữ.

Hệ quả của cờ `deletedAt`:

| Nơi | Hành vi khi `deletedAt` có giá trị |
|---|---|
| `GET /users/citizens` | Ẩn khỏi danh sách; `?deleted=true` mới xem được |
| `GET /users/citizens/stats` | Không tính vào cả ba con số |
| Khoá / mở khoá | 404 — không thao tác trên bản ghi đã xoá |
| Đăng nhập app / Zalo | Bị từ chối ngay ở `issueCitizenToken` |
| Phiên đang mở | Bị thu hồi ngay lúc xoá, `SessionRegistry` trả 401 |
| Thông báo ZNS / push | Không nằm trong danh sách người nhận |
| Danh mục thôn/tổ (`/catalogs/areas`) | Không đóng góp giá trị |

`PATCH /users/citizens/id/:id/restore` gỡ cờ và đưa tài khoản trở lại. Vì
`issueCitizenToken` dùng `upsert` theo số điện thoại, nếu KHÔNG chặn đăng nhập
thì người bị xoá vẫn dùng app bình thường mà quản trị viên không thấy họ ở đâu.

Khác `erasedAt` (webhook Zalo, NĐ 13/2023): `erasedAt` là **vô danh hoá** — xoá
thật các trường nhận dạng theo yêu cầu của chính chủ thể dữ liệu; `deletedAt` là
quyết định hành chính của xã và đảo ngược được.

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

**Tệp minh chứng nhiệm vụ (WBS #3).** `Task` có hai trường đính kèm tồn tại song
song có chủ ý:

| Trường | Nội dung |
|---|---|
| `attachments` | **Di sản** — chỉ là tên tệp dạng chuỗi, không tải lên/tải về được. Giữ cho tương thích ngược (dữ liệu seed và bản ghi cũ đang dùng) |
| `attachmentFileIds` | Mã tệp trong module Files — tệp thật |

- `POST /tasks/:code/attachments` với `{ fileIds: string[] }` → trả nhiệm vụ đã
  cập nhật. Mã đã gắn rồi thì bỏ qua, không nhân bản.
- `DELETE /tasks/:code/attachments/:fileId` → trả nhiệm vụ đã cập nhật (tệp vẫn
  còn trong kho, chỉ gỡ liên kết).
- `GET /tasks/:code` trả thêm `attachmentFiles: [{ fileId, name, size, contentType }]`
  tra từ `FilesService`, đồng thời **giữ nguyên** `attachments`.
- Quyền: `tasks:edit`, cùng mức với mọi thao tác sửa nhiệm vụ khác.
- Tệp phải được tải lên với **`isPrivate = true`** (quy ước **TB-09** trong
  `../SECURITY.md`) — hồ sơ minh chứng là tài liệu nội bộ, mà `GET /files/:id`
  để `@Public()` nên tệp công khai chỉ được che bằng độ khó đoán của ObjectId.
  Gắn tệp công khai bị từ chối bằng 400.
- Mã tệp không tra được (tệp đã bị dọn khỏi kho) bị **bỏ qua** khi dựng
  `attachmentFiles` thay vì làm cả lời gọi thất bại — nhiệm vụ vẫn phải mở xem được.

**Tiếp nhận phản ánh trực tiếp tại xã (WBS #6).** `POST /feedback`
(`feedback:edit`) cho cán bộ lập phiếu hộ người dân đến trình bày tại trụ sở;
phản hồi cùng hình dạng với `GET /feedback/:code`.

- Phân biệt bằng `Feedback.source`: `'app'` (công dân tự gửi, **mặc định** cho mọi
  bản ghi cũ) hoặc `'offline'` (cán bộ lập hộ). Tách khỏi `channel` có chủ ý —
  `channel` nói phiếu tới qua thiết bị nào, `source` nói **ai lập phiếu**.
- Mã phiếu và SLA dùng **chung code** với luồng công dân gửi
  (`createWithUniqueCode`, `resolveSla`) nên hai đường vào không thể lệch nhau.
- KHÔNG chạy hạn mức chống spam 5 phiếu/ngày: hạn mức đó đếm theo số điện thoại
  người dân để chặn spam qua app, áp vào đây thì một hộ trình bày nhiều vụ việc
  trong ngày bị chặn oan, mà thao tác đã có cán bộ chịu trách nhiệm.
- `citizenPhone` không còn `required` trong schema — người dân đến trụ sở không
  bắt buộc để lại số, và Mongoose coi chuỗi rỗng là vi phạm `required`.
- Người lập phiếu được ghi vào `timeline`.

---

## 7. Chạy và kiểm thử

```bash
cd backend
npm install
cp .env.example .env.local          # ứng dụng đọc .env.local, KHÔNG đọc .env
docker compose up -d                # mongo + rabbitmq cho môi trường phát triển
npm run seed                        # 10 tài khoản + cấu hình SLA + dữ liệu demo
npm run start:dev                   # http://localhost:3001/api/v1

npm run typecheck
npm test                            # 300 unit test
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
| Tra cứu hồ sơ (WBS #15) | Có `GET /dossiers/lookup/:code`, **dữ liệu là seed demo**. Nguồn thật phải liên thông từ hệ thống một cửa của tỉnh — hạng mục ngoài WBS (xem mục 3.5) |
| Refresh token | ✅ Đã có `POST /auth/refresh`, xoay vòng + phát hiện dùng lại (mục 3.4) |
| Kho OTP | Nằm trong bộ nhớ tiến trình — hỏng khi chạy nhiều instance |
| Socket.IO nhiều instance | Chưa có adapter Redis |
| Chức danh cán bộ | Đang dùng nhãn vai trò RBAC thay cho chức danh thật — chờ khách chốt |
| Kết xuất PDF/PPTX | ✅ Đã có — `pdfmake` (Roboto nhúng sẵn, đủ dấu tiếng Việt) và `pptxgenjs` |
| CRUD quản trị hồ sơ một cửa | **Không làm ở Phase 1** — WBS #15 chỉ yêu cầu tra cứu |

Chi tiết rủi ro bảo mật và 12 việc bắt buộc trước production: xem `../SECURITY.md`.

---

## 10. Tài liệu liên quan

`02-ADMIN-WEB.md` · `03-ZALO-MINIAPP.md` · `04-TRIEN-KHAI.md` ·
`../SECURITY.md` · `../deploy/README.md` · `../plans/` (plan chi tiết từng task)
