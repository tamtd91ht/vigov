# ViGov — Triển khai trên Kubernetes và CI/CD bằng Jenkins

> ## ⚠ Trạng thái: THIẾT KẾ ĐỀ XUẤT — chưa kiểm chứng trên cụm thật
>
> Dự án hiện **đang chạy production bằng Docker Compose trên một máy chủ**
> (`04-TRIEN-KHAI-VPS.md`). Phần Kubernetes trong tài liệu này và bộ manifest ở
> `../k8s/` là **thiết kế đề xuất**, chưa từng được áp lên một cụm thật, chưa qua
> `kubectl apply`. Dùng làm điểm khởi đầu, không dùng làm hướng dẫn đã nghiệm thu.
>
> Ngược lại, **phần Jenkins (mục 2) mô tả đúng `Jenkinsfile` đang có trong repo** và
> đang dùng thật.

Tài liệu này dành cho hai tình huống: khách triển khai nhiều xã trên một cụm dùng
chung, hoặc hạ tầng của đơn vị đã chuẩn hoá trên Kubernetes.

---

## 1. Kubernetes có giải quyết vấn đề gì cho ViGov

Trả lời thẳng: **với quy mô một xã thì không đáng.** Compose đơn máy đang phục vụ tốt,
và Kubernetes thêm một lớp vận hành mà cán bộ CNTT cấp xã thường không có người trực.

Kubernetes chỉ đáng khi chạm một trong các mốc sau:

| Tình huống | Vì sao k8s giúp |
|---|---|
| Nhiều xã/phường trên cùng hệ thống (**câu hỏi mở #13**) | Mỗi xã một namespace, dùng chung cụm và đội vận hành |
| Yêu cầu SLA có tính sẵn sàng cao | Một máy chủ là một điểm chết duy nhất; k8s tự dựng lại pod và trải trên nhiều node |
| Cần cập nhật không gián đoạn | RollingUpdate sẵn có, không như compose ngừng 5–15 giây |
| Đơn vị đã có cụm k8s và đội vận hành | Không phải học lại mô hình mới |

> Nếu **chưa** chạm mốc nào ở trên, khuyến nghị giữ Compose. Chuyển sang k8s là **làm
> lại phần triển khai**, không phải nâng cấp tại chỗ.

### Từ Compose sang Kubernetes — cái gì thành cái gì

| `docker-compose.yml` | Kubernetes |
|---|---|
| `services: backend:` | **Deployment** + **Service** |
| `services: mongo:` | **StatefulSet** + **Service headless** + **PVC** |
| `volumes: mongo-data` | **PersistentVolumeClaim** |
| `volumes: uploads` | **PVC** chế độ `ReadWriteMany` (xem cảnh báo mục 3.4) |
| tệp `.env` | **ConfigMap** (giá trị thường) + **Secret** (mật khẩu, khoá) |
| nginx trên host | **Ingress** + cert-manager |
| `healthcheck:` | `livenessProbe` / `readinessProbe` |
| `restart: unless-stopped` | Mặc định của Deployment |
| *(không có)* | **HorizontalPodAutoscaler** |

---

## 2. CI/CD bằng Jenkins — hiện trạng thật

`../Jenkinsfile` đã có sẵn và **đang dùng**. Luồng:

```
Checkout
  → Build & Test        (3 module chạy SONG SONG: backend / admin-web / zalo-miniapp)
  → Docker Build & Push (tag = <branch>-<sha7> và <branch>-latest)
  → Deploy Staging      (tự động, chỉ nhánh `develop`)
  → Manual Approval     (người phụ trách bấm duyệt, hết hạn sau 24h)
  → Deploy Production   (chỉ nhánh `main`, sao lưu Mongo trước)
```

### 2.1 Chuẩn bị trên Jenkins

**Credentials** (Manage Jenkins → Credentials):

| ID | Kiểu | Dùng làm gì |
|---|---|---|
| `vigov-registry-credentials` | Username with password | Đăng nhập Docker registry |
| `vigov-staging-ssh` | SSH Username with private key | Deploy staging |
| `vigov-production-ssh` | SSH Username with private key | Deploy production |

**Biến toàn cục** (Manage Jenkins → System → Global properties):

| Biến | Nội dung |
|---|---|
| `VIGOV_STAGING_API_BASE_URL` | URL API của staging, ví dụ `https://api-staging.…/api/v1` |
| `VIGOV_PROD_API_BASE_URL` | URL API của production |
| `VIGOV_ORG_NAME` · `VIGOV_ORG_PARENT` · `VIGOV_ORG_SHORT` | Tên đơn vị nhúng vào bundle |

**Plugin:** Pipeline · Credentials Binding · SSH Agent · Timestamper · Workspace Cleanup.

**Agent (Linux):** docker + compose plugin, node ≥ 22, ssh client.

### 2.2 Vì sao bundle build riêng cho từng môi trường

`NEXT_PUBLIC_*` và `VITE_*` **nhúng vào bundle lúc build**. Hệ quả bắt buộc:

> Không thể "thăng hạng" nguyên xi image từ staging lên production. Staging và
> production là **hai image khác nhau**, build từ cùng một commit nhưng khác build-arg.

Đây là lý do pipeline build riêng theo nhánh (`develop` → staging, `main` → production),
và cũng là lý do phải kiểm URL API đã nhúng đúng trước khi phát hành
→ `08-ZALO-PHAT-HANH.md` mục 2.1.

### 2.3 Nguyên tắc bảo mật đang áp dụng

- Mọi secret qua `credentials()`, Jenkins tự che trong log.
- Đăng nhập registry qua `--password-stdin` — mật khẩu không lộ trong bảng tiến trình.
- **Tệp `.env` nằm sẵn trên máy chủ đích (chmod 600)**, pipeline không bao giờ ghi
  secret vào workspace.
- `StrictHostKeyChecking=accept-new` — chấp nhận host key lần đầu nhưng báo lỗi nếu key
  đổi (chống man-in-the-middle), an toàn hơn `no`.
- Cổng duyệt tay chặn mọi thay đổi tự động lên hệ thống đang phục vụ dân.
- Sao lưu Mongo chạy **trước** khi đổi phiên bản production.

### 2.4 Deploy hiện tại làm gì

Hàm `deployTo()` **không** cài Docker, **không** tạo `.env`, **không** dựng nginx. Nó:

```bash
cd /opt/vigov
cp .env .env.bak.$(date +%Y%m%d%H%M%S)
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=<tag>|' .env
docker compose pull
docker compose up -d --remove-orphans --wait --wait-timeout 180
```

Tức là **toàn bộ `04-TRIEN-KHAI-VPS.md` là điều kiện tiên quyết** để Jenkins chạy được,
không phải phương án thay thế.

### 2.5 Bổ sung stage deploy k8s — CHƯA LÀM

Khi chuyển sang Kubernetes, stage `Deploy Staging` / `Deploy Production` sẽ đổi từ
SSH + compose sang một trong hai cách dưới. **Chưa chốt dùng cách nào** — cần biết cụm
thật là loại gì trước khi sửa `Jenkinsfile`.

**Cách A — kubectl + kustomize** (ít phụ thuộc, dễ đọc):

```groovy
withCredentials([file(credentialsId: 'vigov-kubeconfig', variable: 'KUBECONFIG')]) {
    sh """
        kubectl -n ${namespace} set image deployment/backend \
            backend=${IMAGE_PREFIX}/vigov-backend:${IMAGE_TAG}
        kubectl -n ${namespace} rollout status deployment/backend --timeout=300s
    """
}
```

**Cách B — Helm** (mạnh về phiên bản và rollback, thêm một lớp phức tạp):

```groovy
sh """
    helm upgrade --install vigov ./charts/vigov \
        --namespace ${namespace} --create-namespace \
        --set image.tag=${IMAGE_TAG} \
        --wait --timeout 10m --atomic
"""
```

`--atomic` tự rollback khi deploy hỏng — điểm cộng đáng kể với hệ thống phục vụ dân.

| Tiêu chí | kubectl + kustomize | Helm |
|---|---|---|
| Đường học | Thấp — vẫn là YAML thuần | Cao hơn — thêm template + values |
| Rollback | `kubectl rollout undo` | `helm rollback`, có lịch sử phiên bản |
| Nhiều môi trường | Overlay theo thư mục | `values-*.yaml` |
| Nhiều xã (đa tenant) | Mỗi xã một overlay | Một chart, nhiều release — **gọn hơn rõ rệt** |
| Phù hợp khi | 1–2 môi trường, đội quen YAML | Nhiều xã, cần rollback có kiểm soát |

> **Khuyến nghị:** một xã thì kustomize là đủ; đã tính đa xã thì Helm trả lại công học
> ngay từ xã thứ ba.

---

## 3. Kiến trúc trên Kubernetes

### 3.1 Sơ đồ

```
                         Internet
                            │
                    ┌───────▼────────┐
                    │    Ingress     │  nginx-ingress + cert-manager
                    │  (TLS ở đây)   │
                    └───┬────┬───┬───┘
        admin-vigov ────┘    │   └──── miniapp-vigov
                          api-vigov
             │               │               │
    ┌────────▼──────┐ ┌──────▼───────┐ ┌────▼─────────┐
    │ Service       │ │ Service      │ │ Service      │
    │ admin-web     │ │ backend      │ │ zalo-miniapp │
    └────────┬──────┘ └──────┬───────┘ └────┬─────────┘
    ┌────────▼──────┐ ┌──────▼───────┐ ┌────▼─────────┐
    │ Deployment    │ │ Deployment   │ │ Deployment   │
    │ 2 replicas    │ │ 2 replicas   │ │ 2 replicas   │
    └───────────────┘ └──┬────────┬──┘ └──────────────┘
                         │        │
              ┌──────────▼─┐  ┌───▼──────────┐
              │ mongo      │  │ rabbitmq     │   ← xem mục 3.3:
              │ StatefulSet│  │ StatefulSet  │     trong hay ngoài cụm?
              │ + PVC      │  │ + PVC        │
              └────────────┘  └──────────────┘
```

### 3.2 Cảnh báo: backend chạy 2 replica là VỠ ngay

Đây là điều **phải xử lý trước** khi tăng `replicas` lên quá 1 — không phải việc tối ưu
về sau:

| Thành phần | Vỡ thế nào khi nhiều replica | Bắt buộc phải làm |
|---|---|---|
| **Kho OTP** (`OTP_STORE=memory`) | OTP sinh ở pod A, xác thực ở pod B ⇒ **công dân không đăng nhập được**. Bộ đếm nhập sai cũng không dùng chung ⇒ người dò chỉ cần đổi pod là thêm lượt | Đặt `OTP_STORE=mongo` **hoặc** chuyển sang Redis |
| **Socket.IO** | Broadcast không xuyên pod ⇒ cán bộ ở pod khác không nhận thông báo realtime | Thêm Redis adapter cho Socket.IO |
| **Cache trạng thái phiên** | TTL 10 giây, tự fallback về MongoDB | **Không vỡ** — thu hồi phiên trễ tối đa 10s, chấp nhận được |
| **Volume `uploads`** | Pod trên node khác không thấy tệp pod kia vừa ghi | PVC `ReadWriteMany` **hoặc** chuyển `STORAGE_DRIVER=s3` |

> Nói cách khác: **Kubernetes kéo theo Redis và object storage**, không chỉ là đổi cách
> chạy container. Đây là phần chi phí hay bị bỏ sót khi ước lượng.

### 3.3 Mongo và RabbitMQ — trong cụm hay ngoài cụm? *(chưa chốt)*

Khách chưa quyết. Hai hướng, ghi lại để bàn:

**Hướng 1 — tất cả trong cụm (StatefulSet + PVC)**

| Ưu | Nhược |
|---|---|
| Một mối vận hành, một nơi khai báo | Vận hành CSDL có trạng thái trên k8s **khó hơn hẳn** phần ứng dụng |
| Dựng lại môi trường nhanh | Cần StorageClass hỗ trợ đúng, backup phải tự lo |
| Không phụ thuộc hạ tầng ngoài | Nâng phiên bản Mongo trên StatefulSet dễ sai; nên dùng Operator |

**Hướng 2 — ứng dụng trong cụm, dữ liệu ngoài cụm**

| Ưu | Nhược |
|---|---|
| Mongo/RabbitMQ giữ nguyên cách vận hành đã quen | Hai nơi vận hành |
| Sao lưu/khôi phục theo quy trình đã kiểm chứng | Cần đường mạng ổn định giữa cụm và VM |
| Rủi ro mất dữ liệu thấp hơn rõ rệt | |

> **Khuyến nghị: Hướng 2 cho lần chuyển đầu tiên.** Lý do đúng với dự án này: dữ liệu ở
> đây là **hồ sơ hành chính có giá trị pháp lý và dữ liệu cá nhân công dân** thuộc phạm
> vi Nghị định 13/2023/NĐ-CP. Đổi cùng lúc cả cách chạy ứng dụng lẫn cách lưu dữ liệu
> là gộp hai rủi ro vào một lần chuyển. Chuyển ứng dụng trước, dữ liệu sau — khi đội
> đã quen cụm.

Manifest ở `../k8s/` viết theo **Hướng 1** (có sẵn StatefulSet) nhưng tách riêng thư
mục để bỏ đi dễ dàng nếu chọn Hướng 2 — khi đó chỉ cần trỏ `MONGO_URI` / `RABBITMQ_URI`
sang máy ngoài.

### 3.4 Tệp đính kèm — điểm dễ mất dữ liệu nhất

Volume `uploads` chứa **ảnh hiện trường của phiếu phản ánh** và **bản scan văn bản
đến** — tài liệu hành chính, không tái tạo được.

Trên compose đơn máy đây là một volume local, không vấn đề gì. Trên k8s nhiều replica
thì **`ReadWriteOnce` không đủ**: pod trên node khác sẽ không mount được.

| Phương án | Đánh giá |
|---|---|
| PVC `ReadWriteMany` (NFS, CephFS, Longhorn) | Chạy được, nhưng cần StorageClass hỗ trợ RWX — không phải cụm nào cũng có |
| `STORAGE_DRIVER=s3` (MinIO hoặc object storage) | **Khuyến nghị.** Backend đã có sẵn adapter, chỉ cần đổi biến `S3_*`. Hết hẳn bài toán volume chia sẻ |
| Giữ `ReadWriteOnce` + ghim 1 replica | Được, nhưng mất luôn lý do dùng k8s |

---

## 4. Bộ manifest mẫu

Đặt ở **`../k8s/`**, tổ chức theo kustomize:

```
k8s/
  base/                        ← chung cho mọi môi trường
    namespace.yaml
    configmap.yaml             ← biến KHÔNG bí mật
    secret.example.yaml        ← MẪU, không chứa giá trị thật
    backend-deployment.yaml
    backend-service.yaml
    admin-web-deployment.yaml
    admin-web-service.yaml
    zalo-miniapp-deployment.yaml
    zalo-miniapp-service.yaml
    mongo-statefulset.yaml
    rabbitmq-statefulset.yaml
    uploads-pvc.yaml
    ingress.yaml
    kustomization.yaml
  overlays/
    staging/kustomization.yaml
    production/kustomization.yaml
```

Áp dụng:

```bash
kubectl apply -k k8s/overlays/staging
kubectl -n vigov-staging rollout status deployment/backend --timeout=300s
```

### 4.1 Secret — đọc kỹ trước khi dùng

`secret.example.yaml` **chỉ là mẫu**, mọi giá trị là giữ chỗ. Nguyên tắc giống hệt quy
ước `.env.local` / `.env.example` của dự án:

> **Không bao giờ commit Secret có giá trị thật vào git.** `kubectl` lưu Secret dạng
> base64 — đó là **mã hoá hiển thị, không phải mã hoá bảo mật**, ai đọc được tệp là đọc
> được mật khẩu.

Ba cách tạo Secret thật, chọn theo hạ tầng:

```bash
# A. Tạo tay trên cụm (đơn giản nhất, phù hợp 1 cụm)
kubectl -n vigov create secret generic vigov-secrets \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=MONGO_ROOT_PASSWORD='<mật khẩu mạnh>' \
  --from-literal=MONGO_URI='mongodb://…' \
  --from-literal=RABBITMQ_URI='amqp://…'

# B. Sealed Secrets — commit được vào git ở dạng đã mã hoá
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# C. External Secrets Operator — lấy từ Vault / AWS Secrets Manager
```

Danh sách biến bắt buộc: đối chiếu `../.env.example`. Đặc biệt lưu ý
`CITIZEN_OTP_BYPASS_CODE` **phải để trống** ở production → `../SECURITY.md` mục 4.

### 4.2 Probe — vì sao đặt như trong manifest

```yaml
readinessProbe:            # chưa sẵn sàng thì KHÔNG nhận traffic
  httpGet: { path: /api/v1/health, port: 3001 }
  initialDelaySeconds: 10
  periodSeconds: 10
livenessProbe:             # treo hẳn thì khởi động lại
  httpGet: { path: /api/v1/health, port: 3001 }
  initialDelaySeconds: 40
  periodSeconds: 20
  failureThreshold: 3
```

`livenessProbe` phải có `initialDelaySeconds` **lớn hơn** thời gian khởi động thật của
backend (nối Mongo + RabbitMQ). Đặt quá ngắn thì pod bị giết giữa lúc đang khởi động và
**lặp vô hạn** — lỗi kinh điển, biểu hiện là `CrashLoopBackOff` mà log không có lỗi gì.

### 4.3 Ingress và CORS — cạm bẫy đã gặp thật

Trên VPS, gateway nginx tự chèn header CORS đè lên header của backend, và bộ header đó
thiếu `PATCH` ⇒ **mọi thao tác sửa bị trình duyệt chặn** dù backend hoàn toàn khoẻ.

Cạm bẫy này **lặp lại y hệt trên Ingress** nếu bật annotation
`nginx.ingress.kubernetes.io/enable-cors`. Nguyên tắc:

> **Để backend tự trả CORS.** Backend đã khai đầy đủ `GET POST PATCH PUT DELETE
> OPTIONS` và whitelist origin gồm cả `https://h5.zdn.vn`
> (`security.middleware.ts`). Hai nơi cùng khai CORS là gốc của lỗi.

Kiểm sau khi dựng Ingress — phải thấy `PATCH`:

```bash
curl -sI -X OPTIONS https://api-vigov.<tên-miền>/api/v1/health \
  -H 'Origin: https://h5.zdn.vn' \
  -H 'Access-Control-Request-Method: PATCH' | grep -i allow-methods
```

Chi tiết chẩn đoán → `06-VAN-HANH.md` mục 5.2.

### 4.4 Giới hạn kích thước upload

Ảnh hiện trường tối đa 20 MiB (`STORAGE_MAX_FILE_SIZE`). Ingress phải khai khớp, nếu
không người dân chờ tải hết ảnh rồi mới nhận 413:

```yaml
nginx.ingress.kubernetes.io/proxy-body-size: "21m"
```

---

## 5. Checklist trước khi chuyển sang k8s

Không bỏ qua mục nào — mỗi mục là một cách mất dữ liệu hoặc mất dịch vụ:

- [ ] Đã chốt Mongo/RabbitMQ trong hay ngoài cụm (mục 3.3)
- [ ] `OTP_STORE=mongo` hoặc đã dựng Redis — **nếu không, công dân không đăng nhập được**
- [ ] Socket.IO đã có Redis adapter, hoặc chấp nhận tắt realtime
- [ ] Tệp đính kèm: PVC `ReadWriteMany` hoặc `STORAGE_DRIVER=s3` (mục 3.4)
- [ ] Secret tạo bằng cách không commit giá trị thật vào git (mục 4.1)
- [ ] `CITIZEN_OTP_BYPASS_CODE` để trống
- [ ] Ingress **không** tự chèn CORS (mục 4.3)
- [ ] `proxy-body-size` khớp `STORAGE_MAX_FILE_SIZE`
- [ ] Sao lưu Mongo đã chạy và **đã diễn tập khôi phục thành công**
- [ ] Đã thử `kubectl rollout undo` trên staging
- [ ] Người trực vận hành cụm đã được bàn giao

---

## 6. Việc còn phải làm

| Việc | Vì sao chưa làm |
|---|---|
| Kiểm chứng manifest trên cụm thật | Chưa có cụm |
| Chốt kustomize hay Helm | Chưa biết hạ tầng đích (mục 2.5) |
| Bổ sung stage deploy k8s vào `Jenkinsfile` | Phụ thuộc quyết định trên |
| Redis cho kho OTP + Socket.IO | Chỉ cần khi thật sự chạy nhiều replica |
| HorizontalPodAutoscaler | Cần số liệu tải thật để đặt ngưỡng |
| NetworkPolicy | Nên có ở môi trường nhiều tenant |

→ `04-TRIEN-KHAI-VPS.md` · `06-VAN-HANH.md` · `../SECURITY.md` · `../k8s/README.md`
