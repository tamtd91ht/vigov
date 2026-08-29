# ViGov — Triển khai VPS và nộp Zalo Mini App

> Tài liệu thao tác, viết theo đúng hiện trạng mã nguồn ngày 28/08/2026.
> Chi tiết hạ tầng nền: `deploy/README.md` · Hồ sơ 3 store: `deploy/RELEASE.md`

---

## PHẦN A — Triển khai lên VPS

### A0. Điều kiện cần có trước

| Hạng mục | Yêu cầu tối thiểu | Ai lo |
|---|---|---|
| VPS | 4 vCPU · 8 GB RAM · 80 GB SSD · Ubuntu 22.04/24.04 | Khách hàng |
| Tên miền | 3 tên miền phụ trỏ về IP VPS | Khách hàng |
| Cổng mở | 80, 443 (KHÔNG mở 3000/3001/8080/27017/5672) | Khách hàng |
| Phần mềm trên VPS | Docker Engine + Docker Compose plugin, nginx, certbot | Đội triển khai |

Ba tên miền phụ (đổi `<tên-miền>` theo thực tế):

| Tên miền | Dùng cho |
|---|---|
| `api.vigov.<tên-miền>` | Backend — **bắt buộc HTTPS**, cả Mini App lẫn app Flutter đều gọi vào đây |
| `quantri.vigov.<tên-miền>` | Web Quản trị cho cán bộ |
| `miniapp.vigov.<tên-miền>` | Chỉ để xem trước Mini App trên trình duyệt (bản chính thức chạy trên hạ tầng Zalo) |

### A1. Chuẩn bị VPS

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # đăng xuất/đăng nhập lại cho có hiệu lực
```

Cấp chứng thư TLS cho cả ba tên miền:

```bash
sudo certbot --nginx -d api.vigov.<tên-miền> -d quantri.vigov.<tên-miền> -d miniapp.vigov.<tên-miền>
```

### A2. Lấy mã nguồn và cấu hình

```bash
git clone <repo> /opt/vigov && cd /opt/vigov
cp .env.example .env
chmod 600 .env
```

Sửa `.env` — **những giá trị bắt buộc phải đổi**, để nguyên là hệ thống không chạy hoặc mất an toàn:

```bash
# Sinh khoá ngẫu nhiên
openssl rand -base64 48    # dùng cho JWT_SECRET
openssl rand -base64 24    # dùng cho mật khẩu MongoDB / RabbitMQ
```

| Biến | Ghi chú |
|---|---|
| `JWT_SECRET` | ≥ 32 ký tự ngẫu nhiên. **Backend từ chối khởi động** nếu còn giá trị mẫu |
| `CORS_ORIGINS` | `https://quantri.vigov.<tên-miền>,https://h5.zdn.vn` — **backend từ chối khởi động** nếu để trống hoặc `*` |
| `MONGO_ROOT_PASSWORD` + `MONGO_URI` | Phải khớp nhau |
| `RABBITMQ_DEFAULT_PASS` + `RABBITMQ_URI` | Phải khớp nhau |
| `SEED_ADMIN_PASSWORD`, `SEED_DEFAULT_PASSWORD` | Mật khẩu mạnh, đổi ngay sau lần đăng nhập đầu |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.vigov.<tên-miền>/api/v1` |
| `VITE_API_BASE_URL` | Như trên |
| `NEXT_PUBLIC_USE_MOCKS` / `VITE_USE_MOCKS` | Đặt `false` |
| `NEXT_PUBLIC_DEMO_USERNAME` / `..._PASSWORD` | **Để trống** ở production |
| `TRUST_PROXY` | `1` (có đúng một lớp nginx phía trước) |

> `NEXT_PUBLIC_*` và `VITE_*` được **nhúng vào bundle lúc build**. Sửa xong phải
> `docker compose build` lại — chỉ `up` lại không có tác dụng.

### A3. Cấu hình reverse proxy

```bash
sudo cp deploy/nginx-vigov.conf /etc/nginx/sites-available/vigov
sudo sed -i 's/<tên-miền>/tên-miền-thật.gov.vn/g' /etc/nginx/sites-available/vigov
sudo ln -sf /etc/nginx/sites-available/vigov /etc/nginx/sites-enabled/vigov
sudo nginx -t && sudo systemctl reload nginx
```

Cấu hình này đã xử lý sẵn: ép HTTP→HTTPS, chuyển tiếp `X-Forwarded-*` để backend
ghi đúng IP người dùng, nâng cấp WebSocket cho Socket.IO, và giới hạn kích thước
tệp tải lên khớp với backend.

### A4. Khởi chạy

```bash
docker compose build          # bỏ qua nếu CI đã push image lên registry
docker compose up -d
docker compose ps             # cả 5 dịch vụ phải "healthy"
```

Tạo dữ liệu khởi tạo (**chỉ chạy một lần**):

```bash
docker compose run --rm --no-deps backend node dist/apps/api-gateway/apps/api-gateway/src/seed
```

Lệnh này tạo tài khoản quản trị + 9 tài khoản cán bộ + cấu hình SLA + dữ liệu
demo. Nếu **không** muốn dữ liệu demo trên production, xoá các collection nghiệp
vụ sau khi seed hoặc sửa `seed.ts` để bỏ phần đó.

### A5. Nghiệm thu sau triển khai

```bash
curl https://api.vigov.<tên-miền>/api/v1/health/ready
# mong đợi: {"status":"ok","database":"connected","messaging":{"connected":true,...}}

curl -I https://quantri.vigov.<tên-miền>          # 200, có header HSTS
curl -I http://api.vigov.<tên-miền>               # 301 sang https
```

- Đăng nhập Web Quản trị bằng tài khoản quản trị, **đổi mật khẩu ngay**.
- Kiểm tra `docker compose logs backend | grep -i cors` — phải thấy dòng
  "CORS: chỉ chấp nhận …", không phải "cho phép mọi nguồn".
- Bật sao lưu MongoDB theo lịch: `deploy/backup-mongo.sh` (hướng dẫn trong `deploy/README.md`).

### A6. Việc bắt buộc làm ngay sau khi lên production

- [ ] Đổi mật khẩu toàn bộ tài khoản seed.
- [ ] Đóng cổng 27017 và 5672 với Internet (compose đã bind `127.0.0.1`, kiểm tra lại bằng `ss -tlnp`).
- [ ] Bật cron `certbot renew` (certbot cài qua apt đã tự tạo timer — xác nhận bằng `systemctl list-timers | grep certbot`).
- [ ] Đặt lịch `backup-mongo.sh` hằng ngày và **thử khôi phục một lần** để chắc bản sao lưu dùng được.
- [ ] Rà lại `SECURITY.md`, mục "việc cần làm trước khi lên production".

---

## PHẦN B — Nộp Zalo Mini App

### B0. Điều kiện cần có trước

| Hạng mục | Ghi chú | Ai lo |
|---|---|---|
| Zalo Official Account của UBND xã | Nên xác thực OA (tick xanh) — cơ quan nhà nước thường được yêu cầu | Khách hàng |
| Tài khoản Zalo Developers | Liên kết với OA ở trên | Khách hàng |
| Mini App ID | Tạo tại developers.zalo.me, lấy App ID | Khách hàng |
| Backend đã có HTTPS | **Bắt buộc** — Mini App chạy trong webview, gọi `http://` sẽ bị chặn | Phần A |
| Giấy tờ đơn vị | Zalo thường yêu cầu với Mini App của cơ quan nhà nước | Khách hàng |

### B1. Cấu hình trước khi build

Trong `zalo-miniapp/.env.local`:

```
VITE_API_BASE_URL=https://api.vigov.<tên-miền>/api/v1
VITE_USE_MOCKS=false
VITE_ZALO_APP_ID=<App ID lấy từ Zalo Developers>
VITE_ZALO_OA_ID=<OA ID>
```

Trong `backend/.env.local` (hoặc `.env` gốc khi chạy Docker) để bật định danh Zalo thật:

```
ZALO_APP_ID=<App ID>
ZALO_APP_SECRET=<App Secret>
ZALO_OA_ID=<OA ID>
```

> Chưa có `ZALO_APP_SECRET` thì backend không đổi được token Zalo sang số điện
> thoại, Mini App sẽ tự rơi về luồng nhập SĐT + OTP. Chạy thử được nhưng
> **không phải luồng cuối cùng** — phải cấu hình trước khi nộp kiểm duyệt.

Kiểm tra `CORS_ORIGINS` của backend đã có `https://h5.zdn.vn` — thiếu là Mini App
gọi API sẽ bị trình duyệt chặn.

### B2. Đăng nhập và nộp

```bash
cd zalo-miniapp
npm install
npm run zmp:login      # mở trình duyệt, đăng nhập tài khoản Zalo Developers
npm run zmp:deploy     # build rồi tải bundle lên hạ tầng Zalo
```

`zmp:deploy` chạy `npm run build` trước nên bundle luôn khớp mã nguồn hiện tại.

> **Mini App KHÔNG chạy trên VPS của mình.** Bundle được tải thẳng lên hạ tầng
> Zalo và phục vụ tại `h5.zdn.vn`. Dịch vụ `zalo-miniapp` trong docker-compose
> chỉ để nội bộ xem trước trên trình duyệt. VPS vẫn cần thiết vì Mini App gọi
> API backend.

### B3. Khai báo trên Zalo Developers

- **Quyền sử dụng**: số điện thoại, vị trí, camera/thư viện ảnh, quét QR — mỗi
  quyền phải nêu rõ mục đích (Zalo kiểm rất kỹ phần này).
- **Ảnh chụp màn hình + mô tả**: dùng nội dung soạn sẵn ở `deploy/RELEASE.md` mục 4.
- **Chính sách quyền riêng tư**: cần URL công khai — có thể đặt luôn trên
  `quantri.vigov.<tên-miền>/privacy` hoặc trang thông tin của xã.
- **Tài khoản thử cho người kiểm duyệt**: Mini App định danh bằng SĐT Zalo nên
  reviewer dùng chính tài khoản của họ; ghi chú rõ luồng sử dụng trong phần
  "Hướng dẫn cho người kiểm duyệt".

### B4. Template ZNS — nộp song song, đừng chờ

Template ZNS được **duyệt riêng**, không đi cùng Mini App, thời gian **vài ngày
đến 1 tuần**. Cần 2 template (xem `backend/.env.example`):

| Biến | Nội dung |
|---|---|
| `ZNS_TEMPLATE_FEEDBACK_RECEIVED` | Xác nhận đã tiếp nhận phản ánh, kèm mã phiếu và cam kết thời hạn |
| `ZNS_TEMPLATE_FEEDBACK_RESOLVED` | Thông báo phản ánh đã xử lý xong, mời đánh giá |

Nộp ngay khi bắt đầu triển khai VPS để chạy song song. Chưa duyệt xong thì hệ
thống vẫn chạy, chỉ là công dân không nhận được tin nhắn Zalo.

### B5. Sau khi được duyệt

- [ ] Kiểm thử trên máy thật (Android + iPhone): định danh, gửi phản ánh kèm ảnh và GPS, quét QR.
- [ ] Xác nhận thông báo ZNS đến được sau khi cán bộ xử lý xong một phiếu.
- [ ] Theo dõi log backend vài ngày đầu: `docker compose logs -f backend`.

---

## Thứ tự nên làm

```
Tuần 1  ─┬─ Khách: đăng ký OA + Zalo Developers, mua VPS, trỏ tên miền
         ├─ Khách: nộp template ZNS  ← lead time dài nhất, làm sớm nhất
         └─ Đội: dựng VPS (A1–A4)

Tuần 2  ─┬─ Đội: nghiệm thu VPS (A5), bật sao lưu
         └─ Đội: build và nộp Mini App (B1–B3)

Tuần 3  ─┬─ Zalo kiểm duyệt (ngoài tầm kiểm soát)
         └─ Đội: chạy 10 kịch bản hồi quy trong deploy/UAT.md
```

Đường găng là **thời gian Zalo duyệt**, không phải công sức lập trình — nên các
việc phía khách hàng ở mục A0 và B0 cần khởi động ngay từ ngày đầu.
