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

## 2. Hai mươi mốt module

| Module | Route | Vai trò |
|---|---|---|
| `users` | 19 | Tài khoản cán bộ, tài khoản công dân, phiên đăng nhập, danh sách chặn |
| `content` | 19 | CMS: bài viết, video, bản tin truyền thanh — kèm nhóm `/public` cho công dân |
| `settings` | 14 | SLA, cây tổ chức, lĩnh vực phản ánh, danh mục vai trò, nhà cung cấp tích hợp |
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

**Mã OTP** không lưu dạng rõ ở bất kỳ đâu — `OtpStore` chỉ giữ HMAC-SHA256 của
mã. Nơi lưu chọn bằng `OTP_STORE`: `memory` (mặc định, đủ cho một instance) hoặc
`mongo` (bảng `otp_codes`, có TTL index nên Mongo tự dọn mã hết hạn).
**Chạy nhiều instance thì bắt buộc `mongo`**: mã sinh ở instance A không xác
thực được ở instance B, và bộ đếm nhập sai không dùng chung nên người dò chỉ cần
đổi instance là được thêm lượt.

**Phiên của chính mình** (trang Hồ sơ cá nhân): `GET /auth/me/sessions` và
`DELETE /auth/me/sessions/:id`. Tách khỏi `GET /users/sessions` — đường đó là màn
hình bảo mật của quản trị, đòi `users:view` và trả phiên của cả cơ quan, nghĩa là
vai trò không có quyền đó thì không xem được cả phiên của chính họ. Thu hồi phiên
không thuộc về mình trả **404** y như phiên không tồn tại, để không tiết lộ mã
phiên nào có thật.

### 3.1a Mật khẩu tạm và chính sách mật khẩu

Chính sách nằm ở **một chỗ duy nhất** — `libs/shared/src/auth/password-policy.ts`
— và áp cho cả ba đường: tạo tài khoản (sinh mật khẩu tạm), quản trị viên đặt
lại, và người dùng tự đổi. Yêu cầu: tối thiểu 10 ký tự, có chữ và có số, không
phải mật khẩu phổ biến, không chứa tên đăng nhập, không dấu cách ở đầu/cuối.

Cờ `StaffUser.mustChangePassword` bật khi **tạo tài khoản** và khi **quản trị
viên đặt lại mật khẩu** — hai trường hợp mật khẩu đã đi qua tay người khác. Cờ đi
vào payload JWT và `JwtAuthGuard` **chặn mọi endpoint** trừ những endpoint gắn
`@AllowPendingPassword()` (`GET /auth/me`, `PATCH /auth/me/password`). Đổi mật
khẩu xong, máy chủ cấp **cặp token mới** vì cờ nằm trong chữ ký JWT — token cũ
vẫn mang cờ cũ nên vẫn bị chặn.

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
phát hiện dùng lại đá ra).

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
port từ mock của Zalo Mini App — xem
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

### 5.1 Xoá MỀM — quy ước dùng chung cho 4 phân hệ

Bốn phân hệ có xoá mềm: **Nhiệm vụ** (`tasks`), **Văn bản** (`documents`),
**Công dân** (`citizen_users`), **Hạng mục ngân sách** (`budget_items`). Cả bốn
dùng ĐÚNG MỘT bộ quy ước ở `libs/shared/src/schemas/soft-delete.ts` — trước đây
mỗi service tự khai `NOT_DELETED`/`IS_DELETED` riêng (4 bản sao y nhau) cộng hơn
mười chỗ viết thẳng `deletedAt: null`, nên thêm phân hệ là lại quên một chỗ.

```ts
class SoftDeletable {           // các schema đều `extends` lớp này
  isDeleted: boolean;           // CỜ để truy vấn — default false, có index
  deletedAt?: Date | null;      // chỉ là mốc thời gian, KHÔNG lọc theo
  deletedBy?: string;           // TÊN ĐĂNG NHẬP (không phải displayName)
  deleteReason?: string;
}
const NOT_DELETED = { isDeleted: { $ne: true } };   // mọi danh sách / thống kê
const IS_DELETED  = { isDeleted: true };            // bộ lọc "Đã xoá"
markDeleted(doc, username, reason) / markRestored(doc)   // cho doc.save()
softDeleteUpdate(username, reason) / softRestoreUpdate() // cho findOneAndUpdate
```

Hai điểm dễ sai:

- **`$ne: true` chứ không phải `false`.** Bản ghi tạo trước khi có tính năng xoá
  KHÔNG có trường `isDeleted`; lọc `isDeleted: false` thì chúng biến mất khỏi mọi
  danh sách. Nhờ `$ne: true`, hệ thống chạy đúng ngay cả khi chưa backfill.
- **`deletedAt` không dùng để lọc.** Nó chỉ trả lời "xoá lúc nào"; đổi sang lọc
  theo nó là quay lại đúng chỗ vừa dọn.

Dữ liệu cũ: chạy `npm run backfill:is-deleted` (xem trước) rồi
`npm run backfill:is-deleted -- --write` để đặt cờ theo quy tắc
`isDeleted = (deletedAt != null)`. **Không bắt buộc trước khi deploy**, chỉ để dữ
liệu sạch và để index phát huy tác dụng.

Endpoint theo cùng khuôn ở cả 4 phân hệ — dùng `PATCH` chứ không phải `DELETE` để
nói đúng việc đang làm (đổi trạng thái bản ghi) và để mang lý do xoá trong body:

| Phân hệ | Xoá mềm | Khôi phục |
|---|---|---|
| Nhiệm vụ | `PATCH /tasks/:code/delete` | `PATCH /tasks/:code/restore` |
| Văn bản | `PATCH /documents/:arrivalNo/delete` | `PATCH /documents/:arrivalNo/restore` |
| Công dân | `PATCH /users/citizens/id/:id/delete` | `PATCH /users/citizens/id/:id/restore` |
| Ngân sách | `PATCH /disbursement/:code/delete` | `PATCH /disbursement/:code/restore` |

Tất cả đều đòi quyền `<phân hệ>:admin`. Tham số xem thùng đã xoá là `?deleted=true`
(DTO dùng chung `SoftDeleteQueryDto`, nhận boolean sau `@Transform`).

**Mã/số đã cấp KHÔNG được cấp lại** cho bản ghi mới: bộ sinh mã (`NV-xxxx`, số đến
văn bản, `HM-xx`) vẫn đếm cả bản đã xoá — nếu không thì hai bản ghi khác nhau trùng
mã trong cùng một sổ.

#### Riêng phân hệ Công dân

Số điện thoại là khoá liên kết tới hồ sơ một cửa và phản ánh đã gửi — dữ liệu xã có
nghĩa vụ lưu trữ. Hệ quả của cờ xoá:

| Nơi | Hành vi khi `isDeleted = true` |
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
thật các trường nhận dạng theo yêu cầu của chính chủ thể dữ liệu; `isDeleted` là
quyết định hành chính của xã và đảo ngược được. Đừng gộp hai việc.

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
- **MỌI phản hồi chi tiết nhiệm vụ đều kèm `attachmentFiles`**, kể cả các endpoint
  ghi không liên quan tệp: `PATCH /tasks/:code`, `PATCH /tasks/:code/checklist/:index`,
  `POST /tasks/:code/comments`. Web Quản trị thay NGUYÊN bản ghi đang mở bằng phản hồi
  này, nên một phản hồi thiếu trường đó làm danh sách tệp biến mất khỏi ngăn chi tiết
  cho tới lần tải lại trang.
- Quyền: `tasks:edit`, cùng mức với mọi thao tác sửa nhiệm vụ khác.
- Tệp phải được tải lên với **`isPrivate = true`** (quy ước **TB-09** trong
  `../SECURITY.md`) — hồ sơ minh chứng là tài liệu nội bộ, mà `GET /files/:id`
  để `@Public()` nên tệp công khai chỉ được che bằng độ khó đoán của ObjectId.
  Gắn tệp công khai bị từ chối bằng 400.
- Mã tệp không tra được (tệp đã bị dọn khỏi kho) bị **bỏ qua** khi dựng
  `attachmentFiles` thay vì làm cả lời gọi thất bại — nhiệm vụ vẫn phải mở xem được.

**Tệp đính kèm văn bản (WBS #4).** Cùng khuôn với nhiệm vụ, thêm vào
`IncomingDocument`:

- `scanFileId` là **bản scan gốc**, thứ OCR đọc — một tệp duy nhất, không đổi.
- `attachmentFileIds` là **phụ lục, biên bản, tờ trình** kèm theo, nhiều tệp.
- `POST /documents/:arrivalNo/attachments` `{ fileIds }` và
  `DELETE /documents/:arrivalNo/attachments/:fileId`, quyền `documents:edit`,
  mỗi lần gắn/gỡ ghi một mốc vào dòng thời gian luân chuyển.
- `GET /documents/:arrivalNo` trả thêm `attachmentFiles`; **danh sách
  `GET /documents` KHÔNG kèm** — mỗi tệp là một lượt tra kho tệp, gắn vào danh
  sách là N+1 truy vấn cho thông tin không hiện ở bảng.
- `POST /documents` và `PATCH /documents/:arrivalNo` cũng kèm `attachmentFiles`, cùng
  lý do như bên nhiệm vụ.
- Mốc dòng thời gian ghi khi gắn/gỡ tệp phải dùng `state: 'ok' | 'cur'` — enum của
  `TimelineStep` chỉ có hai giá trị đó. Giá trị ngoài enum làm Mongoose ném
  `ValidationError` ở `save()`, và vì đó không phải `HttpException` nên cả lời gọi
  trả **500** thay vì lỗi có nghĩa.
- `deadline` của văn bản **không** đặt `required` trong schema: form "Tiếp nhận văn
  bản" cho bỏ trống ô hạn (vào sổ trước, ấn định hạn sau), mà Mongoose không cho chuỗi
  rỗng vượt qua `required`.

**Cưỡng chế tệp riêng tư.** `FilesService.findPrivateById(id, label)` là chỗ duy
nhất kiểm quy ước TB-09, dùng ở tất cả các đường gắn tệp vào bản ghi nghiệp vụ:
tệp nhiệm vụ, ảnh hiện trường và ảnh nghiệm thu phản ánh, bản scan và tệp đính
kèm văn bản. Trước đây đó chỉ là quy ước ghi trong tài liệu, nên chỉ cần một chỗ
trong giao diện quên đặt `isPrivate` là tệp lọt ra ngoài mà không ai biết. Tệp
nội dung CMS (ảnh bìa, audio, video) vẫn công khai **có chủ ý** — đó là nội dung
đăng cho công dân xem.

**Khai quyền cho endpoint công dân cũng gọi được.** `roleKey` `'citizen'` KHÔNG có
trong bảng `roles.ts`, nên `hasPermission` luôn trả `false`: gắn `@RequirePermission`
vào một endpoint công dân cần dùng là chặn đúng người cần dùng nó, còn `@Public()` thì
bỏ luôn xác thực. Vì vậy có decorator thứ ba:

```ts
@AnyAuthenticated('Công dân phải tải được ảnh hiện trường khi gửi phản ánh từ Mini App')
@Post('upload')
```

`@AnyAuthenticated(reason)` **không đổi** hành vi kiểm tra — hành vi mặc định của
`JwtAuthGuard` khi không có `@RequirePermission` vốn đã là "đã đăng nhập, vai trò nào
cũng qua". Nó biến hành vi mặc định đó thành một lựa chọn **tường minh và soi được bằng
công cụ** (`.claude/hooks/rbac_audit_guard.py`), thay vì để trống decorator và không ai
đọc mã mà biết được là cố tình hay bỏ sót. `reason` là tham số **bắt buộc**.

Cách ly giữa các công dân vẫn do tầng dưới lo, không phải do decorator này: kho tệp dùng
`assertCanSign`, phân hệ Phản ánh lọc `{ code, citizenPhone }` ngay trong truy vấn.

**Hai đường cấp link đọc tệp riêng tư.** Tệp riêng tư chỉ đọc được qua link ký sẵn,
và có đúng hai cách lấy link — khác nhau ở chỗ ai kiểm quyền:

| Đường | Dùng khi | Kiểm quyền |
|---|---|---|
| `GET /files/:id/signed-url` | Client cầm sẵn mã tệp và tự xin link (Web Quản trị) | `FilesService.assertCanSign` — cán bộ ký được mọi tệp; **công dân chỉ ký được tệp do chính mình tải lên** (`uploadedBy`) |
| `FilesService.mintSignedUrl(id, ttl)` | Service đã tự kiểm quyền trên **bản ghi nghiệp vụ** rồi tự cấp link kèm phản hồi | Không kiểm lại — nơi gọi chịu trách nhiệm |

Vì sao cần đường thứ hai: `assertCanSign` phân quyền theo *người tải lên*, nên ảnh
nghiệm thu do **cán bộ** chụp bị chặn với chính **công dân** chủ phiếu. Quyền đúng ở
đây là quyền trên *phiếu*, mà chỉ `FeedbackService` biết. Nên
`GET /feedback/citizen/mine` và `GET /feedback/citizen/mine/:code` — hai endpoint đã
lọc `{ code, citizenPhone }` ngay trong truy vấn — trả kèm:

- `imageUrls: string[]` — link đọc ảnh hiện trường
- `resultImageUrls: string[]` — link đọc ảnh nghiệm thu

Hiệu lực `CITIZEN_IMAGE_URL_TTL_SECONDS` = 1 giờ (dài hơn mặc định 5 phút của kho tệp:
người dân mở màn "Phản ánh của tôi" rồi để đó, cuộn lại sau vài chục phút vẫn phải thấy
ảnh). `POST /feedback/citizen` cũng trả kèm hai trường này.

`mintSignedUrl` **không** tra bản ghi tệp: `listMine` trả tới 50 phiếu × 3 ảnh, tra từng
mã là 150 lượt truy vấn cho một việc chỉ cần một phép HMAC. Mã tệp sai chỉ dẫn tới link
trả 404 khi mở, còn `isPrivate` vẫn được kiểm ở `openForStream` lúc đọc tệp thật.

> ⚠️ **Chỉ gọi `mintSignedUrl` với mã tệp lấy ra từ một bản ghi đã lọc theo chủ sở hữu.**
> Endpoint nhận mã tệp thẳng từ client thì phải dùng `signedUrl()` để đi qua
> `assertCanSign`. Xem **TB-16** trong `../SECURITY.md`.

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

> Ba tệp `.env` / `.env.example` / `.env.local` khác vai trò nhau ra sao, và vì sao
> không được tạo `backend/.env` → [`12-BIEN-MOI-TRUONG.md`](12-BIEN-MOI-TRUONG.md).

```bash
cd backend
npm install
cp .env.example .env.local          # điền giá trị thật vào đây — KHÔNG commit
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

`02-ADMIN-WEB.md` · `03-ZALO-MINIAPP.md` · `04-TRIEN-KHAI-VPS.md` ·
`../SECURITY.md` · `06-VAN-HANH.md` · `../plans/` (plan chi tiết từng task)

---

## Thu hồi và sửa phản ánh (người dân)

Người dân gửi nhầm, gửi trùng, hoặc sự việc đã tự giải quyết — cần đường rút phiếu lại.
Nhưng phiếu phản ánh là **tài liệu hành chính**, và có thể đã có cán bộ bỏ công xác minh,
nên không thể để người dân đơn phương xoá bất cứ lúc nào.

### Ranh giới: "đã có người tiếp nhận" hay chưa

```
đã tiếp nhận = status !== 'received'  HOẶC  có assignee  HOẶC  có department
```

Kiểm cả ba chứ không riêng trạng thái: `assign()` có nhánh giữ nguyên `received` khi phiếu
được giao mà chưa ai bắt tay làm, nên chỉ nhìn trạng thái sẽ cho người dân gỡ mất phiếu đã
nằm trên bàn một cán bộ.

### Hai nhánh nghiệp vụ

| Tình huống | Người dân làm được gì | Kết quả |
|---|---|---|
| **CHƯA ai tiếp nhận** | Sửa tiêu đề / nội dung · Gỡ thẳng | Phiếu bị **xoá mềm** ngay, `withdrawStatus = 'approved'` |
| **ĐÃ có người tiếp nhận** | Chỉ xin thu hồi | `withdrawStatus = 'pending'`, chờ cán bộ quyết |

### Endpoint

| Method | Đường dẫn | Quyền | Việc |
|---|---|---|---|
| `PATCH` | `/feedback/citizen/mine/:code` | Công dân (chủ phiếu) | Sửa `title` / `description`; 409 nếu đã có người tiếp nhận |
| `POST` | `/feedback/citizen/mine/:code/withdraw` | Công dân (chủ phiếu) | Xin thu hồi. Trả `{ removed, withdrawStatus }` |
| `PATCH` | `/feedback/:code/withdraw/approve` | `feedback:approve` | Đồng ý → phiếu bị xoá mềm |
| `PATCH` | `/feedback/:code/withdraw/reject` | `feedback:approve` | Từ chối; `note` **bắt buộc** (400 nếu thiếu) |

Quyền duyệt là `approve` chứ không phải `edit`: gỡ một phiếu khỏi hàng đợi là quyết định
về tài liệu hành chính, không phải thao tác xử lý thường ngày. Theo bảng vai trò hiện
hành, chỉ `leader` và `admin` quyết được — chuyên viên đang xử lý không tự đóng phiếu
của mình.

### Trường mới trên phiếu

`withdrawStatus` (`none|pending|approved|rejected`, có index) · `withdrawRequestedAt` ·
`withdrawReason` · `withdrawDecidedAt` · `withdrawDecidedBy` · `withdrawDecisionNote`.

Nhóm endpoint công dân còn trả ba **cờ suy ra** để Mini App hiện đúng nút:
`accepted` · `canEdit` · `canWithdrawDirectly`. Máy chủ tính hộ và **không** trả
`assignee`/`department` cho công dân — đó là thông tin điều hành nội bộ.

### "Gỡ" là XOÁ MỀM, không phải xoá cứng

`Feedback` nay `extends SoftDeletable`. Phiếu đã gỡ biến mất khỏi danh sách của **cả hai
bên** và khỏi thống kê, nhưng cán bộ tra lại được bằng `GET /feedback?deleted=true`, kèm
nguyên vẹn nhật ký xử lý. Sáu module truy vấn `feedbacks` (feedback, reports, dashboard,
search, settings, workflow) đều đã thêm bộ lọc `NOT_DELETED` — sót một chỗ là phiếu đã gỡ
hiện lại trên báo cáo cuối tháng.

Chốt chống spam `FEEDBACK_MAX_PER_DAY` vẫn đếm **cả phiếu đã gỡ**, có chủ ý: nếu không,
gửi 5 phiếu rồi thu hồi cả 5 là lại gửi được tiếp. Hành vi này được khoá bằng
`test/feedback-withdraw-spam.e2e-spec.ts` — đây là chỗ dễ bị "sửa cho tử tế" bằng cách
thêm `NOT_DELETED` vào `assertNotSpamming`.

> Ba quyết định nghiệp vụ của tính năng này (xoá mềm · quyền `approve` · đếm cả phiếu đã
> gỡ) đã được khách hàng chốt ngày 10/09/2026 — xem `quyet-dinh/0001-thu-hoi-phan-anh.md`.

### Cán bộ tìm yêu cầu thu hồi ở đâu

Trang Phản ánh của Web Quản trị có nút lọc **"Chờ duyệt thu hồi"** (gọi
`GET /feedback?withdrawStatus=pending`), và thẻ phiếu nào đang chờ thì mang chip đỏ
**"Xin thu hồi"**. Không có hai thứ này thì cán bộ phải mở từng phiếu mới biết, trong
khi người dân vẫn đang thấy "Hệ thống đang xử lý" — yêu cầu nằm im tới lúc họ gọi lên xã.

Kiểm chứng: `test/feedback-withdraw.e2e-spec.ts` (20 test) +
`test/feedback-withdraw-spam.e2e-spec.ts` (2 test).
