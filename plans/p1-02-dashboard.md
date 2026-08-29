# P1-02 — Dashboard Tổng quan

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #2 — 6 thẻ KPI drill-down (điều hướng sang phân hệ tương ứng), biểu đồ cột nhiệm vụ theo tháng (hoàn thành/được giao), biểu đồ đường giải ngân luỹ kế kế hoạch vs thực tế, bảng 'Cần xử lý ngay' (đánh dấu quá hạn), bộ chọn kỳ.

## Kế hoạch thực hiện

- [x] Route `/` (nhóm dashboard). Spec UI: vigov-prototype.html dòng 1066–1137 (renderOverview) + MOCK_DATA.kpi/nhiemVuThang/giaiNganLuyKe/canXuLy.
- [x] KPI card có tint màu riêng, click điều hướng theo `man` (tasks/docs/fund/feedback).
- [x] Biểu đồ thuần CSS/SVG như mockup (cột đôi + đường luỹ kế), không phụ thuộc thư viện chart ở Phase 1.
- [x] Bộ chọn kỳ (tháng/quý/năm) — dữ liệu mock lọc client-side; API thật thay ở P3.
- [x] Câu hỏi mở #5: bộ chọn kỳ cần đa kỳ thật hay không — chờ khách.
