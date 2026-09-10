# `k8s/` — manifest Kubernetes

> ## ⚠ THIẾT KẾ ĐỀ XUẤT — chưa kiểm chứng trên cụm thật
>
> Production hiện chạy bằng **Docker Compose trên một máy chủ**
> (`../docs/04-TRIEN-KHAI-VPS.md`). Bộ manifest này **chưa từng qua `kubectl
> apply` trên cụm thật**. Dùng làm điểm khởi đầu, không dùng làm hướng dẫn đã
> nghiệm thu. Mọi giá trị `example.vn` và `registry.example.vn` là giữ chỗ.

Tài liệu kiến trúc, đánh đổi và checklist: **`../docs/05-TRIEN-KHAI-K8S.md`**.

## Cấu trúc

```
base/                          chung cho mọi môi trường
  namespace.yaml
  configmap.yaml               biến KHÔNG bí mật
  secret.example.yaml          BẢNG TRA tên biến — không áp, không chứa giá trị
  services.yaml                4 Service (2 ClusterIP + 2 headless)
  backend-deployment.yaml      + initContainer chờ Mongo/RabbitMQ
  frontend-deployments.yaml    admin-web + zalo-miniapp
  stateful-mongo-rabbitmq.yaml chỉ dùng nếu chọn "dữ liệu trong cụm"
  uploads-pvc.yaml             ảnh hiện trường + bản scan văn bản
  ingress.yaml                 3 tên miền, TLS, giới hạn upload
  kustomization.yaml
overlays/
  staging/kustomization.yaml
  production/kustomization.yaml
```

## Dùng thế nào

```bash
# 1. Xem YAML sau khi kustomize dựng xong — LUÔN xem trước khi áp
kubectl kustomize k8s/overlays/staging

# 2. Tạo Secret (không nằm trong kustomize) — xem base/secret.example.yaml
kubectl create namespace vigov-staging
kubectl -n vigov-staging create secret generic vigov-secrets --from-literal=...

# 3. Áp
kubectl apply -k k8s/overlays/staging

# 4. Theo dõi
kubectl -n vigov-staging rollout status deployment/backend --timeout=300s
kubectl -n vigov-staging get pods,svc,ingress

# 5. Rollback khi hỏng
kubectl -n vigov-staging rollout undo deployment/backend
```

## Phải sửa gì trước khi dùng thật

| Chỗ | Sửa thành |
|---|---|
| `registry.example.vn/vigov` trong hai overlay | Registry thật |
| `*.example.vn` trong Ingress và `CORS_ORIGINS` | Tên miền thật |
| `newTag: main-CHANGEME` (production) | Tag thật `main-<sha7>` |
| `storageClassName` (chưa khai) | StorageClass của cụm — `kubectl get storageclass` |
| `cert-manager.io/cluster-issuer` | Tên ClusterIssuer thật, hoặc bỏ nếu dùng chứng thư có sẵn |

## Bốn điều dễ sai nhất

1. **Tăng `replicas` backend lên >1 khi chưa xử lý kho OTP, Socket.IO và volume
   uploads** → công dân không đăng nhập được, ảnh hiện trường không xem được.
   → `../docs/05-TRIEN-KHAI-K8S.md` mục 3.2
2. **Bật CORS ở Ingress** → thiếu `PATCH`, mọi thao tác sửa bị chặn tại trình
   duyệt dù backend khoẻ. Để backend tự trả CORS. → `ingress.yaml` đầu tệp
3. **Commit Secret có giá trị thật** → base64 không phải mã hoá bảo mật.
   → `base/secret.example.yaml`
4. **Quên `CITIZEN_OTP_BYPASS_CODE=""`** ở production → còn một mã cố định định
   danh được bất kỳ số điện thoại nào. → `../SECURITY.md` mục 4, việc 0
