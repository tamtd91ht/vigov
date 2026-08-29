# P1-09 — Cấu hình hệ thống

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #9 — 4 khối: cấu hình SLA theo 8 lĩnh vực (thời gian tiếp nhận/xử lý/cảnh báo, sửa inline); sơ đồ tổ chức dạng cây (collapse/expand, CRUD node); tài khoản & phân quyền (bảng người dùng, vai trò, trạng thái, khoá/mở); danh mục lĩnh vực phản ánh.

## Kế hoạch thực hiện

- [x] Route `/settings`. Spec UI: prototype dòng 1705–1759 (renderConfig) + MOCK_DATA.cauHinh.
- [x] Tabs 4 khối. SLA: bảng sửa inline (input số + đơn vị), lưu → toast; giá trị mặc định từ `config/sla.config.ts`.
- [x] Sơ đồ tổ chức: cây đệ quy, nút thêm/sửa/xoá node (mock), collapse từng nhánh.
- [x] Người dùng: bảng (avatar, tài khoản, bộ phận, vai trò, đăng nhập cuối, trạng thái) + khoá/mở + gán vai trò từ roles.config.
- [x] Câu hỏi mở #12, #13: mô hình phân quyền chi tiết + quy mô sơ đồ tổ chức — chờ khách.
