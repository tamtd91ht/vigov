# P5-08 — Thu hồi token khi khoá tài khoản / thu hồi phiên

> Trạng thái: **done** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

Tồn đọng mức Trung bình TB-01 trong SECURITY.md: khoá tài khoản hoặc thu hồi phiên hiện không làm JWT đang lưu hết hiệu lực, token vẫn dùng được tới khi hết hạn (8 giờ).

## Kế hoạch thực hiện

- [x] Thêm `sessionId` vào JWT payload khi cấp token.
- [x] JwtAuthGuard kiểm tra phiên còn hiệu lực (chưa `revoked`, chủ tài khoản chưa bị khoá).
- [x] Cache trạng thái phiên để không truy vấn cơ sở dữ liệu mỗi request (in-memory cho 1 tiến trình, Redis khi chạy nhiều instance).
- [x] Bổ sung test: khoá tài khoản xong thì token cũ trả 401.
