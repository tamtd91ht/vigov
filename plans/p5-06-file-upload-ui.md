# P5-06 — Tải tệp thật từ giao diện

> Trạng thái: **done** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

Backend đã có `/files` (upload, link ký, phân quyền) nhưng giao diện chưa gọi: ảnh phản ánh, bản scan văn bản, audio truyền thanh, video CMS đều đang là màu giữ chỗ.

## Kế hoạch thực hiện

- [x] admin-web: tải bản scan ở form Tiếp nhận văn bản, ảnh bìa/video/audio ở CMS; hiển thị bằng link ký cho tệp riêng tư.
- [x] mobile: thay ô màu giữ chỗ bằng `image_picker` thật, nén ảnh trước khi tải lên, hiện tiến độ.
- [x] zalo-miniapp: dùng `chooseImage` của Zalo SDK rồi tải lên `/files/upload`.
- [x] Xử lý lỗi vượt dung lượng và sai định dạng theo thông báo backend trả về.
