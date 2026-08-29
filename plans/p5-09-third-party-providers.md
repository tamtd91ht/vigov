# P5-09 — Nối nhà cung cấp thật: OCR, GIS, ZNS, FCM/APNs

> Trạng thái: **pending** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

Bốn adapter đang chạy mock, chờ khách chốt nhà cung cấp và cấp tài khoản (câu hỏi mở #1, #2, #3). Thuộc hệ số Tích hợp bên ngoài 15%.

## Kế hoạch thực hiện

- [ ] OCR: hiện thực provider theo nhà cung cấp khách chọn, ánh xạ kết quả về 7 trường chuẩn, xử lý ảnh mờ và độ tin cậy thấp.
- [ ] GIS: hiện thực geocode/reverse theo VietMap hoặc Goong; đổi bản đồ mô phỏng ở admin-web sang bản đồ thật (component MapCanvas đã tách sẵn).
- [ ] ZNS: nộp template chờ Zalo duyệt, hiện thực gửi thật, xử lý hạn mức và lỗi trả về.
- [ ] Push: cấu hình FCM cho Android và APNs cho iOS, lưu token thiết bị, gửi thử trên máy thật.
