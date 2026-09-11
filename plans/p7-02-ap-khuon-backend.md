# P7-02 — Áp khuôn v2 vào 13 collection và toàn bộ module backend

> Trạng thái: **pending** · Lập 11/09/2026 · Phụ thuộc: **P7-01**

## 1. Phạm vi

Đổi 13 collection sang khuôn v2 của P7-01: mốc thời gian dạng số, tham chiếu bằng id, nhật
ký và bình luận chuẩn hoá.

| Collection | Việc chính |
|---|---|
| `tasks` | `deadline`/`deadlineAt` → một trường số `deadline`; `assignee`→`assigneeId`, `assigner`→`assignerId`, `collaborators`→`collaboratorIds`, `department`→`departmentId`; `timeline`→`ActivityEntry[]`; `comments`→`Comment` v2 |
| `documents` | `deadline`/`deadlineAt` → số; `department`→`departmentId`; `signer`→`signerId`; `timeline` |
| `feedbacks` | `slaDueAt` → số; `assignee`→`assigneeId`; `department`→`departmentId`; `timeline` |
| `dossiers` | `dueAt` → số; `assignee`→`assigneeId`; `department`→`departmentId`; `timeline` |
| `budget_items` | `deadline` chuỗi → số; `comments` v2; các mốc Date → số |
| `staff_users` · `citizen_users` | Mốc Date → số (8 trường ở `user.schema.ts`) |
| `articles` · `audit_logs` · `blacklist_records` · `login_sessions` · `sla_rules` · `stored_files` | `createdAt`/`updatedAt` và mốc riêng → số |

Kèm theo: bỏ `@Schema({ timestamps: true })` ở **mọi** schema, thay bằng
`applyEpochTimestamps(schema)`.

## 2. Việc chưa chốt — phải hỏi trước khi bắt đầu

| # | Câu hỏi | Vì sao |
|---|---|---|
| 1 | Nâng `org_nodes` thành danh mục bộ phận chuẩn của toàn hệ thống? | `departmentId` không tồn tại được nếu bộ phận vẫn là chuỗi tự do — xem P7-01 mục 3.2 |
| 2 | Bộ phận trong dữ liệu cũ không khớp nút nào trong `org_nodes` thì xử lý sao? | Di trú cần luật rõ: tạo nút mới, hay gán vào nút "Chưa phân loại" |

## 3. Tầng resolve tên hiển thị

Tham chiếu chỉ lưu id nên mọi phản hồi đọc phải kèm tên. Dựng **một** service dùng chung:

| Thành phần | Việc |
|---|---|
| `DirectoryResolverService` (`libs/shared` hoặc module `catalogs`) | Nhận danh sách id → trả `Map<id, { id, displayName, initials, color, departmentId }>`; đọc theo lô, có bộ đệm ngắn |
| Quy ước phản hồi | Bản ghi trả ra kèm `assignee: { id, displayName }` thay vì chỉ chuỗi tên |

Không cho phép: mỗi service tự `findById` từng id — đó là N+1 trên mọi danh sách.

## 4. Checklist

- [ ] 8 tệp schema đổi kiểu trường + đổi tên trường tham chiếu
- [ ] Bỏ `timestamps: true` ở 13 collection, gắn `applyEpochTimestamps`
- [ ] `DirectoryResolverService` + bộ đệm + test N+1
- [ ] Sửa mọi service dựng nhật ký: bỏ chuỗi `meta`, dùng `ActivityEntry`
- [ ] Sửa mọi DTO nhận/trả thời gian: nhận số, không nhận `dd/MM/yyyy`
- [ ] Sửa `tasks.export.ts` và các exporter khác: định dạng từ số
- [ ] Sửa module `reports` + `search` + `workflow` (cron nhắc hạn dùng `deadline` số)
- [ ] Sửa `seed-data/` cho khớp khuôn mới
- [ ] Chạy lại toàn bộ test đơn vị + e2e

## 5. Cách kiểm chứng

`cd backend && npm run build` phải **xanh sạch** (P7-01 để lại build đỏ có chủ ý).
`npm test` + `npm run test:e2e` xanh. Mỗi phân hệ kiểm một lượt đọc và một lượt ghi qua API.

## 6. Việc KHÔNG làm

Không di trú dữ liệu (P7-04) — task này chỉ đổi mã. Chạy trên dữ liệu cũ sẽ đọc sai, đó là
bình thường cho tới khi P7-04 chạy xong.

---

## 7. Chia ba chặng (bổ sung 11/09/2026)

Đo lại phạm vi khi bắt đầu làm thì task này quá lớn để kiểm chứng một lần. Chia ba chặng,
mỗi chặng tự kiểm chứng được:

| Chặng | Nội dung | Trạng thái |
|---|---|---|
| **2a** | Nhật ký + bình luận chuẩn hoá trên toàn bộ module và dữ liệu seed | **Xong 11/09/2026** |
| **2b** | Mốc thời gian dạng số cho 13 collection (schema · DTO · exporter · cron · báo cáo) | Chưa làm |
| **2c** | Tham chiếu bằng id + `DirectoryResolverService` | Chưa làm — **chờ quyết định về danh mục bộ phận** |

## 8. Chặng 2a — đã làm và đã kiểm chứng

### Đã chuyển sang khuôn `ActivityEntry` / `Comment` v2

| Nơi | Việc |
|---|---|
| `documents.service.ts` | 5 chỗ dựng nhật ký · bỏ `timelineMeta` và `pad2` · bảng nhãn trạng thái thay bằng khoá `ACT` |
| `tasks.service.ts` | 9 chỗ dựng nhật ký · bỏ `buildTimelineStep`, `formatVnDateTime`, `initialsOf`, `colorOf`, `AUTHOR_COLORS` · bình luận dùng `comment()` |
| `feedback.service.ts` | `pushTimeline` đổi khuôn · 9 chỗ gọi · thêm 3 khoá cho hai đường tiếp nhận · bỏ `CHANNEL_LABELS` |
| `workflow.service.ts` | bỏ `step()`, dùng `activity()` · 4 chỗ gọi |
| `disbursement.service.ts` | `buildComment` dùng `comment()` dùng chung |
| `users.service.ts` | `deletedBy` → `deletedById` |
| `seed.util.ts` | thêm `seedActivity` / `seedComment` |
| 5 tệp seed | 80 mốc nhật ký + 15 bình luận chuyển sang khuôn mới |

### Bốn quyết định đã ghi vào mã

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Nhật ký **không** ghi tên tệp đính kèm, chỉ ghi **số lượng** | Tên tệp scan công văn và ảnh minh chứng thường mang tên người và nội dung vụ việc, mà nhật ký hiển thị cho mọi cán bộ xem được bản ghi. Tên tệp đã nằm ở `attachmentFiles` |
| 2 | Công dân tự thu hồi phản ánh: `deletedById` để **rỗng**, không lưu số điện thoại | `deletedById` trỏ `staff_users._id`; số điện thoại là dữ liệu cá nhân nằm trong trường không chỗ nào che. Việc công dân thu hồi đã được ghi đủ ở `withdrawStatus` / `withdrawReason` / `withdrawRequestedAt` + một mốc nhật ký |
| 3 | `detail` ghi **khoá** trạng thái, không ghi nhãn tiếng Việt | Nhãn thuộc tầng cấu hình; lưu nhãn thì đổi cách gọi một trạng thái phải sửa dữ liệu lịch sử |
| 4 | Dữ liệu seed dùng một khoá chung `<phân hệ>.note` | Seed là nội dung demo, mỗi mốc là một câu tường thuật riêng, không quy về tập hành động đóng được |

### Kiểm chứng

| Phép kiểm | Trước (bản `545f914`) | Sau chặng 2a |
|---|---|---|
| Test đơn vị | 588 xanh | **588 xanh** |
| Test e2e | 27 đỏ / 73 xanh | **27 đỏ / 73 xanh** — không hồi quy |
| Biên dịch | 8 lỗi | **8 lỗi** — cùng 8 lỗi đó |

16 test phải sửa theo khuôn mới (15 đơn vị + 4 e2e). Trong đó có **một lỗi thật do test bắt
được**: `tasks.service.remove` vẫn truyền tên đăng nhập vào `markDeleted` thay vì id —
TypeScript không phát hiện được vì cả hai đều là `string`.

### Hai chỗ đỏ có sẵn trên `main`, KHÔNG phải do chặng này

| Chỗ đỏ | Biểu hiện | Đã kiểm chứng |
|---|---|---|
| 8 lỗi biên dịch ở `map` và `settings` | `TS7056` / `TS4053` — kiểu suy ra của phương thức công khai vượt giới hạn serialize khi bật `declaration` | Checkout `545f914` với `dist/tsconfig.tsbuildinfo` đã xoá → cũng đúng 8 lỗi. Trước đây bị bộ đệm `incremental` che, nên `npm run check:api` chạy với bộ đệm ấm thì xanh |
| 27 test e2e đỏ | Suite `attachments` 32 ca đỏ do `POST /files/upload` trả **415**; một ca `disbursement` trả **400** | `545f914` cũng 27 đỏ / 73 xanh |

Cả hai cần task riêng — xem mục 9.

## 9. Việc phát sinh, cần task riêng

| # | Việc | Vì sao không gộp vào đây |
|---|---|---|
| 1 | Sửa 8 lỗi biên dịch `map` / `settings` (thêm kiểu trả về tường minh) | Đỏ có sẵn, không thuộc phạm vi nâng cấp v2. Nhưng nó che mất mọi lỗi biên dịch khác nên nên sửa sớm |
| 2 | Sửa 27 test e2e đỏ (`POST /files/upload` trả 415) | Đỏ có sẵn. Đáng chú ý: e2e đỏ nghĩa là **không có lưới an toàn** cho chính đợt nâng cấp v2 |
| 3 | Chuẩn hoá `actor` của `audit_logs` | Đang lưu tên đăng nhập, là ngoại lệ có chủ ý của luật "luôn lưu id" — phải ghi vào tài liệu |
| 4 | `withdrawDecidedBy` của phản ánh vẫn lưu tên | Trường tham chiếu thứ 14, phát hiện thêm khi làm chặng 2a → xử lý ở chặng 2c |
