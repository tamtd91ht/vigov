# ViGov — Vận hành hệ thống đang chạy

Tài liệu tra cứu **theo chủ đề** cho hệ thống đã triển khai: sao lưu, xoay log, cập
nhật phiên bản, rollback, xử lý sự cố.

Khác với `04-TRIEN-KHAI-VPS.md` (làm gì, theo thứ tự nào, cho lần cài đặt đầu tiên),
tài liệu này trả lời *vì sao* và *xử lý khi hỏng* — đọc theo mục khi cần, không đọc
tuần tự.

Áp dụng cho mô hình **một máy chủ + Docker Compose**. Vận hành trên Kubernetes →
`05-TRIEN-KHAI-K8S.md`.

---

## 1. Sao lưu MongoDB

### 1.1 Sao lưu thủ công

```bash
cd /opt/vigov
bash deploy/backup-mongo.sh
# → ./backups/vigov-vigov-20260828-020000.archive.gz
```

Script chạy `mongodump --archive --gzip` **bên trong container mongo** (không cần cài
mongo-tools trên host), ghi ra thư mục `${BACKUP_DIR}` đã bind-mount, rồi tự xoá bản cũ
hơn `RETENTION_DAYS` (mặc định 14 ngày).

### 1.2 Đặt lịch tự động (cron)

```bash
sudo crontab -e
```

```cron
# ViGov — sao lưu MongoDB 02:00 mỗi ngày (giờ Việt Nam)
0 2 * * *  cd /opt/vigov && /usr/bin/bash deploy/backup-mongo.sh >> /var/log/vigov-backup.log 2>&1

# Đồng bộ bản sao lưu sang máy/NAS khác lúc 03:00 — BẮT BUỘC ở production.
# Giữ bản sao trên cùng một ổ đĩa KHÔNG phải là sao lưu.
0 3 * * *  rsync -az --delete /opt/vigov/backups/ backup@<nas-host>:/srv/backup/vigov/
```

### 1.3 Khôi phục

```bash
docker compose exec -T mongo sh -c 'mongorestore \
    --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --archive=/backups/vigov-vigov-20260828-020000.archive.gz \
    --gzip --drop'
```

`--drop` xoá collection cũ trước khi nạp lại.

> **Luôn diễn tập khôi phục trên staging trước.** Một bản sao lưu chưa từng được khôi
> phục thử thì chưa thể coi là bản sao lưu.

### 1.4 Đừng quên tệp đính kèm

`mongodump` **không** bao gồm ảnh/tệp trong volume `uploads`. Sao lưu riêng:

```bash
docker run --rm \
  -v vigov_uploads:/data:ro \
  -v /opt/vigov/backups:/backup \
  alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

*(Tên volume có tiền tố `COMPOSE_PROJECT_NAME`; kiểm bằng `docker volume ls`.)*

Mất tệp đính kèm là mất **ảnh hiện trường của phiếu phản ánh** và **bản scan văn bản
đến** — tài liệu hành chính, không tái tạo được. → `../SECURITY.md`

---

## 2. Xoay log

Có **ba tầng log**, mỗi tầng một cơ chế riêng.

### 2.1 Log ứng dụng (stdout của container)

Đã cấu hình sẵn trong `docker-compose.yml` qua khối `x-logging`:

```yaml
driver: json-file
options:
  max-size: "10m"   # mỗi file tối đa 10 MB
  max-file: "5"     # giữ 5 file → tối đa 50 MB/service
```

Trần cứng: 5 service × 50 MB = **250 MB**. Không có cấu hình này, thư mục
`/var/lib/docker/containers` sẽ phình đến đầy đĩa và làm sập cả máy chủ.

Nên đặt luôn mức mặc định cho toàn máy trong `/etc/docker/daemon.json`, để mọi container
ngoài compose (CI runner, container tạm) cũng bị giới hạn:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" }
}
```

```bash
sudo systemctl restart docker   # container đang chạy sẽ được tạo lại
```

### 2.2 Log nginx của Mini App

Ghi vào `/var/log/nginx` **bên trong container**, và trong ảnh `nginx:alpine` hai tệp
này là symlink tới `/dev/stdout` và `/dev/stderr` ⇒ chảy về Docker và được xoay theo
mục 2.1. Không cần logrotate riêng.

### 2.3 Log reverse proxy và log sao lưu (trên host)

```bash
sudo tee /etc/logrotate.d/vigov > /dev/null <<'EOF'
/var/log/vigov-backup.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
}
EOF
```

### 2.4 Nhật ký thao tác — KHÔNG được xoay

Nhật ký thao tác của cán bộ lưu trong MongoDB, **không** phải log hệ thống. Đây là dữ
liệu nghiệp vụ thuộc diện phải lưu trữ theo quy định (tối thiểu 12 tháng), chỉ được xoá
theo chính sách lưu trữ của đơn vị, và **phải nằm trong phạm vi sao lưu** ở mục 1.

---

## 3. Cập nhật phiên bản

### 3.1 Cách hoạt động

Mỗi image gắn tag bất biến theo commit: `<branch>-<sha7>` (ví dụ `main-a1b2c3d`). Cập
nhật chỉ là **đổi `IMAGE_TAG` trong `.env` rồi `up`**:

```bash
cd /opt/vigov
cp .env .env.bak.$(date +%Y%m%d%H%M%S)        # để rollback
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=main-a1b2c3d|' .env
docker compose pull
docker compose up -d --remove-orphans --wait --wait-timeout 180
docker compose ps
```

Compose so sánh cấu hình từng service và **chỉ tạo lại container nào thực sự thay
đổi**. Mongo và RabbitMQ giữ nguyên (không đổi image, không đổi env) nên không bị khởi
động lại — dữ liệu và kết nối hàng đợi không gián đoạn.

Gián đoạn thực tế: mỗi service ứng dụng ngừng **khoảng 5–15 giây**. Với quy mô một xã,
cửa sổ này chấp nhận được — nên thực hiện ngoài giờ hành chính.

### 3.2 Nếu khách yêu cầu không gián đoạn

Cần **2 bản sao backend sau một load balancer**. Compose đơn máy không làm gọn được:

- **Docker Swarm** — `docker stack deploy` với `update_config: order: start-first`.
  Thêm ~1 ngày cấu hình, dùng lại gần như nguyên `docker-compose.yml`.
- **Kubernetes** — RollingUpdate sẵn có → `05-TRIEN-KHAI-K8S.md`.

Khuyến nghị: giữ compose đơn máy cho quy mô một xã; chuyển khi triển khai đa xã.

### 3.3 Lưu ý bắt buộc với admin-web và zalo-miniapp

Biến `NEXT_PUBLIC_*` và `VITE_*` được **nhúng vào bundle JavaScript lúc build**, không
đọc lại lúc chạy.

> Đổi các biến này trong `.env` rồi `docker compose up -d` là **KHÔNG có tác dụng**.
> Bắt buộc `docker compose build admin-web zalo-miniapp` (hoặc build lại trên CI) rồi
> mới triển khai.

Hệ quả: staging và production dùng **hai image khác nhau**, không thể "thăng hạng"
nguyên xi image từ staging lên production. Pipeline đã build riêng cho từng nhánh
(`develop` → staging, `main` → production).

### 3.4 Rollback

```bash
cd /opt/vigov
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=<tag-cũ>|' .env    # hoặc khôi phục .env.bak.*
docker compose up -d --wait
```

Nếu bản mới có thay đổi cấu trúc dữ liệu không tương thích ngược, phải khôi phục cả
MongoDB từ bản sao lưu chạy trước lúc deploy (mục 1.3) — chính vì vậy stage **Deploy
Production** trong `Jenkinsfile` chạy `deploy/backup-mongo.sh` trước.

### 3.5 Thứ tự khi có thay đổi cấu trúc dữ liệu

1. Sao lưu (mục 1.1).
2. Triển khai **backend trước**: `docker compose up -d --wait backend`.
3. Kiểm `docker compose ps` và log — backend phải `healthy`.
4. Triển khai frontend: `docker compose up -d --wait admin-web zalo-miniapp`.

Backend luôn phải tương thích ngược với frontend phiên bản cũ trong khoảng giữa bước 2
và bước 4.

---

## 4. Truy cập Mongo / RabbitMQ để chẩn đoán

Hai dịch vụ này **không lộ ra Internet** (`INFRA_BIND_IP=127.0.0.1`). Vào qua SSH
tunnel, **không** mở cổng:

```bash
ssh -L 27017:127.0.0.1:27017 -L 15672:127.0.0.1:15672 <user>@<máy-chủ>
```

> Sửa dữ liệu thật trực tiếp bằng `mongosh` mà không ghi vết và không sao lưu trước là
> vi phạm quy tắc bảo toàn dữ liệu của dự án. → `../.claude/rules/critical/bao-toan-du-lieu.md`

---

## 5. Xử lý sự cố

### 5.1 Bảng tra nhanh

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `backend` mãi không `healthy` | Sai `MONGO_URI` (thiếu `?authSource=admin`) hoặc sai mật khẩu | `docker compose logs backend`; đối chiếu `MONGO_URI` với `MONGO_ROOT_*` trong `.env` |
| Web Quản trị gọi API lỗi CORS/404 | `NEXT_PUBLIC_API_BASE_URL` trỏ tới `backend:3001` (tên nội bộ) thay vì domain public | Sửa `.env` rồi **build lại** image admin-web (mục 3.3) |
| Thao tác sửa báo "không kết nối", thao tác tạo vẫn chạy | Reverse proxy thiếu `PATCH` trong `Access-Control-Allow-Methods` | Xem mục 5.2 |
| Mini App báo "Không kết nối được máy chủ" | Bundle build thiếu `.env.local` ⇒ nhúng `localhost` | Xem mục 5.3 |
| Mini App trắng trang sau khi cập nhật | Trình duyệt còn cache `index.html` cũ trỏ tới assets đã xoá | Đã chặn bằng `Cache-Control: no-store` trong `zalo-miniapp/nginx.conf`; xoá cache trình duyệt nếu vẫn còn |
| Đầy đĩa | Image cũ tích tụ | `docker image prune -a -f --filter "until=168h"` |
| Tệp đính kèm mất sau khi cập nhật | Thiếu volume `uploads` hoặc `STORAGE_LOCAL_DIR` không trỏ vào `/app/uploads` | Kiểm `docker compose config` và `docker volume ls` |
| `docker compose up` báo biến chưa đặt | Thiếu `.env` | `cp .env.example .env` rồi điền giá trị |
| 502 hàng loạt, xuất hiện tức thì (không phải timeout) | Node đóng socket rảnh trong khi nginx còn giữ trong keepalive pool | Backend đã đặt `keepAliveTimeout` 65s; gateway phải khai `keepalive` kèm `proxy_set_header Connection ""` |

### 5.2 Reverse proxy nuốt `PATCH` (đã gặp thật)

**Triệu chứng:** trên Web Quản trị hoặc Mini App, thao tác **tạo** (POST) chạy bình
thường nhưng thao tác **sửa** (PATCH) báo "không kết nối được máy chủ" / "hệ thống
không phản hồi". Backend hoàn toàn khoẻ.

**Cơ chế:** trình duyệt gửi preflight `OPTIONS` trước mọi `PATCH`. Nếu gateway tự chèn
bộ header CORS dùng chung **đè lên** header đúng của backend, và bộ đó thiếu `PATCH`,
trình duyệt chặn ngay tại máy người dùng — request không bao giờ rời khỏi thiết bị.

**Chẩn đoán:**

```bash
# 1. Trình duyệt nhận được gì
curl -sI -X OPTIONS https://api-vigov.<tên-miền>/api/v1/health \
  -H 'Origin: https://h5.zdn.vn' \
  -H 'Access-Control-Request-Method: PATCH' | grep -i allow-methods

# 2. Backend có xử lý PATCH không (gọi thẳng, không qua trình duyệt)
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH \
  https://api-vigov.<tên-miền>/api/v1/feedback/citizen/mine/X \
  -H 'Content-Type: application/json' -d '{}'
```

Lệnh 1 thiếu `PATCH` **và** lệnh 2 trả `401` (không phải 404/405) ⇒ đúng lỗi này.

**Cách sửa** — danh sách việc phải làm đầy đủ ở **mục 7** cuối tài liệu này (đây là lỗi ĐANG hỏng trên gateway .151 thật). Tóm tắt hai hướng:

- **A (khuyến nghị)** — ngừng chèn CORS ở gateway cho vhost này, để backend tự trả.
  Backend đã khai đầy đủ `GET POST PATCH PUT DELETE OPTIONS` và whitelist origin gồm cả
  `https://h5.zdn.vn` (`security.middleware.ts`). Hai nơi cùng khai CORS chính là gốc
  của lỗi — bỏ một nơi thì hết cả lớp lỗi, không riêng `PATCH`.
- **B (tối thiểu)** — thêm `PATCH` vào `Access-Control-Allow-Methods` của gateway.

### 5.3 Mini App nhúng nhầm `localhost`

**Triệu chứng:** Mini App trên điện thoại báo "Không kết nối được máy chủ" ở mọi thao
tác, kể cả màn liên kết số điện thoại. Trên trình duyệt máy tính lại chạy bình thường.

**Nguyên nhân:** build thiếu `zalo-miniapp/.env.local` ⇒ Vite nhúng giá trị mặc định
`http://localhost:3001/api/v1` vào bundle. Trong webview Zalo, `localhost` là chính
chiếc điện thoại của người dân.

**Kiểm chứng:**

```bash
grep -o 'baseUrl:[a-zA-Z]*(`[^`]*`' zalo-miniapp/dist/assets/index-*.js
```

Thấy `void 0` hoặc `localhost` ở **đối số thứ nhất** là bundle hỏng. *(Chuỗi
`localhost` xuất hiện ở đối số thứ hai là bình thường — đó là giá trị dự phòng, luôn
có mặt kể cả ở bản build đúng.)*

**Cách sửa:** tạo lại `.env.local` rồi build lại. `npm run build` có chốt chặn tự dừng
khi gặp lỗi này → `08-ZALO-PHAT-HANH.md` mục 2.1.

---

## 6. Khi mô hình một máy chủ hết đúng

Thiết kế hiện tại giả định **quy mô một xã** (~10.000 dân, vài chục tài khoản cán bộ).
Phải thiết kế lại nếu chạm một trong các mốc sau:

| Dấu hiệu | Việc phải làm |
|---|---|
| Nhiều xã/phường dùng chung một hệ thống (**câu hỏi mở #13**) | Nhiều instance backend + load balancer ⇒ kéo theo Redis, và Mongo nên tách máy riêng có replica set |
| Yêu cầu SLA có tính sẵn sàng cao | Một máy chủ là một điểm chết duy nhất — hỏng máy là mất cả app lẫn dữ liệu. Cần replica set + máy dự phòng |
| Tệp đính kèm vượt ~150 GB | Chuyển `STORAGE_DRIVER` sang `s3` (MinIO hoặc object storage) — adapter đã có sẵn |
| Mongo chiếm > 60% RAM máy trong thời gian dài | Tách MongoDB sang máy riêng |

> Nâng cấp từ một-máy lên cụm là **làm lại phần triển khai**, không phải cắm thêm RAM.
> Nên chốt câu hỏi mở #13 với khách **trước khi** chốt cấu hình máy chủ.

### Vì sao chưa cài Redis

Mã nguồn hiện **không dùng Redis ở bất kỳ đâu** — chỉ có vài dòng chú thích dạng "khi
chạy nhiều instance thì chuyển sang Redis". Cài lúc này chỉ thêm một daemon không ai
gọi tới, thêm cổng phải chặn và thêm CVE phải theo dõi.

Redis trở thành **bắt buộc** khi backend chạy nhiều hơn một instance:

| Thành phần | Trạng thái hiện tại | Vỡ khi nhiều instance? |
|---|---|---|
| Kho OTP | Bộ nhớ tiến trình (hoặc Mongo nếu `OTP_STORE=mongo`) | **Có** với driver `memory`. OTP sinh ở instance A, xác thực ở B sẽ fail ⇒ công dân không đăng nhập được |
| Socket.IO | Không có adapter | **Có.** Broadcast không xuyên instance |
| Cache trạng thái phiên | TTL 10 giây, fallback về MongoDB | **Không.** Thu hồi phiên trễ tối đa 10s — chấp nhận được |

Tức là khi cần mở rộng, việc phải làm là **chuyển kho OTP và Socket.IO adapter sang
Redis**, không phải dựng sẵn Redis rồi để đấy.

---

## 7. VIỆC PHẢI LÀM TRÊN GATEWAY .151 — CORS thiếu `PATCH`

> **Trạng thái: ĐANG HỎNG TRÊN PRODUCTION.** Mọi thao tác **sửa** trên Web Quản
> trị và Zalo Mini App đều thất bại. Thao tác **tạo** và **xem** vẫn bình thường,
> nên lỗi dễ bị bỏ qua cho tới khi có cán bộ hoặc người dân báo.
>
> Sửa nằm **trên máy gateway `.151`**, không nằm trong mã nguồn ViGov. Đội phát
> triển không có quyền truy cập máy này.

### 7.1 Triệu chứng

| Nơi | Biểu hiện |
|---|---|
| Zalo Mini App | Người dân mở phiếu phản ánh của mình, bấm "Cập nhật nội dung" → báo "hệ thống không phản hồi". Nhưng bấm "Thu hồi" thì chạy bình thường |
| Web Quản trị | Mọi nút Lưu / Cập nhật / Duyệt / Gỡ bài đều báo lỗi kết nối. Nút Tạo mới vẫn chạy |

Dấu hiệu nhận ra ngay: **tạo được nhưng sửa không được**. Tạo dùng `POST`
(nằm trong danh sách được phép), sửa dùng `PATCH` (không nằm trong).

### 7.2 Nguyên nhân — đã kiểm chứng trên máy thật

Gateway `.151` là **gateway production dùng chung với dự án khác**. Nó tự chèn
một bộ header CORS chung cho mọi vhost, và bộ đó **thiếu `PATCH`**:

```
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

Trình duyệt gửi preflight `OPTIONS` trước mọi `PATCH`. Không thấy `PATCH` trong
danh sách, nó **chặn request ngay tại máy người dùng** — request không bao giờ
rời khỏi thiết bị, backend không hề biết có ai gọi.

Ba bằng chứng thu được bằng `curl` trên hệ thống thật:

```bash
# 1. Backend XỬ LÝ ĐƯỢC PATCH — trả 401 đúng nghĩa (chưa xác thực),
#    không phải 404 hay 405 ⇒ route tồn tại, phương thức được chấp nhận
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH \
  https://api-vigov.omicrm.com/api/v1/feedback/citizen/mine/X \
  -H 'Content-Type: application/json' -d '{}'
# → 401

# 2. Nhưng trình duyệt lại nhận danh sách THIẾU PATCH
curl -sI -X OPTIONS https://api-vigov.omicrm.com/api/v1/health \
  -H 'Origin: https://h5.zdn.vn' \
  -H 'Access-Control-Request-Method: PATCH' | grep -i allow-methods
# → Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS

# 3. Gateway CHẶN ĐỨNG OPTIONS, không chuyển xuống backend:
#    đường dẫn không tồn tại vẫn trả 204 (nếu xuống backend phải là 404)
curl -sI -X OPTIONS https://api-vigov.omicrm.com/api/v1/khong-he-ton-tai-xyz \
  -H 'Origin: https://h5.zdn.vn' -H 'Access-Control-Request-Method: PATCH' \
  | head -1
# → HTTP/1.1 204 No Content     (GET cùng đường dẫn → 404)
```

Đối chiếu với những gì backend **thực sự khai**
(`backend/apps/api-gateway/src/security.middleware.ts`):

| Header | Backend khai | Trình duyệt nhận | |
|---|---|---|---|
| `Allow-Methods` | GET POST **PATCH** PUT DELETE OPTIONS | GET POST PUT DELETE OPTIONS | ❌ mất PATCH |
| `Allow-Headers` | 4 header | 18 header | ❌ khác hẳn |
| `Allow-Credentials` | *không gửi* (`credentials: false`) | `true` | ❌ backend không bao giờ gửi dòng này |

Dòng `Access-Control-Allow-Credentials: true` là bằng chứng dứt điểm: backend
đặt `credentials: false` nên **không bao giờ** phát header đó. Nó chỉ có thể
đến từ gateway.

### 7.3 Vì sao chỉ gỡ `add_header` là CHƯA ĐỦ

Bằng chứng số 3 ở trên cho thấy gateway **tự trả lời `OPTIONS`** thay vì chuyển
xuống backend — nhiều khả năng bằng một khối kiểu:

```nginx
if ($request_method = OPTIONS) {
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    ...
    return 204;
}
```

Chừng nào khối này còn, backend **không bao giờ nhận được** preflight, nên header
đúng của backend không có cơ hội đi ra. Phải xử lý **cả hai**: bỏ chèn header
**và** thôi chặn `OPTIONS` cho riêng vhost `api-vigov.omicrm.com`.

### 7.4 Việc phải làm — theo thứ tự

Người thực hiện: **quản trị viên máy `.151`**. Thời gian: ~15 phút. Không cần
dừng dịch vụ.

- [ ] **B1. Tìm chỗ gateway chèn CORS.** Nó nằm ngoài tệp của ViGov:

      grep -rn "Access-Control-Allow-Methods" /etc/nginx/
      grep -rn "request_method = OPTIONS" /etc/nginx/

      Ghi lại: tệp nào, ở tầng `http{}`, `server{}` hay một `include` dùng chung.

- [ ] **B2. Sao lưu trước khi sửa.**

      sudo cp -a /etc/nginx /etc/nginx.bak.$(date +%F-%H%M)

- [ ] **B3. Chọn cách sửa** — xem mục 7.5. Khuyến nghị **Cách A**.

- [ ] **B4. Kiểm cú pháp — BẮT BUỘC trước khi reload.**

      sudo nginx -t

      Chưa `OK` thì **dừng lại**, khôi phục từ bản sao lưu. Đây là gateway của
      dự án khác: một lỗi cú pháp làm `reload` thất bại và ảnh hưởng cả các
      dịch vụ đang chạy trên máy.

- [ ] **B5. Nạp lại cấu hình** (không `restart`, `reload` không rớt kết nối):

      sudo systemctl reload nginx

- [ ] **B6. Kiểm chứng** — xem mục 7.6. Phải thấy `PATCH`.

- [ ] **B7. Xác nhận trên giao diện thật:** mở Web Quản trị sửa một bản ghi bất
      kỳ, và mở Mini App cập nhật nội dung một phiếu phản ánh chưa ai tiếp nhận.

- [ ] **B8. Kiểm không ảnh hưởng dự án khác** trên cùng gateway: mở thử một
      vhost khác, xem `error_log` vài phút đầu.

      sudo tail -f /var/log/nginx/error.log

### 7.5 Hai cách sửa

#### Cách A — để backend tự trả CORS (KHUYẾN NGHỊ)

Áp dụng cho **riêng** vhost `api-vigov.omicrm.com`, không đụng dự án khác.

Backend đã khai đầy đủ và đúng: `GET POST PATCH PUT DELETE OPTIONS`, origin lấy
từ `CORS_ORIGINS` (gồm cả `https://h5.zdn.vn` cho Zalo Mini App). Hai nơi cùng
khai CORS chính là gốc của lỗi — bỏ một nơi thì hết **cả lớp lỗi**, không riêng
`PATCH`.

Hai việc phải làm cùng lúc:

1. **Ngừng chèn header.** Nếu gateway chèn bằng `add_header` ở tầng dùng chung:
   nginx có quy tắc là **khai bất kỳ `add_header` nào trong một block sẽ huỷ
   toàn bộ `add_header` kế thừa từ tầng trên**. Nên chỉ cần thêm một dòng vô
   hại vào server block của ViGov:

   ```nginx
   # Huỷ mọi add_header kế thừa từ tầng http/server dùng chung, để header CORS
   # của backend đi thẳng tới trình duyệt. Không có dòng này, gateway ghi đè
   # bằng bộ header thiếu PATCH.
   add_header X-Vigov-Cors "backend" always;
   ```

   *(Dòng này đã có sẵn dạng chú thích trong `deploy/gateway-151-vigov.conf`,
   chỉ cần bỏ dấu `#`.)*

2. **Thôi chặn `OPTIONS`.** Nếu snippet dùng chung có `if ($request_method =
   OPTIONS) { ... return 204; }`, phải **loại vhost ViGov ra khỏi snippet đó** —
   ví dụ chuyển `include` từ tầng `http{}` xuống từng server block của các dự án
   khác, hoặc bọc điều kiện theo `$host`. Cách làm cụ thể phụ thuộc cấu hình
   hiện có của máy, nên B1 mới là bước bắt buộc trước.

#### Cách B — thêm `PATCH` vào danh sách của gateway (tối thiểu)

Sửa đúng một chỗ trong cấu hình dùng chung:

```nginx
add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
```

Nhanh hơn, nhưng:

- Vẫn để nguyên cái bẫy hai-nơi-khai-CORS cho lần sau.
- Ảnh hưởng **mọi** dự án trên gateway (thêm `PATCH` cho tất cả) — phải hỏi ý
  kiến chủ quản các dự án kia.
- Không giải quyết lệch `Allow-Headers` (backend khai 4, gateway trả 18) và
  `Allow-Credentials: true` sai lệch.

> Chọn Cách B khi cần chữa cháy gấp; vẫn nên lên lịch làm Cách A sau.

### 7.6 Kiểm chứng sau khi sửa

```bash
# 1. Preflight PATCH từ Zalo Mini App — PHẢI thấy PATCH
curl -sI -X OPTIONS https://api-vigov.omicrm.com/api/v1/health \
  -H 'Origin: https://h5.zdn.vn' \
  -H 'Access-Control-Request-Method: PATCH' | grep -i allow-methods

# 2. Preflight PATCH từ Web Quản trị — PHẢI thấy PATCH
curl -sI -X OPTIONS https://api-vigov.omicrm.com/api/v1/content/videos \
  -H 'Origin: https://admin-vigov.omicrm.com' \
  -H 'Access-Control-Request-Method: PATCH' | grep -i allow-methods

# 3. Nếu chọn Cách A: OPTIONS tới đường dẫn không tồn tại phải trả 404
#    (đi xuống backend), không còn là 204 chặn tại gateway
curl -sI -X OPTIONS https://api-vigov.omicrm.com/api/v1/khong-he-ton-tai-xyz \
  -H 'Origin: https://h5.zdn.vn' -H 'Access-Control-Request-Method: PATCH' | head -1

# 4. Origin lạ PHẢI bị từ chối — không được vô tình mở CORS cho mọi nguồn
curl -sI -X OPTIONS https://api-vigov.omicrm.com/api/v1/health \
  -H 'Origin: https://ke-tan-cong.example' \
  -H 'Access-Control-Request-Method: PATCH' | grep -i allow-origin
# → KHÔNG được có dòng Allow-Origin, hoặc không phải origin vừa gửi
```

Kiểm số 4 là bắt buộc: sửa CORS mà nới quá tay thành `*` là mở đường cho trang
web bất kỳ gọi API nhân danh người dùng đang đăng nhập.

### 7.7 Rút kinh nghiệm

Lỗi này tồn tại được vì **không ai kiểm preflight `PATCH` sau khi dựng gateway**.
Nay đã đưa vào hai chỗ:

- `docs/07-UAT-VA-NGHIEM-THU.md` — kiểm CORS trong danh mục nghiệm thu.
- `docs/05-TRIEN-KHAI-K8S.md` mục 4.3 — cảnh báo cạm bẫy y hệt lặp lại trên
  Ingress nếu bật annotation `enable-cors`.

Về lâu dài, ViGov sẽ chuyển sang VPS + nginx riêng (`docs/04-TRIEN-KHAI-VPS.md`),
lúc đó không còn dùng chung gateway với dự án khác và cả lớp lỗi này biến mất.

---
