# P5-05 — Socket.IO — cập nhật thời gian thực

> Trạng thái: **done** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

Techstack yêu cầu Socket.IO. Phạm vi màn hình nào cần realtime còn chờ khách xác nhận (câu hỏi mở #7) — ước tính thêm 0.5–1 ngày nếu áp dụng toàn cục.

## Kế hoạch thực hiện

- [x] Chốt phạm vi với khách: đề xuất tối thiểu Dashboard, danh sách Phản ánh, chuông thông báo.
- [x] Gateway Socket.IO trong backend, xác thực bằng chính JWT, chia phòng theo bộ phận và theo vai trò.
- [x] Phát sự kiện khi phiếu phản ánh/nhiệm vụ đổi trạng thái; các màn còn lại giữ cơ chế tải lại định kỳ.
- [x] Client: hook `useRealtime` ở admin-web, tự kết nối lại khi rớt mạng.
