# ViGov — Triển khai lên VPS, từng bước

Runbook cho **lần cài đặt đầu tiên** trên một máy chủ trống, theo kiến trúc
all-in-one (mọi thứ chạy trên một máy — xem `../deploy/README.md` mục 1.4).

Làm tuần tự từ trên xuống. Mỗi bước có phần **Xác nhận** — làm xong phải thấy
đúng kết quả đó rồi mới sang bước tiếp theo.

## Hai giai đoạn

Khách hàng yêu cầu CI/CD bằng **Jenkins**. Giai đoạn này triển khai tay trên VPS
trước — và đó **không phải làm tạm rồi bỏ**:

```
Giai đoạn 1 (tài liệu này, Bước 0–11)      Giai đoạn 2 (Bước 12)
┌──────────────────────────────┐           ┌──────────────────────────┐
│ Cài tay trên VPS             │           │ Jenkins pipeline         │
│  · Docker, user, tường lửa   │  ──────▶  │  · build + test + push   │
│  · .env (chứa mọi secret)    │  tiền đề  │  · đổi IMAGE_TAG         │
│  · nginx + TLS               │           │  · compose pull && up    │
│  · cron sao lưu              │           │                          │
└──────────────────────────────┘           └──────────────────────────┘
```

`../Jenkinsfile` đã có sẵn trong repo và hàm `deployTo()` của nó **không tạo `.env`,
không cài Docker, không dựng nginx**. Nó chỉ SSH vào máy, `sed` đổi một dòng
`IMAGE_TAG` trong `.env` sẵn có, rồi `docker compose pull && up -d --wait`.

Tức là toàn bộ Bước 0–11 dưới đây là **điều kiện tiên quyết** để Jenkins chạy
được, không phải phương án thay thế. Làm xong giai đoạn 1, sang Bước 12.

- Tài liệu này: *làm gì, theo thứ tự nào.*
- `../deploy/README.md`: *vì sao, và xử lý khi hỏng.* Tra cứu theo mục khi cần.

**Thời gian ước tính:** 60–90 phút, chưa kể chờ DNS lan truyền và chờ build image.

---

## Bước 0 — Thu thập thông tin trước khi bắt đầu

Thiếu bất kỳ mục nào dưới đây là sẽ phải dừng giữa chừng.

- [ ] IP public của VPS, tài khoản `root` hoặc user có `sudo`
- [ ] Cấu hình máy: **tối thiểu 4 vCPU / 8 GB RAM / 100 GB SSD** (đối chiếu `../deploy/README.md` mục 1.2)
- [ ] Hệ điều hành: Ubuntu Server 22.04/24.04 LTS, hoặc RHEL/Rocky 9
- [ ] VPS ra được Internet (để `docker pull`, `npm ci`). Nếu không — cần registry nội bộ, xem `../deploy/README.md` mục 7.2
- [ ] 3 tên miền đã trỏ A record về IP VPS:
  - `quantri.vigov.<tên-miền>` — Web Quản trị
  - `api.vigov.<tên-miền>` — API
  - `miniapp.vigov.<tên-miền>` — Zalo Mini App
- [ ] Email quản trị (certbot dùng để cảnh báo chứng thư sắp hết hạn)
- [ ] Nơi chứa bản sao lưu **ngoài VPS này** (máy khác / NAS / object storage)

> **Chưa có tên miền?** Vẫn triển khai được nhưng chỉ dùng cho môi trường dev —
> bỏ qua Bước 9, làm theo **Phụ lục A** thay thế.

---

## Bước 1 — Chuẩn bị hệ điều hành

```bash
# Ubuntu
apt update && apt upgrade -y
apt install -y git curl ca-certificates

# RHEL / Rocky 9
dnf update -y
dnf install -y git curl ca-certificates
```

Đặt múi giờ (ảnh hưởng log, cron sao lưu và hiển thị hạn SLA):

```bash
timedatectl set-timezone Asia/Ho_Chi_Minh
```

**Xác nhận:**

```bash
timedatectl | grep "Time zone"      # phải thấy Asia/Ho_Chi_Minh
free -g | awk '/Mem:/ {print $2" GB RAM"}'
df -h --output=target,avail | grep -E "^/( |$|opt|u01|data)"
```

---

## Bước 2 — Cài Docker Engine + Compose v2

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

**Xác nhận:**

```bash
docker --version                    # cần >= 24
docker compose version              # cần >= 2.22 (lệnh `up --wait` ở Bước 6 đòi bản này)
docker run --rm hello-world
```

> Compose < 2.22 sẽ không có cờ `--wait`. Nếu nhà cung cấp cài sẵn bản cũ, gỡ rồi
> cài lại bằng script ở trên.

---

## Bước 3 — Tạo user triển khai và thư mục dự án

Không chạy hệ thống bằng `root`.

```bash
# Chọn phân vùng còn chỗ. KHÔNG đặt trong /root (quyền 0750, service không đọc được).
df -h                               # thường là /opt, hoặc /u01 nếu máy có ổ dữ liệu riêng
DEPLOY_DIR=/opt/vigov               # đổi cho khớp máy của bạn

useradd -r -m -d "$DEPLOY_DIR" -s /bin/bash vigov
usermod -aG docker vigov
mkdir -p "$DEPLOY_DIR"
chown -R vigov:vigov "$DEPLOY_DIR"
chmod 750 "$DEPLOY_DIR"
```

**Nếu là RHEL/Rocky và SELinux đang bật** — gán nhãn cho thư mục, nếu không container
sẽ bị chặn đọc file (lỗi `Permission denied` dù quyền Unix đúng):

```bash
getenforce                          # Enforcing thì mới cần 2 lệnh dưới
semanage fcontext -a -t container_file_t "${DEPLOY_DIR}(/.*)?"
restorecon -Rv "$DEPLOY_DIR"
```

**Xác nhận:**

```bash
su - vigov -c "docker ps"           # chạy được, không báo permission denied
```

---

## Bước 4 — Lấy mã nguồn

Từ đây trở đi **làm bằng user `vigov`**, không phải root.

```bash
su - vigov
cd /opt/vigov
git clone https://github.com/tamtd91ht/vigov.git .
```

> Dấu `.` ở cuối là bắt buộc — thiếu nó git sẽ tạo thêm một tầng `/opt/vigov/vigov/`.

**Xác nhận:**

```bash
ls -la                              # phải thấy docker-compose.yml, .env.example, deploy/
git log --oneline -1
```

---

## Bước 5 — Tạo file cấu hình `.env`

> **Bước quan trọng nhất. Làm sai ở đây thì Bước 6 phải build lại từ đầu**, vì các
> biến `NEXT_PUBLIC_*` và `VITE_*` được **nhúng cứng vào bundle JavaScript lúc
> build**, không phải đọc lúc chạy. Đổi chúng sau khi build là vô tác dụng.

```bash
cp .env.example .env
chmod 600 .env
```

Sinh 3 chuỗi bí mật, mỗi chuỗi dùng một lần:

```bash
openssl rand -base64 48             # → JWT_SECRET
openssl rand -base64 24             # → MONGO_ROOT_PASSWORD
openssl rand -base64 24             # → RABBITMQ_DEFAULT_PASS
```

Mở `.env` và điền. Bảng dưới là **những biến bắt buộc đổi** — để nguyên giá trị mẫu
là hệ thống không chạy hoặc mất an toàn:

| Biến | Điền gì |
|---|---|
| `JWT_SECRET` | Chuỗi `openssl rand -base64 48` vừa sinh |
| `MONGO_ROOT_PASSWORD` | Mật khẩu mạnh vừa sinh |
| `MONGO_URI` | `mongodb://vigov_root:<mật-khẩu-đó>@mongo:27017/vigov?authSource=admin` — **phải khớp** `MONGO_ROOT_PASSWORD` |
| `RABBITMQ_DEFAULT_PASS` | Mật khẩu mạnh vừa sinh |
| `RABBITMQ_URI` | `amqp://vigov:<mật-khẩu-đó>@rabbitmq:5672` — **phải khớp** dòng trên |
| `MONGO_CACHE_GB` | ≈ 1/4 RAM máy: 8 GB → `2`, 16 GB → `4` |
| `CORS_ORIGINS` | `https://quantri.vigov.<tên-miền>,https://h5.zdn.vn` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.vigov.<tên-miền>/api/v1` |
| `VITE_API_BASE_URL` | `https://api.vigov.<tên-miền>/api/v1` |
| `SEED_ADMIN_PASSWORD` | Mật khẩu mạnh, dùng một lần rồi đổi ở Bước 8 |
| `SEED_DEFAULT_PASSWORD` | Như trên |
| `TRUST_PROXY` | `1` (có đúng một nginx đứng trước) |
| `NODE_ENV` | `production` |

Ba điều dễ sai:

- `MONGO_URI` dùng host `mongo`, `RABBITMQ_URI` dùng host `rabbitmq` — đó là **tên
  service trong mạng Docker**, không phải `localhost`.
- `NEXT_PUBLIC_API_BASE_URL` phải là **domain public**, vì trình duyệt của cán bộ
  mới là bên gọi — không phải tên service nội bộ `backend`.
- Ở `NODE_ENV=production`, backend **cố tình từ chối khởi động** nếu `JWT_SECRET`
  còn là giá trị mẫu hoặc `CORS_ORIGINS` để trống/`*`.

**Xác nhận:**

```bash
grep -c "change-me" .env            # phải ra 0
docker compose config --quiet && echo "CẤU HÌNH HỢP LỆ"
```

---

## Bước 6 — Build image

```bash
docker compose build
```

Mất 5–15 phút tuỳ băng thông. Ba image được dựng: `backend`, `admin-web`,
`zalo-miniapp`. Mongo và RabbitMQ dùng image chính thức, chỉ cần pull.

**Xác nhận:**

```bash
docker images | grep vigov          # thấy đủ 3 image
```

---

## Bước 7 — Khởi chạy

```bash
docker compose up -d --wait
docker compose ps
```

Thứ tự khởi động do `depends_on: condition: service_healthy` lo, không cần bật tay
từng cái:

```
mongo (healthy)  ─┐
                  ├─→ backend (healthy) ─┬─→ admin-web
rabbitmq (healthy)┘                      └─→ zalo-miniapp
```

**Xác nhận** — cả 5 container phải ở trạng thái `(healthy)`:

```bash
curl -s http://127.0.0.1:3001/api/v1/health/ready
# mong đợi: {"status":"ok","database":"connected","messaging":{"connected":true,...}}

curl -sI http://127.0.0.1:8080/healthz | head -1     # 200
curl -sI http://127.0.0.1:3000/        | head -1     # 200
```

`database` phải là `connected`. Nếu không, xem `../deploy/README.md` mục 8 — nguyên nhân
thường gặp nhất là `MONGO_URI` thiếu `?authSource=admin` hoặc mật khẩu lệch với
`MONGO_ROOT_PASSWORD`.

---

## Bước 8 — Seed dữ liệu khởi tạo

```bash
docker compose run --rm --no-deps backend \
  node dist/apps/api-gateway/apps/api-gateway/src/seed
```

Tạo tài khoản cán bộ theo danh bạ xã và bộ cấu hình SLA. Seed **idempotent**
(upsert theo `username`), chạy lại không tạo bản ghi trùng và không ghi đè mật khẩu
đã đổi.

> Image backend đã loại `devDependencies` nên **không có `ts-node`** — `npm run seed`
> sẽ lỗi. Phải dùng đúng lệnh `node dist/...` ở trên.

**Bắt buộc làm ngay sau khi seed:**

- [ ] Đăng nhập bằng `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` trong `.env`
- [ ] Đổi mật khẩu **tất cả** tài khoản được seed
- [ ] Xoá tài khoản mẫu không dùng, tạo tài khoản theo danh sách cán bộ thật
- [ ] Xoá `SEED_DEFAULT_PASSWORD` và `SEED_ADMIN_PASSWORD` khỏi `.env`

---

## Bước 9 — Reverse proxy + TLS

Compose chỉ mở cổng trên `127.0.0.1`. Thứ lộ ra Internet là nginx trên host.

```bash
exit                                # quay lại root
apt install -y nginx certbot python3-certbot-nginx     # Ubuntu
# dnf install -y nginx certbot python3-certbot-nginx   # RHEL/Rocky

cp /opt/vigov/deploy/nginx-vigov.conf /etc/nginx/sites-available/vigov
sed -i 's/<tên-miền>/vigov.vn/g' /etc/nginx/sites-available/vigov   # đổi thành tên miền thật
ln -sf /etc/nginx/sites-available/vigov /etc/nginx/sites-enabled/vigov
mkdir -p /var/www/certbot
```

Xin chứng thư cho cả 3 domain trong một lần:

```bash
certbot --nginx \
  -d quantri.vigov.<tên-miền> \
  -d api.vigov.<tên-miền> \
  -d miniapp.vigov.<tên-miền> \
  --email <email-quản-trị> --agree-tos --no-eff-email

nginx -t && systemctl reload nginx
systemctl enable --now nginx
```

Mở tường lửa — **chỉ** 80/443, không mở 3000/3001/8080/27017/5672:

```bash
ufw allow 22,80,443/tcp && ufw enable                              # Ubuntu
# firewall-cmd --permanent --add-service={ssh,http,https}          # RHEL
# firewall-cmd --reload
```

**Xác nhận** — gọi từ **máy khác**, không phải từ VPS:

```bash
curl -sI https://api.vigov.<tên-miền>/api/v1/health | head -1      # 200
curl -sI https://quantri.vigov.<tên-miền>/          | head -1      # 200
curl -sI http://api.vigov.<tên-miền>/               | head -1      # 301 → https
```

Kiểm tra chứng thư tự gia hạn được:

```bash
certbot renew --dry-run
```

---

## Bước 10 — Sao lưu tự động

> Một máy chạy tất cả nghĩa là **hỏng máy là mất sạch** — app, cơ sở dữ liệu và
> toàn bộ ảnh phản ánh của công dân. Với kiến trúc all-in-one, bước này không phải
> tuỳ chọn.

Chạy thử một lần:

```bash
su - vigov -c "cd /opt/vigov && bash deploy/backup-mongo.sh"
ls -lh /opt/vigov/backups/          # phải thấy file .archive.gz vừa tạo
```

Đặt lịch (`crontab -e` với user `vigov`):

```cron
# ViGov — sao lưu MongoDB 02:00 hằng ngày
0 2 * * * cd /opt/vigov && bash deploy/backup-mongo.sh >> /opt/vigov/backups/backup.log 2>&1

# Đẩy bản sao sang máy KHÁC lúc 03:00 — BẮT BUỘC.
# Giữ bản sao trên cùng một ổ đĩa KHÔNG phải là sao lưu.
0 3 * * * rsync -az --delete /opt/vigov/backups/ <user>@<máy-khác>:/backup/vigov/
```

**Đừng quên tệp đính kèm.** `mongodump` chỉ sao lưu cơ sở dữ liệu, không sao lưu
volume `uploads` (ảnh phản ánh, bản scan văn bản). Xem `../deploy/README.md` mục 4.4.

**Xác nhận:** hôm sau kiểm tra `backups/backup.log` và đối chiếu file đã sang được
máy đích. Thử khôi phục ít nhất một lần trước khi bàn giao (`../deploy/README.md` mục 4.3) —
bản sao lưu chưa từng khôi phục thử thì chưa tính là có sao lưu.

---

## Bước 11 — Nghiệm thu trước bàn giao

- [ ] Cả 5 container `(healthy)`, `docker compose ps` sạch
- [ ] `/api/v1/health/ready` trả `database: connected` **và** `messaging.connected: true`
- [ ] Đăng nhập được Web Quản trị qua HTTPS bằng tài khoản thật
- [ ] Gửi thử một phản ánh từ Zalo Mini App → thấy trên Web Quản trị
- [ ] Tải lên một ảnh đính kèm → xem lại được
- [ ] `certbot renew --dry-run` thành công
- [ ] Sao lưu đã chạy, đã sang được máy khác, đã thử khôi phục
- [ ] Đã xoá toàn bộ biến `SEED_*` khỏi `.env`
- [ ] Đã rà xong danh sách 12 việc bắt buộc trong `../SECURITY.md` mục 4
- [ ] `docker compose ps` không thấy cổng nào bind `0.0.0.0` ngoài 80/443 của nginx

Kịch bản kiểm thử đầy đủ: `../deploy/UAT.md` (10 kịch bản hồi quy).

---

## Bước 12 — Chuyển sang Jenkins (giai đoạn 2)

Làm **sau khi** Bước 0–11 đã xong và hệ thống chạy ổn định bằng tay. Pipeline đã
được viết sẵn trong `../Jenkinsfile` ở thư mục gốc — việc còn lại là cấu hình Jenkins
và chuẩn bị đường vào máy chủ.

### 12.1 Pipeline đã có sẵn những gì

| Stage | Nội dung | Chạy khi |
|---|---|---|
| `Checkout` | Lấy mã, tính `IMAGE_TAG` = `<branch>-<git-short-sha>` | Mọi lần |
| `Build & Test` | Chạy song song 4 nhánh: Backend (unit + e2e), Admin Web (typecheck + lint + test), Zalo Mini App (typecheck + lint), Mobile (`flutter analyze` + build APK) | Mọi lần |
| `Docker Build & Push` | Dựng 3 image, đẩy lên registry | `develop` và `main` |
| `Deploy Staging` | Triển khai lên `STAGING_HOST` | Nhánh `develop` |
| `Manual Approval` | Chờ người duyệt, hỏi có sao lưu trước khi triển khai không | Nhánh `main` |
| `Deploy Production` | `mongodump` (nếu chọn) rồi triển khai lên `PRODUCTION_HOST` | Nhánh `main`, sau khi duyệt |

Mobile build bỏ qua được bằng tham số `SKIP_MOBILE` khi chỉ cần deploy nhanh phần web.

### 12.2 Điều kiện tiên quyết

- [ ] **Một Docker registry.** Pipeline push image lên đó, máy chủ pull về. Khách
      cấp registry riêng, hoặc tự dựng Harbor/registry:2 trên máy nội bộ. Đây là
      hạng mục hay bị bỏ sót nhất khi chuyển sang CI.
- [ ] **Jenkins có Docker** để chạy `docker build` (agent cài sẵn Docker CLI +
      quyền truy cập daemon).
- [ ] **Bước 0–11 đã hoàn tất trên máy đích**, đặc biệt là `.env` với đầy đủ secret.
- [ ] Plugin Jenkins: `Pipeline`, `Git`, `SSH Agent`, `Credentials Binding`.

### 12.3 Khai báo Credentials trong Jenkins

Đúng 3 mục, tên phải khớp chính xác — `../Jenkinsfile` gọi theo tên:

| ID | Kiểu | Nội dung |
|---|---|---|
| `vigov-registry-credentials` | Username with password | Tài khoản đẩy image lên registry |
| `vigov-staging-ssh` | SSH Username with private key | Khoá SSH vào máy staging |
| `vigov-production-ssh` | SSH Username with private key | Khoá SSH vào máy production |

Sinh khoá cho Jenkins (**trên máy Jenkins**, không dùng lại khoá cá nhân):

```bash
ssh-keygen -t ed25519 -C "jenkins@vigov" -f ~/.ssh/id_ed25519_vigov_deploy -N ""
```

Chép công khoá vào máy đích, **cho đúng user `vigov`** đã tạo ở Bước 3:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519_vigov_deploy.pub vigov@<máy-chủ>
```

Rồi dán **private key** vào credential `vigov-production-ssh`, username là `vigov`.

### 12.4 Tham số job

Tạo job kiểu **Multibranch Pipeline** trỏ vào repo, rồi đặt lại giá trị mặc định
(giá trị trong `../Jenkinsfile` chỉ là ví dụ):

| Tham số | Đổi thành |
|---|---|
| `REGISTRY_HOST` | Host registry thật |
| `REGISTRY_NAMESPACE` | `vigov` |
| `STAGING_HOST` | Host/IP máy staging |
| `PRODUCTION_HOST` | Host/IP máy production |
| `REMOTE_DEPLOY_DIR` | Thư mục đã chọn ở Bước 3 — mặc định `/opt/vigov` |
| `SKIP_MOBILE` | `false` |

### 12.5 Khai báo biến toàn cục trên Jenkins (bắt buộc)

**Manage Jenkins → System → Global properties → Environment variables.**

Các biến `NEXT_PUBLIC_*` và `VITE_*` được nhúng vào bundle lúc `docker build`, nên
pipeline truyền chúng qua `--build-arg` chứ không đọc `.env` của máy chủ. Nguồn giá
trị là 5 biến toàn cục dưới đây (`Jenkinsfile:196-204`):

| Biến | Giá trị | Bắt buộc |
|---|---|---|
| `VIGOV_PROD_API_BASE_URL` | `https://api.vigov.<tên-miền>/api/v1` | Có, khi build nhánh `main` |
| `VIGOV_STAGING_API_BASE_URL` | `https://api.staging.vigov.<tên-miền>/api/v1` | Có, khi build nhánh `develop` |
| `VIGOV_ORG_NAME` | `Xã Đại Thắng` | Không (mặc định rỗng) |
| `VIGOV_ORG_PARENT` | `Huyện Phú Xuyên · Thành phố Hà Nội` | Không (mặc định rỗng) |
| `VIGOV_ORG_SHORT` | `VG` | Không (mặc định `VG`) |

Pipeline chọn URL theo nhánh: `main` → `VIGOV_PROD_*`, còn lại → `VIGOV_STAGING_*`.
Thiếu biến tương ứng thì stage `Docker Build & Push` **dừng ngay với lỗi rõ ràng**,
chứ không dựng ra bundle trỏ sai địa chỉ.

`NEXT_PUBLIC_APP_VERSION` / `VITE_APP_VERSION` không cần khai — pipeline tự đặt
bằng `<branch>-<git-short-sha>`.

### 12.6 Sửa `.env` trên máy chủ cho chế độ registry

Ở giai đoạn 1, máy chủ **tự build** image (`IMAGE_TAG=local`, `IMAGE_REGISTRY` để
trống). Chuyển sang Jenkins thì image do CI dựng và đẩy lên registry, máy chủ chỉ
pull về:

```bash
# Trên máy chủ, trong .env — nhớ dấu "/" cuối
IMAGE_REGISTRY=registry.example.vn/vigov/
```

Đăng nhập registry một lần bằng user `vigov` để `docker compose pull` chạy được:

```bash
su - vigov -c "docker login registry.example.vn"
```

Không cần sửa `IMAGE_TAG` bằng tay nữa — mỗi lần deploy Jenkins tự `sed` dòng đó.

### 12.7 Nhánh và luồng phát hành

```
feature/*  ──▶ push ──▶ Build & Test (không deploy)
develop    ──▶ push ──▶ Build & Test ──▶ Push image ──▶ Deploy Staging (tự động)
main       ──▶ push ──▶ Build & Test ──▶ Push image ──▶ [Chờ duyệt] ──▶ Deploy Production
```

Ở bước duyệt, người duyệt chọn `BACKUP_BEFORE_DEPLOY` — mặc định **bật**, chạy
`../deploy/backup-mongo.sh` trên máy đích trước khi đổi phiên bản. Giữ mặc định này.

### 12.8 Xác nhận

- [ ] Đẩy một commit lên `develop` → pipeline xanh, staging chạy phiên bản mới
- [ ] `docker compose ps` trên staging cho thấy image có tag `develop-<sha>`
- [ ] Đẩy lên `main` → pipeline dừng ở `Manual Approval`, không tự triển khai
- [ ] Duyệt → thấy file sao lưu mới trong `backups/`, rồi production lên bản mới
- [ ] Thử rollback theo `../deploy/README.md` mục 6.4

### 12.9 Hai điều cần biết trước

**`.env` vẫn là việc thủ công, mãi mãi.** Jenkins cố ý không đụng vào file này —
mọi secret nằm trên máy chủ với quyền `chmod 600`, pipeline không bao giờ nhìn thấy
chúng. Thêm biến môi trường mới thì phải SSH vào từng máy sửa tay, rồi mới deploy.

**`NEXT_PUBLIC_*` và `VITE_*` không đọc từ `.env` của máy chủ.** Sửa hai nhóm biến
này trong `.env` trên VPS là vô tác dụng khi đã dùng Jenkins — chúng nhúng vào bundle
lúc `docker build`, lấy giá trị từ **biến toàn cục của Jenkins** (mục 12.5). Muốn
đổi: sửa biến toàn cục, rồi chạy lại pipeline để dựng image mới. Xem thêm
`../deploy/README.md` mục 6.3.

---

## Phụ lục A — Biến thể cụm dev (IP, chưa có tên miền/TLS)

Dùng khi dựng máy test nội bộ. **Không dùng cho production** — mật khẩu sẽ truyền
qua mạng dưới dạng plaintext.

Khác với luồng chính ở 4 chỗ:

1. **Bước 5** — dùng IP thay cho domain, tắt các thứ liên quan TLS:

   ```ini
   NODE_ENV=development
   PUBLIC_BIND_IP=0.0.0.0
   INFRA_BIND_IP=127.0.0.1
   HSTS_MAX_AGE=0
   TRUST_PROXY=
   CORS_ORIGINS=http://<ip-vps>:3000,http://<ip-vps>:8080,https://h5.zdn.vn
   NEXT_PUBLIC_API_BASE_URL=http://<ip-vps>:3001/api/v1
   VITE_API_BASE_URL=http://<ip-vps>:3001/api/v1
   ```

2. **Bỏ qua Bước 9** hoàn toàn — truy cập thẳng `http://<ip-vps>:3000`.

3. **Chặn tường lửa theo IP nguồn**, vì `PUBLIC_BIND_IP=0.0.0.0` mở cổng ra Internet:

   ```bash
   ufw allow from <ip-văn-phòng> to any port 3000,3001,8080 proto tcp
   ```

4. `INFRA_BIND_IP` **giữ nguyên `127.0.0.1`** — Mongo và RabbitMQ không bao giờ lộ ra
   ngoài, kể cả ở cụm dev. Cần debug thì dùng SSH tunnel:

   ```bash
   ssh -L 27017:127.0.0.1:27017 -L 15672:127.0.0.1:15672 vigov@<ip-vps>
   ```

---

## Phụ lục B — Khi cần làm lại

| Tình huống | Việc cần làm |
|---|---|
| Đổi `NEXT_PUBLIC_*` hoặc `VITE_*` | `docker compose build admin-web zalo-miniapp` rồi `up -d`. Đổi `.env` rồi `up` là **không** có tác dụng — xem `../deploy/README.md` mục 6.3 |
| Đổi biến backend khác | `docker compose up -d backend` là đủ |
| Cập nhật phiên bản | `../deploy/README.md` mục 6 |
| Quay lại bản trước | `../deploy/README.md` mục 6.4 |
| Container không lên `healthy` | `docker compose logs --since 10m <service>`, đối chiếu `../deploy/README.md` mục 8 |
| Xoá sạch làm lại (**mất hết dữ liệu**) | `docker compose down -v` — chỉ làm trên máy dev |
