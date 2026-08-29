# P1-05 — Ngân sách / Giải ngân

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #5 — Thẻ tóm tắt (tổng kế hoạch, đã giải ngân, tỷ lệ, số hạng mục chậm), danh sách hạng mục với progress bar kế hoạch/thực tế, drawer chi tiết: lịch sử giải ngân (chứng từ UNC), vướng mắc kèm hạn tháo gỡ, bình luận; nút đề nghị giải ngân / nhắc tháo gỡ; xuất Excel.

## Kế hoạch thực hiện

- [x] Route `/disbursement`. Spec UI: prototype dòng 1380–1460 (renderFund, fundDrawer) + MOCK_DATA.giaiNgan (5 hạng mục).
- [x] Hạng mục chậm (cham:true) badge đỏ 'Chậm tiến độ'; nguồn vốn chip màu theo mauNguon.
- [x] Drawer tabs: Lịch sử giải ngân (bảng chứng từ) / Vướng mắc (hạn tháo gỡ, người phụ trách) / Thảo luận (CommentList).
- [x] Xuất Excel: nút gọi service export (mock download CSV ở Phase này, endpoint thật ở P3/#27).
- [x] Câu hỏi mở #8: ai tạo hạng mục, ai duyệt đề nghị giải ngân — luồng duyệt chờ khách chốt.
