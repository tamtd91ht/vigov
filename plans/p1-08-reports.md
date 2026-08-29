# P1-08 — Báo cáo

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #8 — Bộ chọn kỳ + so sánh cùng kỳ năm trước; 4 nhóm biểu đồ: nhiệm vụ theo bộ phận (hbar), tỷ lệ đúng hạn theo tháng 2026 vs 2025 (line), phản ánh theo lĩnh vực (hbar), giải ngân theo nguồn vốn (cột đôi); bảng xếp hạng bộ phận (đúng hạn/trễ/thời gian TB); nút xuất PDF/Excel/PPT.

## Kế hoạch thực hiện

- [x] Route `/reports`. Spec UI: prototype dòng 1618–1705 (renderReport) + MOCK_DATA.baoCao.
- [x] Biểu đồ CSS/SVG thuần đồng bộ với Dashboard; legend + hover.
- [x] Xếp hạng: bảng sort theo tỷ lệ đúng hạn, medal top 3.
- [x] Xuất PDF/Excel/PPT: nút gọi service export (mock ở Phase này; kết xuất thật P3/#27). Câu hỏi mở #11: bỏ PPT tiết kiệm 0.5 ngày — chờ khách.
