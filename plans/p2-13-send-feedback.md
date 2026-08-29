# P2-13 — Mobile — Gửi phản ánh 3 bước

> Trạng thái: **done** · Đổi hướng 27/08/2026: mobile dùng **Flutter (Android + iOS)** thay Zalo Mini App theo yêu cầu khách

## Mô tả

Stepper 3 bước: chọn 1/12 danh mục → mô tả (validate) + tối đa 3 ảnh (mock picker, preview/xoá) + vị trí GPS (mock service, sửa được địa chỉ) → xác nhận: sinh mã phiếu, cam kết SLA theo danh mục, nút theo dõi phiếu. Xử lý luồng từ chối quyền GPS/camera (nhập tay).

## Kế hoạch thực hiện

- [x] Danh mục + SLA từ `lib/config/categories.dart`.
- [x] Ảnh & GPS qua adapter service (mock Phase này; image_picker/geolocator thật thuộc hệ số tích hợp ngoài).
- [x] Màn xác nhận gọi FeedbackService.create (mock sinh mã #PA-xxxx — quy tắc mã thật chờ khách, câu hỏi mở #17).
