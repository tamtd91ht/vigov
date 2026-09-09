---
name: trien-khai-docker
description: Dùng khi làm việc với docker-compose, Dockerfile, nginx, CI/CD, Jenkins, GitHub Actions, biến môi trường lúc triển khai, VPS. Kích hoạt bởi: docker, docker-compose, Dockerfile, nginx, deploy, triển khai, CI, Jenkins, GitHub Actions, VPS, staging, production, gateway, proxy, port, cổng, health check.
---

# Kỹ năng: Triển khai — Docker, nginx, CI
# Mức: CAO | Ngăn: biến môi trường thành chuỗi rỗng lặng lẽ, CORS chặn hết, 502

## Cạm bẫy đã trả giá

| Sự cố | Nguyên nhân | Cách tránh |
|---|---|---|
| Tên xã hiện rỗng, tâm bản đồ ra giữa Vịnh Guinea | `docker-compose.yml` truyền `${BIẾN:-}` cho biến không khai trong `.env`, Dockerfile gán `ENV BIẾN=` → **chuỗi rỗng, không phải undefined** | Đọc env bằng `envText`/`envNumber`/`envFlag` — coi chuỗi rỗng là chưa đặt |
| Mọi thao tác `PATCH` bị chặn | Xung đột CORS ở gateway dùng chung | admin-web gọi API **cùng origin** qua rewrite |
| 502 sau nginx | `keepalive` cấu hình sai | Xem `deploy/gateway-151-vigov.conf` |
| Realtime im lặng không chạy | nginx không chuyển tiếp `/socket.io/` | Khai tường minh trong cấu hình nginx |
| Rate-limit đếm gộp mọi người dùng | Chưa đặt `TRUST_PROXY` → `req.ip` là IP của nginx | Đặt `TRUST_PROXY=1` (đúng số lớp proxy) |
| Dấu nối dòng trong Dockerfile bị ghi thành ký tự `\n` | Lỗi khi sinh tệp | Kiểm tra Dockerfile bằng mắt sau khi sửa bằng script |

## MUST

| # | Luật |
|---|------|
| 1 | Thêm biến môi trường mới → cập nhật **cả bốn** chỗ: `.env.local` của module · `.env.example` của module · `.env.example` gốc · `docker-compose.yml`. Thiếu một chỗ là container nhận chuỗi rỗng mà **không báo lỗi** |
| 2 | Thư mục gốc dùng cặp `.env` / `.env.example` — Docker Compose chỉ tự đọc tệp tên đúng `.env` |
| 3 | Kiểm tra sau khi đổi cấu hình: `docker compose config` để xem giá trị thật sự được truyền |
| 4 | Production **bắt buộc**: `JWT_SECRET` thật (≥ 32 ký tự) · `CORS_ORIGINS` là tên miền thật · `TRUST_PROXY` đúng · `MONGO_URI` có xác thực · `RABBITMQ_URI` không còn `guest` · `CITIZEN_OTP_BYPASS_CODE` để trống |
| 5 | `CORS_ORIGINS` production phải có tên miền Web Quản trị **và** `https://h5.zdn.vn` (Mini App). Để `*` sẽ **không khởi động được** — đây là hành vi cố ý |
| 6 | Chạy nhiều hơn một instance backend → `OTP_STORE=mongo` |
| 7 | HTTPS/TLS bật ở nginx **trước** khi đặt `NODE_ENV=production` (HSTS chỉ gắn khi production) |
| 8 | Thư mục `uploads/` đặt ngoài thư mục mã nguồn, quyền `0750`, **không** để nginx phục vụ tĩnh |
| 9 | Sao lưu MongoDB hằng ngày (`deploy/backup-mongo.sh`), giữ ≥ 30 bản, kiểm thử khôi phục định kỳ |
| 10 | Kiểm tra sức khoẻ sau triển khai: `GET /api/v1/health/ready` (có trường `messaging.blocked`) |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Commit `.env` hay `.env.local`; `git add -f` tệp env |
| 2 | Đặt secret thật vào `docker-compose.yml` hay `Jenkinsfile` hay `ci.yml` — dùng phần Secrets của nền tảng |
| 3 | Mở cổng 27017 (Mongo) hay 5672/15672 (RabbitMQ) ra Internet |
| 4 | Chạy `seed --fresh` trên môi trường có dữ liệu thật → `rules/critical/bao-toan-du-lieu.md` |
| 5 | Bật `NEXT_PUBLIC_USE_MOCKS=true` hay `VITE_DEMO_MODE=true` ở staging/production |
| 6 | Triển khai khi chưa có bản `mongodump` gần nhất |
| 7 | Dùng `http://` cho API ở môi trường thật |
| 8 | Đổi cấu hình trực tiếp trên máy chủ mà không đưa vào repo (lần triển khai sau mất) |

## Cổng và địa chỉ (dev)

| Module | Địa chỉ |
|---|---|
| Backend API | `http://localhost:3001/api/v1` |
| Web Quản trị | `http://localhost:3100` (**không** phải 3000 — 3000 hay bị chiếm) |
| Zalo Mini App | `http://localhost:5173` |

## Tài liệu triển khai

`docs/04-TRIEN-KHAI.md` — runbook từng bước từ VPS trống (Bước 0–11) rồi chuyển sang
Jenkins (Bước 12). `deploy/README.md` tra cứu theo chủ đề. `deploy/VPS-VA-ZALO.md` cho
VPS + nộp Mini App. `deploy/UAT.md` kế hoạch UAT. `deploy/RELEASE.md` hồ sơ 3 store.

→ `rules/critical/bi-mat-cau-hinh.md` · `skills/hang-doi-rabbitmq` · `skills/realtime-socket`
