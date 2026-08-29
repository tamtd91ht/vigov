# ViGov — Hướng dẫn triển khai (P4-34 · WBS #34–35)

Tài liệu vận hành cho hệ thống ViGov gồm 4 thành phần: **backend** (NestJS),
**admin-web** (Next.js), **zalo-miniapp** (Vite + nginx) và **mobile** (Flutter —
phát hành qua CH Play/App Store, không nằm trong compose).

Toàn bộ hạ tầng dựng bằng `docker-compose.yml` ở thư mục gốc dự án.

| File | Vai trò |
|---|---|
| `docker-compose.yml` | Dựng toàn hệ: mongo, rabbitmq, backend, admin-web, zalo-miniapp |
| `.env.example` | Danh sách đầy đủ biến môi trường — sao chép thành `.env` |
| `Jenkinsfile` | Pipeline CI/CD (Jenkins) |
| `.github/workflows/ci.yml` | CI tương đương cho GitHub Actions |
| `deploy/backup-mongo.sh` | Sao lưu MongoDB bằng `mongodump` |
| `deploy/RELEASE.md` | Phát hành app công dân lên 3 store (P4-37) |
| `deploy/UAT.md` | Kế hoạch kiểm thử hồi quy & UAT trên staging (P4-38) |

---

## 1. Yêu cầu hạ tầng tối thiểu

### 1.1 Staging (1 máy chủ, dùng cho UAT — task P4-38)

| Hạng mục | Tối thiểu | Ghi chú |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU nếu chạy cả CI runner trên cùng máy |
| RAM | 4 GB | Mongo ~1 GB · RabbitMQ ~0.5 GB · 3 container Node ~1.5 GB |
| Đĩa | 40 GB SSD | Hệ điều hành 10 GB · image Docker 10 GB · dữ liệu + log 20 GB |
| Hệ điều hành | Ubuntu Server 22.04/24.04 LTS | Hoặc RHEL/Rocky 9 |
| Phần mềm | Docker Engine ≥ 24, Docker Compose plugin v2 ≥ 2.22 | `--wait` khi deploy cần v2.22+ |
| Mạng | 1 domain phụ + chứng thư TLS | Ví dụ `staging.vigov.<tên-xã>.gov.vn` |

### 1.2 Production (1 máy chủ — quy mô 1 xã)

| Hạng mục | Tối thiểu | Khuyến nghị | Ghi chú |
|---|---|---|---|
| CPU | 4 vCPU | 8 vCPU | Xuất báo cáo Excel (P3-27) và OCR (P3-25) là 2 tác vụ ngốn CPU nhất |
| RAM | 8 GB | 16 GB | Ghìm cache Mongo bằng `MONGO_CACHE_GB` ≈ 1/4 RAM — xem mục 1.4 |
| Đĩa | 100 GB SSD | 250 GB SSD | Tệp đính kèm phản ánh (ảnh) tăng nhanh nhất — xem ước tính bên dưới |
| Đĩa sao lưu | 100 GB | Ổ/NAS **riêng** hoặc object storage | Không để chung ổ với dữ liệu gốc |
| Băng thông | 50 Mbps | 100 Mbps | Mini app tải ảnh phản ánh từ điện thoại lên |
| Hệ điều hành | Ubuntu Server 22.04/24.04 LTS | | Bật `unattended-upgrades` cho bản vá bảo mật |
| Chứng thư | TLS hợp lệ | | Let's Encrypt (cloud) hoặc CA nội bộ/Ban Cơ yếu (on-premise) |

**Ước tính dung lượng** (1 xã, ~10.000 dân):

- Phản ánh: ~30 phiếu/ngày × 3 ảnh × 1,5 MB ≈ **135 MB/ngày ≈ 50 GB/năm** → đây là
  yếu tố quyết định dung lượng đĩa.
- Văn bản điện tử: ~50 văn bản/ngày × 2 MB ≈ 36 GB/năm.
- Bản ghi MongoDB (không kể tệp): < 5 GB/năm.

> Khi vượt ~150 GB tệp, chuyển `STORAGE_DRIVER=local` sang `s3` (MinIO on-premise
> hoặc object storage của nhà cung cấp) — backend đã có sẵn adapter (P3-24),
> chỉ cần đổi biến môi trường `S3_*`.

### 1.3 Reverse proxy (bắt buộc ở production)

Compose **chỉ mở cổng trên `127.0.0.1`** (biến `PUBLIC_BIND_IP`). Phần lộ ra
Internet do một reverse proxy trên chính máy chủ đảm nhiệm — nginx hoặc Caddy —
với nhiệm vụ: kết thúc TLS, ép HTTP→HTTPS, gắn header bảo mật, giới hạn kích
thước upload.

| Domain | Trỏ tới |
|---|---|
| `admin.vigov.<xã>.gov.vn` | `127.0.0.1:${ADMIN_WEB_PORT}` (3000) |
| `api.vigov.<xã>.gov.vn` | `127.0.0.1:${BACKEND_PORT}` (3001) |
| `app.vigov.<xã>.gov.vn` | `127.0.0.1:${ZALO_MINIAPP_PORT}` (8080) |

> `NEXT_PUBLIC_API_BASE_URL` và `VITE_API_BASE_URL` phải là **domain public của
> API** (`https://api.vigov.…/api/v1`), không phải tên service nội bộ `backend` —
> vì trình duyệt/điện thoại của người dùng mới là bên gọi.

### 1.4 Kiến trúc all-in-one — cái gì chạy ở đâu

Toàn hệ chạy trên **một máy chủ duy nhất**, mọi thành phần là container trong cùng
`docker-compose.yml`. Không phụ thuộc bất kỳ dịch vụ nào bên ngoài máy đó.

```
┌─ Máy chủ khách hàng cấp ───────────────────────────────────┐
│                                                             │
│  nginx / Caddy  (trên host, không nằm trong compose)        │
│  :80 → :443  ← thứ DUY NHẤT lộ ra Internet                  │
│    ├─ admin.vigov.<xã>… → 127.0.0.1:3000  admin-web         │
│    ├─ api.vigov.<xã>…   → 127.0.0.1:3001  backend           │
│    └─ app.vigov.<xã>…   → 127.0.0.1:8080  zalo-miniapp      │
│                                                             │
│  ┌─ mạng nội bộ Docker: vigov-net ────────────────────────┐ │
│  │  backend      1 instance, NestJS api-gateway           │ │
│  │  admin-web    Next.js standalone                       │ │
│  │  zalo-miniapp tĩnh, phục vụ bởi nginx trong container  │ │
│  │  mongo        volume mongo-data      ← bind 127.0.0.1  │ │
│  │  rabbitmq     volume rabbitmq-data   ← bind 127.0.0.1  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  volume uploads/  ← tệp đính kèm phản ánh, bản scan văn bản │
└─────────────────────────────────────────────────────────────┘
         │ mongodump 02:00 + rsync 03:00
         ▼
   Máy/NAS/object storage KHÁC   ← BẮT BUỘC, xem mục 4
```

| Thành phần | Chạy ở đâu | Cổng | Lộ ra Internet? |
|---|---|---|---|
| `backend` | container | 3001 | Qua reverse proxy |
| `admin-web` | container | 3000 | Qua reverse proxy |
| `zalo-miniapp` | container | 8080 | Qua reverse proxy |
| `mongo` | container, volume `mongo-data` | 27017 | **Không** — `INFRA_BIND_IP=127.0.0.1` |
| `rabbitmq` | container, volume `rabbitmq-data` | 5672 / 15672 | **Không** — như trên |
| Redis | *không cài* | — | — |

**Vì sao là container chứ không `apt install mongodb-org`:** `docker-compose.yml`
đã định nghĩa sẵn healthcheck, volume, xoay log và thứ tự khởi động cho cả hai.
Cài tay lên host là bỏ đi phần đó và tạo sai lệch giữa máy dev và máy chủ thật.
Nâng phiên bản Mongo cũng chỉ còn là đổi biến `MONGO_IMAGE`.

**Truy cập Mongo/RabbitMQ từ xa để debug:** đi qua SSH tunnel, không mở cổng.

```bash
ssh -L 27017:127.0.0.1:27017 -L 15672:127.0.0.1:15672 <user>@<máy-chủ>
```

#### Vì sao KHÔNG cài Redis

Mã nguồn hiện **không dùng Redis ở bất kỳ đâu**. Rà toàn repo chỉ thấy 3 dòng chú
thích dạng "khi chạy nhiều instance thì chuyển sang Redis"
(`auth.service.ts:44`, `libs/shared/src/auth/session-registry.ts:11`,
`plans/p5-08-token-revocation.md:13`). Không có client, không có module, không có
biến môi trường. Cài Redis lúc này chỉ thêm một daemon không ai gọi tới, thêm cổng
phải chặn và thêm CVE phải theo dõi.

Redis chỉ trở thành **bắt buộc** khi backend chạy nhiều hơn một instance sau load
balancer. Khi đó ba chỗ sau mới là vấn đề:

| Thành phần | Trạng thái hiện tại | Vỡ khi nhiều instance? |
|---|---|---|
| Kho OTP — `Map` trong `AuthService` | Bộ nhớ tiến trình | **Có.** OTP sinh ở instance A, xác thực ở B sẽ fail ⇒ công dân không đăng nhập được |
| Socket.IO — `realtime.gateway.ts` | Không có adapter | **Có.** Broadcast không xuyên instance |
| Cache trạng thái phiên — `session-registry.ts` | TTL 10 giây, fallback về MongoDB | **Không.** Mỗi instance tự cache; thu hồi phiên trễ tối đa 10s — chấp nhận được |

Tức là khi nào cần mở rộng, việc phải làm là **chuyển kho OTP và Socket.IO adapter
sang Redis**, chứ không phải dựng sẵn Redis rồi để đấy.

#### Ngân sách RAM khi nhốt chung một máy (mốc 8 GB)

| Thành phần | Ước tính |
|---|---|
| MongoDB (cache WiredTiger ghìm ở 2 GB) | ~2,5 GB |
| RabbitMQ | ~0,5 GB |
| backend (Node) | ~0,5 GB |
| admin-web (Next.js) | ~0,5 GB |
| zalo-miniapp (nginx tĩnh) + reverse proxy | ~0,1 GB |
| Hệ điều hành + Docker daemon | ~0,8 GB |
| **Còn lại** | **~3 GB đệm** |

> **Bẫy hay gặp nhất của mô hình all-in-one:** mặc định MongoDB lấy cache bằng
> ~50% (RAM − 1 GB) — trên máy 8 GB là ~3,5 GB. Cộng với Node và Next.js là vừa đủ
> để OOM killer bắn tiến trình backend vào lúc tải cao nhất. Vì vậy
> `docker-compose.yml` truyền `--wiredTigerCacheSizeGB ${MONGO_CACHE_GB}`, mặc định
> `2`. **Quy tắc: đặt khoảng 1/4 RAM máy chủ** — máy 8 GB → `2`, máy 16 GB → `4`.

#### Khi nào mô hình này hết đúng

Thiết kế trên giả định **quy mô một xã** (~10.000 dân, vài chục tài khoản cán bộ).
Phải thiết kế lại nếu chạm một trong các mốc sau:

| Dấu hiệu | Việc phải làm |
|---|---|
| Nhiều xã/phường dùng chung một hệ thống (**câu hỏi mở #13** trong `ESTIMATE_TECHNICAL.md`) | Nhiều instance backend + load balancer ⇒ kéo theo Redis, và Mongo nên tách máy riêng có replica set |
| Yêu cầu SLA có tính sẵn sàng cao | Một máy chủ là một điểm chết duy nhất — hỏng máy là mất cả app lẫn dữ liệu. Cần replica set + máy dự phòng |
| Tệp đính kèm vượt ~150 GB | Chuyển `STORAGE_DRIVER` sang `s3` (MinIO hoặc object storage) — adapter đã có sẵn từ P3-24 |
| Mongo chiếm > 60% RAM máy trong thời gian dài | Tách MongoDB sang máy riêng |

> Nâng cấp từ một-máy lên cụm là **làm lại phần triển khai**, không phải cắm thêm
> RAM. Vì vậy nên chốt câu hỏi mở #13 với khách **trước khi** chốt cấu hình máy chủ.

---

## 2. Thứ tự khởi chạy

### 2.1 Chuẩn bị lần đầu

```bash
# 1. Lấy mã nguồn về máy chủ.
#    Đặt ở ổ dữ liệu, KHÔNG đặt trong /root (0750, service user thường không đọc được).
#    Chạy `df -h` chọn phân vùng còn chỗ: thường /opt, hoặc /u01 nếu máy đã có ổ riêng.
git clone <repo-url> /opt/vigov && cd /opt/vigov

# 2. Tạo file cấu hình từ mẫu và điền giá trị thật
cp .env.example .env
chmod 600 .env                 # chỉ user triển khai đọc được
vi .env                        # đổi TOÀN BỘ giá trị "change-me-..."

# Sinh JWT_SECRET đủ mạnh:
openssl rand -base64 48

# 3. Kiểm tra cú pháp + giá trị sau khi nội suy biến
docker compose config

# 4. Build 3 image ứng dụng (hoặc bỏ qua nếu CI đã push lên registry)
docker compose build
```

### 2.2 Khởi chạy

```bash
docker compose up -d --wait
docker compose ps              # tất cả phải ở trạng thái (healthy)
```

Thứ tự phụ thuộc đã được khai báo bằng `depends_on: condition: service_healthy`,
Docker tự đảm bảo — **không cần khởi chạy thủ công từng bước**:

```
mongo (healthy)  ─┐
                  ├─→ backend (healthy) ─┬─→ admin-web
rabbitmq (healthy)┘                      └─→ zalo-miniapp
```

Vì sao phải chờ *healthy* chứ không chỉ *started*: MongoDB mất 10–30 giây để nạp
xong dữ liệu và mở cổng nhận lệnh. Nếu backend khởi động sớm hơn, Mongoose sẽ
retry và ghi hàng loạt lỗi kết nối vào log, còn HEALTHCHECK của backend sẽ đỏ.

### 2.3 Kiểm tra sau khi lên

```bash
# Backend: endpoint công khai (cũng chính là endpoint dùng cho HEALTHCHECK)
curl -i http://127.0.0.1:3001/api/v1/health/ready

# Mini app tĩnh
curl -i http://127.0.0.1:8080/healthz

# Web quản trị
curl -I http://127.0.0.1:3000/

# Log 5 phút gần nhất của backend
docker compose logs --since 5m backend
```

---

## 3. Seed dữ liệu lần đầu

Seed tạo **9 tài khoản cán bộ mẫu** và **bảng SLA mặc định cho 8 lĩnh vực**
(nguồn: `backend/apps/api-gateway/src/seed.ts`).

```bash
# Đặt mật khẩu khởi tạo TRƯỚC khi seed (trong .env)
#   SEED_DEFAULT_PASSWORD=<mật khẩu mạnh, dùng một lần>

# Chạy seed trong một container tạm, dùng cùng image và cùng biến môi trường
docker compose run --rm --no-deps backend node dist/apps/api-gateway/apps/api-gateway/src/seed
```

> `--rm` xoá container ngay sau khi chạy xong; `--no-deps` tránh khởi động lại
> mongo/rabbitmq (chúng đã chạy sẵn ở bước 2.2).
>
> Ảnh Docker của backend **không có `ts-node`** (đã loại devDependencies), nên
> `npm run seed` sẽ lỗi. Dùng đúng lệnh `node dist/apps/api-gateway/apps/api-gateway/src/seed` ở trên —
> Dockerfile đã sinh sẵn file cầu nối này lúc build.

**Bắt buộc sau khi seed ở production:**

1. Đăng nhập bằng tài khoản `binh.nv` (vai trò admin).
2. Đổi ngay mật khẩu của **tất cả** tài khoản được seed.
3. Xoá các tài khoản mẫu không dùng đến, tạo tài khoản theo danh sách cán bộ thật.
4. Xoá `SEED_DEFAULT_PASSWORD` khỏi `.env`.

Seed là **idempotent** (upsert theo `username` / `categoryKey`) nên chạy lại
không tạo bản ghi trùng — nhưng cũng không ghi đè mật khẩu đã đổi.

---

## 4. Sao lưu MongoDB

### 4.1 Sao lưu thủ công

```bash
cd /opt/vigov
bash deploy/backup-mongo.sh
# → ./backups/vigov-vigov-20260828-020000.archive.gz
```

Script chạy `mongodump --archive --gzip` **bên trong container mongo** (không cần
cài mongo-tools trên host), ghi ra thư mục `${BACKUP_DIR}` đã bind-mount, rồi tự
xoá bản cũ hơn `RETENTION_DAYS` (mặc định 14 ngày).

### 4.2 Đặt lịch tự động (cron)

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

### 4.3 Khôi phục

```bash
# Đưa file archive vào thư mục backups rồi:
docker compose exec -T mongo sh -c 'mongorestore \
    --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --archive=/backups/vigov-vigov-20260828-020000.archive.gz \
    --gzip --drop'
```

`--drop` xoá collection cũ trước khi nạp lại. **Luôn diễn tập khôi phục trên
staging trước** — một bản sao lưu chưa từng được khôi phục thử thì chưa thể coi
là bản sao lưu.

### 4.4 Đừng quên tệp đính kèm

`mongodump` **không** bao gồm ảnh/tệp trong volume `uploads`. Sao lưu riêng:

```bash
docker run --rm \
  -v vigov_uploads:/data:ro \
  -v /opt/vigov/backups:/backup \
  alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

*(Tên volume có tiền tố `COMPOSE_PROJECT_NAME`; kiểm tra bằng `docker volume ls`.)*

---

## 5. Xoay log

Có **ba tầng log**, mỗi tầng cần một cơ chế riêng:

### 5.1 Log ứng dụng (stdout của container)

Đã cấu hình sẵn trong `docker-compose.yml` qua khối `x-logging`:

```yaml
driver: json-file
options:
  max-size: "10m"   # mỗi file tối đa 10 MB
  max-file: "5"     # giữ 5 file → tối đa 50 MB/service
```

Trần cứng: 5 service × 50 MB = **250 MB**. Không có cấu hình này, thư mục
`/var/lib/docker/containers` sẽ phình đến đầy đĩa và làm sập cả máy chủ.

Nên đặt luôn mức mặc định cho toàn máy trong `/etc/docker/daemon.json`, để mọi
container ngoài compose (CI runner, container tạm) cũng bị giới hạn:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" }
}
```

```bash
sudo systemctl restart docker   # áp dụng — container đang chạy sẽ được tạo lại
```

### 5.2 Log nginx của mini app

Ghi vào `/var/log/nginx` **bên trong container**, và trong ảnh `nginx:alpine`
hai file này là symlink tới `/dev/stdout` và `/dev/stderr` ⇒ chảy về Docker và
được xoay theo mục 5.1. Không cần logrotate riêng.

### 5.3 Log reverse proxy và log sao lưu (trên host)

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

### 5.4 Nhật ký kiểm toán — KHÔNG được xoay

Nhật ký thao tác của cán bộ (P3-29) lưu trong MongoDB, **không** phải log hệ
thống. Đây là dữ liệu nghiệp vụ, thuộc diện phải lưu trữ theo quy định về lưu
trữ hồ sơ điện tử — chỉ được xoá theo chính sách lưu trữ của đơn vị, và phải nằm
trong phạm vi sao lưu ở mục 4.

---

## 6. Cập nhật phiên bản (rolling)

### 6.1 Cách hoạt động

Mỗi image được gắn tag bất biến theo commit: `<branch>-<sha7>` (ví dụ
`main-a1b2c3d`). Việc cập nhật chỉ là **đổi `IMAGE_TAG` trong `.env` rồi `up`**:

```bash
cd /opt/vigov
cp .env .env.bak.$(date +%Y%m%d%H%M%S)        # để rollback
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=main-a1b2c3d|' .env
docker compose pull
docker compose up -d --remove-orphans --wait --wait-timeout 180
docker compose ps
```

Compose so sánh cấu hình từng service và **chỉ tạo lại container nào thực sự
thay đổi**. Mongo và RabbitMQ giữ nguyên (không đổi image, không đổi env) nên
không bị khởi động lại — dữ liệu và kết nối hàng đợi không gián đoạn.

Gián đoạn thực tế: mỗi service ứng dụng ngừng **khoảng 5–15 giây**. Với quy mô
một xã, cửa sổ này chấp nhận được — nên thực hiện ngoài giờ hành chính.

### 6.2 Rolling thật sự (không gián đoạn)

Nếu khách yêu cầu zero-downtime, cần chạy **2 bản sao backend sau một load
balancer**. Compose đơn máy không làm được điều này một cách gọn gàng; phương án:

- **Docker Swarm** — `docker stack deploy` với `update_config: order: start-first`.
  Chi phí thêm: ~1 ngày cấu hình, dùng lại gần như nguyên `docker-compose.yml`.
- **Kubernetes** — RollingUpdate sẵn có, nhưng đắt về vận hành với quy mô 1 xã.

Khuyến nghị: giữ compose đơn máy cho giai đoạn 1; chỉ chuyển khi triển khai
đa xã/đa tenant.

### 6.3 Lưu ý bắt buộc với admin-web và zalo-miniapp

Biến `NEXT_PUBLIC_*` và `VITE_*` được **nhúng vào bundle JavaScript lúc build**,
không đọc lại lúc chạy. Do đó:

> Đổi các biến này trong `.env` rồi `docker compose up -d` là **KHÔNG có tác
> dụng**. Bắt buộc `docker compose build admin-web zalo-miniapp` (hoặc build lại
> trên CI) rồi mới triển khai.

Hệ quả: staging và production dùng **hai image khác nhau**, không thể "thăng
hạng" nguyên xi image từ staging lên production. Pipeline đã build riêng cho
từng nhánh (`develop` → staging, `main` → production).

### 6.4 Rollback

```bash
cd /opt/vigov
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=<tag-cũ>|' .env    # hoặc khôi phục .env.bak.*
docker compose up -d --wait
```

Nếu bản mới có thay đổi cấu trúc dữ liệu không tương thích ngược, phải khôi phục
cả MongoDB từ bản sao lưu chạy trước lúc deploy (mục 4.3) — chính vì vậy stage
**Deploy Production** trong `Jenkinsfile` chạy `deploy/backup-mongo.sh` trước.

### 6.5 Thứ tự khi có thay đổi cấu trúc dữ liệu

1. Sao lưu (mục 4.1).
2. Triển khai **backend trước**: `docker compose up -d --wait backend`.
3. Kiểm tra `docker compose ps` và log — backend phải `healthy`.
4. Triển khai frontend: `docker compose up -d --wait admin-web zalo-miniapp`.

Backend luôn phải tương thích ngược với frontend phiên bản cũ trong khoảng thời
gian giữa bước 2 và bước 4.

---

## 7. Câu hỏi mở #6 — Cloud hay on-premise/hạ tầng nhà nước?

> **Đã chốt (29/08/2026): triển khai all-in-one trên một máy chủ do khách hàng
> cấp.** Mọi thành phần — kể cả MongoDB và RabbitMQ — chạy bằng container trong
> cùng `docker-compose.yml` trên chính máy đó; không dùng dịch vụ managed bên
> ngoài, không cài Redis. Chi tiết kiến trúc ở **mục 1.4**.
>
> Lý do không chọn managed service (MongoDB Atlas, CloudAMQP): dữ liệu phản ánh
> của công dân là dữ liệu cá nhân thuộc phạm vi **Nghị định 13/2023/NĐ-CP**, lại
> thuộc hệ thống của cơ quan nhà nước. Nhà cung cấp đặt máy chủ ngoài Việt Nam sẽ
> thành vấn đề pháp lý phải giải trình. Managed nội địa (Viettel Cloud, VNPT, FPT,
> CMC, Bizfly) thì hợp lệ nhưng đắt hơn và thêm một vòng mua sắm — chưa đáng cho
> Phase 1 quy mô một xã.
>
> Phần so sánh bên dưới giữ lại để làm hồ sơ quyết định, và vẫn cần dùng khi khách
> chốt máy chủ nằm ở cloud hay ở trung tâm dữ liệu tỉnh — điều này **chưa chốt** và
> vẫn ảnh hưởng tới khối lượng DevOps.

### 7.1 So sánh

| Tiêu chí | Cloud (VNG Cloud, Viettel IDC, FPT Cloud, AWS/GCP) | On-premise / hạ tầng nhà nước (Trung tâm dữ liệu tỉnh, mạng chuyên dùng) |
|---|---|---|
| Thời gian có máy | Vài giờ | 1–4 tuần (thủ tục cấp phát, cấp quyền) |
| TLS | Let's Encrypt tự động | CA nội bộ hoặc chứng thư số Ban Cơ yếu Chính phủ — xin cấp thủ công |
| Sao lưu ngoài site | Object storage sẵn có | Phải tự chuẩn bị NAS/băng từ + quy trình |
| Giám sát | Dịch vụ sẵn của nhà cung cấp | Tự dựng (Prometheus + Grafana / Zabbix) |
| Truy cập từ Internet | Mặc định có | Thường phải qua NAT/firewall do đơn vị CNTT tỉnh cấu hình |
| Tuân thủ Nghị định 53/2022 (dữ liệu cư trú) | Cần chọn nhà cung cấp đặt máy chủ tại VN | Đáp ứng sẵn |
| Chi phí | Thuê theo tháng | Đầu tư ban đầu, khách thường đã có sẵn |

### 7.2 Ảnh hưởng tới ước lượng

Ước lượng P4-34 hiện **giả định phương án cloud** (hoặc một máy chủ Linux đã có
sẵn Docker, có Internet, có quyền root).

> **Nếu chọn on-premise / hạ tầng nhà nước: cộng thêm 1–2 ngày công DevOps.**

Phần việc phát sinh:

- Khảo sát hạ tầng sẵn có, xin cấp máy ảo/quyền truy cập, mở luồng firewall.
- Cấu hình mạng: NAT, DNS nội bộ, proxy đi ra (nhiều mạng chuyên dùng chặn
  Internet ⇒ phải dựng **registry Docker nội bộ** và mirror npm/pub, vì
  `npm ci`, `flutter pub get`, `docker pull` đều cần tải từ ngoài).
- Xin và cài chứng thư số nội bộ/Ban Cơ yếu thay cho Let's Encrypt.
- Dựng cơ chế sao lưu ngoài site và giám sát cơ bản.
- Bàn giao + đào tạo vận hành cho cán bộ CNTT của đơn vị.

### 7.3 Cần khách xác nhận trước khi bắt đầu P4-34

1. Cloud hay on-premise? Nếu on-premise: đơn vị nào cấp máy, thời gian dự kiến?
2. Cấu hình máy chủ được cấp (CPU/RAM/đĩa) — đối chiếu mục 1.2.
3. Máy chủ có ra được Internet không? Nếu không, có registry/mirror nội bộ chưa?
4. Tên miền và nguồn cấp chứng thư TLS.
5. Ai chịu trách nhiệm vận hành sau bàn giao (đội dự án hay cán bộ CNTT của xã)?
6. Có yêu cầu ràng buộc về nơi đặt dữ liệu (Nghị định 53/2022) không?

---

## 8. Xử lý sự cố nhanh

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `backend` mãi không `healthy` | Sai `MONGO_URI` (thiếu `?authSource=admin`) hoặc sai mật khẩu | `docker compose logs backend`; đối chiếu `MONGO_URI` với `MONGO_ROOT_*` trong `.env` |
| Web quản trị gọi API lỗi CORS/404 | `NEXT_PUBLIC_API_BASE_URL` trỏ tới `backend:3001` (tên nội bộ) thay vì domain public | Sửa `.env` rồi **build lại** image admin-web (mục 6.3) |
| Mini app trắng trang sau khi cập nhật | Trình duyệt còn cache `index.html` cũ trỏ tới file assets đã bị xoá | Đã chặn bằng `Cache-Control: no-store` trong `zalo-miniapp/nginx.conf`; xoá cache trình duyệt nếu vẫn còn |
| Đầy đĩa | Image cũ tích tụ | `docker image prune -a -f --filter "until=168h"` |
| Tệp đính kèm mất sau khi cập nhật | Thiếu volume `uploads` hoặc `STORAGE_LOCAL_DIR` không trỏ vào `/app/uploads` | Kiểm tra `docker compose config` và `docker volume ls` |
| `docker compose up` báo biến chưa đặt | Thiếu `.env` | `cp .env.example .env` rồi điền giá trị |
