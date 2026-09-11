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
