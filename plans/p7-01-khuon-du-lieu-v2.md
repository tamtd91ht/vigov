# P7-01 — Khuôn dữ liệu dùng chung v2: mốc thời gian dạng số, tham chiếu bằng id, nhật ký và bình luận chuẩn hoá

> Trạng thái: **in-progress** · Lập 11/09/2026
> Phạm vi bản này: **chỉ dựng khuôn dùng chung trong `libs/shared`.** Không sửa schema
> nghiệp vụ (P7-02), không di trú dữ liệu (P7-04), không đụng phân quyền (P7-03).

## 1. Vì sao làm việc này trước

Bốn yêu cầu nâng cấp v2 đều quy về **một chỗ**: khuôn dữ liệu dùng chung. Sửa từng phân hệ
trước khi có khuôn là tự tạo ra 13 biến thể phải gom lại về sau.

Bằng chứng phạm vi (đo ngày 11/09/2026):

| Hạng mục | Số lượng |
|---|---|
| Collection phải di trú | 13 |
| Điểm khai `@RequirePermission` phải ánh xạ lại | 136 |
| Trường tham chiếu đang lưu **tên** thay vì id | 13 |
| Tệp schema có trường thời gian | 8 |
| Client phải đồng bộ | 3 (`admin-web`, `zalo-miniapp`, và bộ kiểu dùng chung) |

`Comment` và `TimelineStep` hiện khai trong `task.schema.ts` nhưng được `documents`,
`dossier`, `feedback`, `budget`, `misc` dùng lại — nên chuẩn hoá hai khuôn này là việc
**toàn app**, không phải việc của phân hệ Nhiệm vụ.

## 2. Quyết định đã chốt (11/09/2026)

| # | Quyết định | Người chốt |
|---|---|---|
| 1 | **Tham chiếu luôn lưu id.** Tên hiển thị resolve ở tầng đọc — sửa cách hiển thị không đổi bản chất dữ liệu | Người dùng |
| 2 | **Mọi mốc thời gian lưu dạng số** (epoch milliseconds). Kể cả `createdAt`, `updatedAt`, `deletedAt`, `slaDueAt`, `dueAt` — không còn chuỗi, không còn `Date` | Người dùng |
| 3 | **Bộ quyền theo tính năng**: phân hệ × 5 hành động — xem · thêm · sửa · xoá · duyệt. Đóng câu hỏi mở #12 | Người dùng |
| 4 | **Nhật ký và bình luận chuẩn hoá chung** một khuôn cho cả app | Người dùng |
| 5 | **Một đợt phát hành v2, di trú một lần, KHÔNG viết mã tương thích ngược** | Người dùng |

Hệ quả của #5 phải nói rõ: ngày phát hành, backend cũ và client cũ **chết ngay**. Ba module
phải lên cùng lúc, và phải có cửa sổ ngừng dịch vụ để chạy di trú. Không có đường lùi từng
phần — lùi là `mongorestore` toàn bộ.

## 3. Khuôn sẽ dựng

Tệp mới, tất cả trong `backend/libs/shared/src/`:

| Tệp | Nội dung |
|---|---|
| `time/epoch.ts` | Kiểu `EpochMs` + toàn bộ tiện ích thời gian: `nowMs`, `toEpochMs`, `parseVnDateMs`, `formatVnDateMs`, `formatVnDateTimeMs`, `vnStartOfDayMs`, `buildEpochRangeFilter` |
| `schemas/timestamped.ts` | Lớp cơ sở `Timestamped` (`createdAt`/`updatedAt` dạng số) + `applyEpochTimestamps(schema)` |
| `schemas/activity-log.ts` | `ActivityEntry` — khuôn nhật ký chuẩn, thay `TimelineStep` |
| `schemas/comment.ts` | `Comment` chuẩn hoá — thay bản trong `task.schema.ts` |
| `schemas/refs.ts` | Quy ước trường tham chiếu + kiểu trả ra sau khi resolve |

### 3.1 Mốc thời gian

Lưu `Number` = epoch milliseconds, gốc UTC. Quy ước:

| Việc | Cách làm |
|---|---|
| Tên trường | **Giữ nguyên** `createdAt`, `updatedAt`, `deadline`, `deletedAt`… chỉ đổi **kiểu** |
| Vì sao giữ tên | `sort({ createdAt: -1 })`, index, và mọi chỗ đang gọi vẫn đúng cú pháp; đổi tên là thêm 200+ điểm sửa mà không được gì |
| Múi giờ | Mọi phép quy đổi sang ngày Việt Nam nằm **chỉ** trong `epoch.ts`. Service không tự cộng 7 giờ |
| Mốc "hết ngày" | `parseVnDateMs('11/09/2026')` trả 23:59:59.999 giờ Việt Nam — giữ đúng nghĩa "hạn tính hết ngày" của bản v1 |
| `timestamps: true` của Mongoose | **Bỏ.** Nó luôn ghi `Date`; thay bằng `applyEpochTimestamps(schema)` đặt `createdAt`/`updatedAt` dạng số ở hook `save` và `findOneAndUpdate`/`updateOne`/`updateMany` |

`buildEpochRangeFilter(field, from, to)` thay `buildDateRangeFilter` — cùng chữ ký, trả
`{ $gte: number, $lt: number }`. Hàm cũ **xoá**, không giữ song song (quyết định #5).

### 3.2 Tham chiếu bằng id

| Trường v1 (tên) | Trường v2 (id) | Trỏ tới |
|---|---|---|
| `assignee` | `assigneeId` | `staff_users._id` |
| `assigner` | `assignerId` | `staff_users._id` |
| `collaborators[]` | `collaboratorIds[]` | `staff_users._id` |
| `department` | `departmentId` | `org_nodes._id` |
| `deletedBy` | `deletedById` | `staff_users._id` |
| `signer` | `signerId` | `staff_users._id` |
| `authorName` (bình luận) | `authorId` | `staff_users._id` |

**Chi phí ẩn lớn nhất của quyết định #1**: `department` hiện **không có id ở đâu cả**. Danh
mục bộ phận đang được suy ra từ **giá trị phân biệt của chính dữ liệu nghiệp vụ**
(`catalogs.service.ts`), còn `org_nodes` là cây tổ chức **cục bộ của phân hệ Cấu hình**.

Giả định đang dùng, cần người dùng xác nhận ở P7-02:
> Nâng `org_nodes` thành **danh mục bộ phận chuẩn** của toàn hệ thống, chuyển khai báo
> schema từ `modules/settings/schemas/` sang `libs/shared/src/schemas/`. Di trú dựng nút
> cho mỗi tên bộ phận đang tồn tại trong dữ liệu, rồi thay tên bằng id.

Nếu khách muốn bộ phận vẫn là danh mục tự do (không quản lý tập trung) thì `departmentId`
không làm được — lúc đó phải giữ `department` là chuỗi và đó là **ngoại lệ duy nhất** của
quyết định #1.

### 3.3 Nhật ký chuẩn hoá

v1 (`TimelineStep`) nhốt ba thông tin vào hai chuỗi:

```
{ title: 'Chuyển trạng thái: Hoàn thành',
  meta:  '14:30 11/09/2026 · Nguyễn Văn Bình',
  state: 'cur' }
```

v2 (`ActivityEntry`) tách ra, và **không** lưu nhãn tiếng Việt:

```
{ at: 1789036200000,         // epoch ms
  actorId: '66f1...',        // staff_users._id; rỗng = hệ thống
  action: 'task.status',     // khoá hành động, ổn định
  detail: 'xong',            // phần biến của hành động
  state: 'cur' }             // 'ok' đã qua | 'cur' đang ở đây
```

Vì sao không lưu nhãn: nhãn là **chuỗi hiển thị**, thuộc tầng cấu hình
(`rules/critical/khong-hardcode.md`). Lưu nhãn vào cơ sở dữ liệu nghĩa là đổi cách gọi một
trạng thái phải chạy script sửa dữ liệu lịch sử. Lưu `action` + `detail` thì đổi nhãn là sửa
một tệp cấu hình.

Đổi lại: cần **một bảng nhãn** ở client. Bảng này đặt ở `admin-web/src/config/activity.config.ts`
(P7-05), khớp danh sách `action` khai trong `activity-log.ts`.

### 3.4 Bình luận chuẩn hoá

v1 lưu cả `authorInitials` và `authorColor` — hai trường **trình bày** nằm trong cơ sở dữ
liệu, và `time` là chuỗi đã định dạng.

v2: `{ at: number, authorId: string, content: string }`. Chữ viết tắt và màu avatar tính ở
client từ tên đã resolve (`admin-web` đã có `Avatar` tự tính).

## 4. Checklist

- [x] `time/epoch.ts` — 8 hàm + kiểu `EpochMs`
- [x] `schemas/timestamped.ts` — `Timestamped` + `applyEpochTimestamps`
- [x] `schemas/activity-log.ts` — `ActivityEntry` + ràng buộc dạng khoá `action`
- [x] `schemas/comment.ts` — `Comment` v2
- [x] `schemas/refs.ts` — quy ước tên trường + kiểu sau resolve
- [x] `SoftDeletable`: `deletedAt` → số, `deletedBy` → `deletedById`
- [x] Xuất hết qua `libs/shared/src/index.ts`
- [x] Xoá `buildDateRangeFilter` cũ và `vnStartOfDay` trả `Date`
- [x] Test đơn vị: `epoch.spec.ts` 24 ca · `timestamped.spec.ts` 8 ca — **32/32 xanh**
- [ ] `npm run check:all` xanh → **chỉ xanh được sau P7-02**, xem mục 8

### Hai việc làm thêm ngoài checklist ban đầu

| Việc | Vì sao phải làm ngay trong P7-01 |
|---|---|
| Chuyển `Comment` và `TimelineStep` **ra khỏi** `task.schema.ts` | Hai khuôn dùng chung của cả hệ thống đang nằm trong schema của một phân hệ. Để nguyên thì `export *` ở `index.ts` có hai `Comment` trùng tên — lỗi nhập nhằng, không phải lỗi hữu ích |
| Sửa đường nhập ở 5 tệp schema (`budget`, `document`, `dossier`, `feedback`, `misc`) | Thuần đổi đường nhập và tên kiểu, không đổi nghiệp vụ. Để lại 5 lỗi nhập sai sẽ lẫn vào danh sách lỗi thật của P7-02 |

## 5. Cách kiểm chứng

| Việc | Lệnh / cách xác nhận |
|---|---|
| Kiểu và biên dịch | `cd backend && npm run build` — phải đỏ ở đúng những chỗ còn dùng khuôn cũ (đó là danh sách việc của P7-02) |
| Tiện ích thời gian | `npm test -- epoch.spec` — khứ hồi `parseVnDateMs` ↔ `formatVnDateMs`, 29/02 năm nhuận, 31/02 trả `undefined`, mốc hết ngày đúng 23:59:59.999 giờ VN |
| Timestamps | `npm test -- timestamped.spec` — `create` đặt cả hai mốc; `findOneAndUpdate` chỉ đổi `updatedAt` |

## 6. Việc KHÔNG làm trong task này

| Không làm | Vì sao | Task nhận |
|---|---|---|
| Sửa 13 schema nghiệp vụ | Cần khuôn xong trước | P7-02 |
| Ánh xạ lại 136 điểm phân quyền | Việc độc lập, khuôn khác | P7-03 |
| Script di trú dữ liệu | Phải chốt schema cuối cùng trước | P7-04 |
| Sửa `admin-web` / `zalo-miniapp` | Sau khi hợp đồng API chốt | P7-05 |
| Sáu hạn chế riêng của phân hệ Nhiệm vụ | Nghiệp vụ, không phải khuôn | P7-06 |
| Giữ mã tương thích ngược | Quyết định #5 của người dùng | — |

## 7. Rủi ro

| Rủi ro | Mức | Ứng xử |
|---|---|---|
| Build đỏ hàng loạt sau khi xoá khuôn cũ | Chắc chắn xảy ra | Đây là **cố ý** — danh sách lỗi biên dịch chính là checklist của P7-02 |
| Lệch múi giờ khi đổi từ `Date` sang số | Cao | Mọi phép quy đổi gom vào `epoch.ts`, có test múi giờ; service không tự cộng giờ |
| `org_nodes` chưa đủ làm danh mục bộ phận chuẩn | Cao | Nêu ở mục 3.2, cần khách xác nhận trước P7-02 |
| Mất mốc thời gian lịch sử khi di trú | Rất cao nếu làm sai | P7-04 bắt buộc `mongodump` trước, có `--dry-run`, có đối soát số bản ghi |

## 8. Kết quả — đã kiểm chứng 11/09/2026

| Phép kiểm | Lệnh | Kết quả |
|---|---|---|
| Khuôn mới biên dịch | `npx tsc -p tsconfig.json --noEmit` | **0 lỗi** trong `libs/shared` |
| Tiện ích thời gian | `npx jest libs/shared/src/time/epoch.spec.ts` | **24/24 xanh** |
| Mốc tự điền | `npx jest libs/shared/src/schemas/timestamped.spec.ts` | **8/8 xanh** |
| Toàn bộ backend | `npm run check:api` | **88 lỗi, tất cả nằm trong `apps/`** — đúng như dự kiến |

Phép kiểm đáng giá nhất là *"TÔN TRỌNG mốc truyền tường minh"*: nó khoá đúng cái bẫy sẽ
làm script di trú đổi mốc sửa của toàn bộ hồ sơ hành chính thành ngày chạy di trú.

### 88 lỗi biên dịch = checklist của P7-02

| Tệp | Số lỗi | Việc |
|---|---|---|
| `seed-data/documents.seed.ts` | 44 | Nhật ký còn dùng `{title, meta}` |
| `seed-data/disbursement.seed.ts` | 15 | Bình luận còn dùng `authorName`/`authorColor` |
| `modules/documents/documents.service.ts` | 6 | 5 chỗ dựng nhật ký + `buildDateRangeFilter` |
| `modules/tasks/tasks.service.ts` | 3 | `buildDateRangeFilter`, `TimelineStep`, `authorName` |
| `seed-data/tasks.seed.ts` · `feedback.seed.ts` | 2 + 2 | Nhật ký và mốc thời gian |
| `modules/feedback/feedback.service.ts` | 2 | `buildDateRangeFilter` + một chỗ dựng nhật ký |
| `seed-data/dossiers.seed.ts` | 1 | Nhật ký |
| `modules/workflow/workflow.service.ts` | 1 | Nhập `TimelineStep` |
| `modules/users/users.service.ts` | 1 | `deletedBy` → `deletedById` |
| `modules/disbursement/disbursement.service.ts` | 1 | `authorName` |

Không có lỗi nào trong `libs/` — nghĩa là khuôn tự nó nhất quán, phần còn lại thuần là việc
áp dụng.

## 9. Phát hiện mới trong lúc làm — chuyển sang P7-02

| # | Phát hiện | Vì sao phải xử lý |
|---|---|---|
| 1 | `feedback.service.ts:682` truyền **số điện thoại công dân** làm người xoá: `markDeleted(fb, citizenPhone, …)` | Hai vấn đề cùng lúc. Một: `deletedById` v2 trỏ `staff_users._id`, mà công dân không có tài khoản cán bộ — cần trường riêng cho người xoá là công dân. Hai: số điện thoại là **dữ liệu cá nhân** đang nằm trong một trường không ai nghĩ là chứa dữ liệu cá nhân, nên nó không được che ở đâu cả (`rules/critical/du-lieu-ca-nhan.md`) |
| 2 | `audit_logs` ghi `actor` bằng **tên đăng nhập**, không phải id | Không đổi trong pha này (nhật ký kiểm toán là kho bất biến, đổi khuôn là mất khả năng đối chiếu với bản ghi cũ). Nhưng phải ghi rõ trong tài liệu là một ngoại lệ có chủ ý của luật "luôn lưu id" |

## 10. Trạng thái task

Mã đã xong và đã kiểm chứng. Task **chưa đóng** vì `npm run check:all` còn đỏ — theo
`skills/quan-ly-task-plan` MUST NOT #2, không đánh dấu `done` khi chưa chạy được kiểm chứng
xanh. P7-01 và P7-02 khoá chặt nhau: build chỉ xanh lại khi P7-02 xong.
