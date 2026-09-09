---
name: quan-ly-task-plan
description: Dùng khi bắt đầu, tiếp tục, hoặc kết thúc một task trong pending-tasks.json, hoặc khi viết plan cho task mới. Kích hoạt bởi: task, pending-tasks.json, plan, plans/, WBS, P0 P1 P2 P3 P4 P5, tiến độ, in-progress, done, câu hỏi mở, ESTIMATE_TECHNICAL.
---

# Kỹ năng: Quản lý task và plan
# Mức: CAO | Ngăn: mất dấu công việc, làm lệch phạm vi, tự chốt câu hỏi mở của khách

## Cơ chế

`pending-tasks.json` ở gốc dự án — mảng các task:

```json
{
  "id": "P3-26",
  "name": "Tên task ngắn",
  "description": "Phạm vi cụ thể",
  "planFilePath": "plans/p3-26-<slug>.md",
  "createdAt": "...", "updatedAt": "...",
  "status": "pending" | "in-progress" | "done"
}
```

Mã task theo pha: `P0` khung · `P1` Web Quản trị · `P2` app Flutter · `P2Z` Mini App ·
`P3` backend · `P4` hạ tầng/bảo mật/phát hành · `P5` gia cố sau rà soát.
Nguồn gốc: WBS #1–#38 trong `ESTIMATE_TECHNICAL.md`.

## MUST

| # | Luật |
|---|------|
| 1 | Bắt đầu một task → đọc **cả** mục trong `pending-tasks.json` **và** tệp plan tương ứng trước khi viết mã |
| 2 | Đổi `status` sang `in-progress` khi bắt đầu, `done` khi hoàn tất; cập nhật `updatedAt` |
| 3 | Task mới → tạo tệp plan `plans/<id-thường>-<slug>.md` với: phạm vi, checklist, câu hỏi mở liên quan, cách kiểm chứng |
| 4 | Làm **đúng phạm vi** trong plan. Phát hiện việc cần làm ngoài phạm vi → ghi vào plan hoặc tạo task mới, **không** tự làm luôn |
| 5 | Task chạm vào một **câu hỏi mở** → nêu ra, làm theo mặc định an toàn nhất, ghi giả định vào plan |
| 6 | Kết thúc task: chạy kiểm chứng (`skills/kiem-thu-vigov`) → cập nhật tài liệu (`skills/tai-lieu-dong-bo`) → đổi trạng thái → cập nhật `BAO-CAO-TIEN-DO.md` |
| 7 | Ghi vào plan những gì **không** làm và vì sao — đây là thông tin bàn giao |

## MUST NOT

| # | Luật |
|---|------|
| 1 | **Tự chốt câu hỏi mở của khách hàng.** ~27 câu hỏi mở là quyết định của khách, không phải của người viết mã |
| 2 | Đánh dấu `done` khi chưa chạy kiểm chứng |
| 3 | Xoá task khỏi `pending-tasks.json` (đổi trạng thái, giữ lịch sử) |
| 4 | Mở rộng phạm vi task trong lúc làm mà không nói với người dùng |
| 5 | Gộp nhiều task vào một commit lớn không phân biệt được |
| 6 | Sửa `pending-tasks.json` bằng cách viết lại toàn tệp (dễ mất task khác) — sửa đúng phần tử |
| 7 | Ghi dữ liệu cá nhân hay giá trị secret vào plan |

## Câu hỏi mở đang ảnh hưởng nhiều nhất

| # | Nội dung | Ảnh hưởng |
|---|---|---|
| #1 #2 #3 | Nhà cung cấp OCR / đọc CCCD / GIS | `skills/adapter-ben-thu-ba` — hiện đều là `mock` |
| #6 | Cloud hay on-premise | Phần Docker build/push và deploy trong CI để riêng |
| #7 | Phạm vi realtime | `skills/realtime-socket` — chỉ 3 sự kiện, không tự mở rộng |
| #12 | Khung phân quyền | `roles.ts` ↔ `roles.config.ts` |
| #13 | Nhiều xã dùng chung một hệ thống | Kéo theo nhiều instance backend, Redis, Mongo replica set |
| #15 | Quyền `users:edit` của vai trò Tiếp nhận một cửa | Phát hiện T-04 trong `SECURITY.md` |
| #28 | Phạm vi tìm kiếm toàn cục | `modules/search` |

Danh sách đầy đủ: `ESTIMATE_TECHNICAL.md`.

→ `commands/phan-tich-task` · `commands/task-xong` · `skills/tai-lieu-dong-bo`
