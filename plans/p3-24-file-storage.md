# P3-24 — Backend — File storage

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #24 — Lưu trữ file scan văn bản, ảnh phản ánh, audio truyền thanh, video: upload, resize ảnh, giới hạn dung lượng, phân quyền truy cập, CDN-ready.

## Kế hoạch thực hiện

- [x] Storage adapter (local/S3-compatible qua env).
- [x] Pipeline ảnh: resize/thumbnail; giới hạn theo config.
- [x] Signed URL cho file riêng tư.
