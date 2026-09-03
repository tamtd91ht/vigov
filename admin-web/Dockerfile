# syntax=docker/dockerfile:1.7
# =============================================================================
# ViGov — Web Quản trị (Next.js 16, App Router)
#
# LƯU Ý QUAN TRỌNG: biến NEXT_PUBLIC_* được Next NHÚNG THẲNG vào bundle lúc
# `next build`, không đọc lại lúc chạy. Vì vậy mỗi môi trường (staging /
# production) phải BUILD RIÊNG một image với bộ ARG tương ứng — không thể tái
# dùng 1 image rồi đổi env khi `docker run`.
#   docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.gov.vn/api/v1 …
# Danh sách ARG bên dưới khớp 1-1 với admin-web/.env.example.
#
# Ảnh cuối dùng output `standalone` (bật trong next.config.ts) → chỉ ~120MB,
# không cần cài lại node_modules, chạy bằng user không phải root.
# =============================================================================

ARG NODE_IMAGE=node:22-alpine

# -----------------------------------------------------------------------------
# Stage 1 — deps
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2 — build
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# --- Cấu hình công khai, nhúng lúc build (khớp admin-web/.env.example) --------
# API backend (NestJS gateway)
# Trình duyệt gọi API qua chính tên miền admin (same-origin), Next chuyển tiếp
# sang backend — xem next.config.ts. Để tương đối là bỏ hẳn CORS khỏi bài toán.
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
# Đích chuyển tiếp phía MÁY CHỦ. Next nạp giá trị này lúc build (routes-manifest),
# đổi xong phải build lại image chứ không chỉ đổi biến rồi `up`.
ARG API_PROXY_TARGET=http://backend:3001
# Bật dữ liệu giả lập khi chưa đấu nối backend — production PHẢI để false
ARG NEXT_PUBLIC_USE_MOCKS=false
# Thông tin đơn vị hành chính hiển thị trên shell
ARG NEXT_PUBLIC_ORG_NAME=
ARG NEXT_PUBLIC_ORG_PARENT=
ARG NEXT_PUBLIC_ORG_SHORT=VG
# Phiên bản hiển thị ở chân sidebar (CI truyền số build / git tag vào đây)
ARG NEXT_PUBLIC_APP_VERSION=0.0.0
# Tài khoản demo — CHỈ dùng cho chế độ mock, để trống ở production
ARG NEXT_PUBLIC_DEMO_USERNAME=
ARG NEXT_PUBLIC_DEMO_PASSWORD=
# Bản đồ kinh tế số — provider chốt sau (câu hỏi mở #2): vietmap | goong | maplibre | mock
ARG NEXT_PUBLIC_MAP_PROVIDER=mock
ARG NEXT_PUBLIC_MAP_API_KEY=

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    API_PROXY_TARGET=${API_PROXY_TARGET} \
    NEXT_PUBLIC_USE_MOCKS=${NEXT_PUBLIC_USE_MOCKS} \
    NEXT_PUBLIC_ORG_NAME=${NEXT_PUBLIC_ORG_NAME} \
    NEXT_PUBLIC_ORG_PARENT=${NEXT_PUBLIC_ORG_PARENT} \
    NEXT_PUBLIC_ORG_SHORT=${NEXT_PUBLIC_ORG_SHORT} \
    NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION} \
    NEXT_PUBLIC_DEMO_USERNAME=${NEXT_PUBLIC_DEMO_USERNAME} \
    NEXT_PUBLIC_DEMO_PASSWORD=${NEXT_PUBLIC_DEMO_PASSWORD} \
    NEXT_PUBLIC_MAP_PROVIDER=${NEXT_PUBLIC_MAP_PROVIDER} \
    NEXT_PUBLIC_MAP_API_KEY=${NEXT_PUBLIC_MAP_API_KEY}

# Tắt telemetry của Next để build offline / trong mạng nội bộ không bị treo mạng
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runtime
# `.next/standalone` đã kèm sẵn node_modules tối thiểu + server.js;
# `public/` và `.next/static` phải copy thủ công thì server.js mới phục vụ được.
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
RUN apk add --no-cache tini
WORKDIR /app

# server.js của bản standalone đọc HOSTNAME/PORT lúc chạy;
# đặt 0.0.0.0 để container nhận kết nối từ bên ngoài (mặc định là localhost).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0
ARG PORT=3000
ENV PORT=${PORT}

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static     ./.next/static
COPY --from=build --chown=node:node /app/public           ./public

# User `node` (uid 1000) có sẵn trong ảnh node:alpine — không tạo user mới.
USER node

EXPOSE ${PORT}

# Trang chủ trả 200 là đủ để coi Next server đã sẵn sàng.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/',timeout:4000},r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
