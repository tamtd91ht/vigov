# P2Z-02 — Zalo Mini App — Gửi phản ánh 3 bước

> Trạng thái: **done** · Bổ sung 27/08/2026: khách yêu cầu làm **cả Zalo Mini App** song song app Flutter

## Mô tả

Stepper 3 bước: chọn danh mục → mô tả + tối đa 3 ảnh + định vị GPS (adapter mock, xử lý từ chối quyền) → xác nhận sinh mã phiếu + cam kết SLA.

## Kế hoạch thực hiện

- [x] Tái dùng cấu trúc luồng của app Flutter để nghiệp vụ đồng nhất.
- [x] Ảnh/GPS qua adapter Zalo SDK.
