# syntax=docker/dockerfile:1.7
# =============================================================================
# ViGov — Zalo Mini App (Vite + React + TS)
#
# Sản phẩm build là trang tĩnh (SPA) → build bằng Node rồi phục vụ bằng nginx.
# Giống Next, biến VITE_* được nhúng lúc build ⇒ mỗi môi trường build 1 image
# riêng với bộ ARG tương ứng (khớp zalo-miniapp/.env.example).
#
# Ghi chú: bản đóng gói nộp lên Zalo Mini App Store (task P4-37) lấy trực tiếp
# thư mục `dist/` bằng zmp-cli; image nginx này phục vụ mục đích xem thử /
# kiểm thử UAT trên hạ tầng của xã qua trình duyệt.
# =============================================================================

ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:alpine

# -----------------------------------------------------------------------------
# Stage 1 — deps
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2 — build (tsc -b && vite build → /app/dist)
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# --- Cấu hình công khai, nhúng lúc build (khớp zalo-miniapp/.env.example) -----
ARG VITE_API_BASE_URL=http://localhost:3001/api/v1
# Production PHẢI để false để mini app gọi API thật
ARG VITE_USE_MOCKS=false
ARG VITE_ORG_NAME=
ARG VITE_ORG_PARENT=
ARG VITE_ORG_SHORT=VG
# Điền sau khi khách đăng ký Zalo OA/Business (câu hỏi mở #3)
ARG VITE_ZALO_APP_ID=
ARG VITE_ZALO_OA_ID=
ARG VITE_HOTLINE=
# CI truyền số build / git tag vào đây
ARG VITE_APP_VERSION=0.0.0

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_USE_MOCKS=${VITE_USE_MOCKS} \
    VITE_ORG_NAME=${VITE_ORG_NAME} \
    VITE_ORG_PARENT=${VITE_ORG_PARENT} \
    VITE_ORG_SHORT=${VITE_ORG_SHORT} \
    VITE_ZALO_APP_ID=${VITE_ZALO_APP_ID} \
    VITE_ZALO_OA_ID=${VITE_ZALO_OA_ID} \
    VITE_HOTLINE=${VITE_HOTLINE} \
    VITE_APP_VERSION=${VITE_APP_VERSION}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runtime: nginx phục vụ tĩnh, chạy bằng user `nginx` (không root)
# -----------------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime

# Cấu hình riêng của ViGov: SPA fallback, gzip, cache asset có hash.
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Để chạy không-root, nginx cần quyền ghi lên thư mục cache/log và file pid.
# nginx.conf đã trỏ pid sang /tmp/nginx.pid nên chỉ cần chown phần còn lại.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx

USER nginx

# Cổng > 1024 vì user không-root không bind được cổng đặc quyền (<1024).
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
