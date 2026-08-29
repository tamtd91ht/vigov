# P1-03 — Quản lý Công việc (Kanban + Bảng)

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #3 — Kanban 5 cột (Mới giao/Đang thực hiện/Chờ duyệt/Quá hạn/Hoàn thành) chuyển đổi được sang dạng bảng; bộ lọc bộ phận/người thực hiện/ưu tiên; drawer chi tiết: mô tả, checklist việc con tự cập nhật % tiến độ, bình luận, nhật ký, đính kèm, liên kết nguồn (văn bản/phản ánh/cuộc họp); form giao việc mới.

## Kế hoạch thực hiện

- [x] Route `/tasks`. Spec UI: prototype dòng 1137–1308 (renderTasks, taskDrawer) + MOCK_DATA.nhiemVu (15 nhiệm vụ).
- [x] Toggle Kanban ⇄ Bảng bằng SegmentControl; trạng thái cột + màu đọc từ `config/status.config.ts`.
- [x] Checklist trong drawer: tick → tính lại tienDo = done/total, cập nhật progress bar + toast.
- [x] Liên kết xuyên phân hệ: nguồn 'Từ CV…' link sang /documents, 'Từ phản ánh #PA…' link sang /feedback.
- [x] Form 'Giao việc mới' (drawer): tiêu đề, người thực hiện, bộ phận, hạn, ưu tiên, mô tả — validate bắt buộc; câu hỏi mở #6 (trường + notify) chờ khách.
