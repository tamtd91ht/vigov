# `deploy/` — tệp cấu hình chạy được

Thư mục này **chỉ chứa tệp dùng trực tiếp trên máy chủ**, không chứa tài liệu.
Toàn bộ tài liệu triển khai và vận hành nằm ở **`../docs/`**.

| Tệp | Dùng làm gì |
|---|---|
| `backup-mongo.sh` | Sao lưu MongoDB bằng `mongodump` chạy trong container. Đặt lịch cron → `../docs/06-VAN-HANH.md` mục 1 |
| `nginx-vigov.conf` | Cấu hình reverse proxy mẫu cho máy ứng dụng |
| `gateway-151-vigov.conf` | Cấu hình cho gateway dùng chung. **Đọc khối chú thích CORS ở đầu tệp** — thiếu `PATCH` là mọi thao tác sửa trên Web Quản trị và Mini App bị chặn tại trình duyệt |

## Tài liệu ở đâu

| Cần gì | Đọc |
|---|---|
| Dựng hệ thống trên máy chủ trống | `../docs/04-TRIEN-KHAI-VPS.md` |
| Triển khai trên Kubernetes, CI/CD bằng Jenkins | `../docs/05-TRIEN-KHAI-K8S.md` |
| Sao lưu, xoay log, cập nhật phiên bản, xử lý sự cố | `../docs/06-VAN-HANH.md` |
| Kịch bản kiểm thử hồi quy, nghiệm thu | `../docs/07-UAT-VA-NGHIEM-THU.md` |
| Phát hành Zalo Mini App | `../docs/08-ZALO-PHAT-HANH.md` |
| Việc bắt buộc trước khi lên production | `../SECURITY.md` mục 4 |

Manifest Kubernetes: `../k8s/`.
