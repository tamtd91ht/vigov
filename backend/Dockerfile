# syntax=docker/dockerfile:1.7
# =============================================================================
# ViGov — Backend (NestJS 11 monorepo, app `api-gateway`)
#
# Multi-stage: deps → build → prod-deps → runtime.
#   - Tách `deps` (đủ devDependencies để `nest build`) khỏi `prod-deps`
#     (`npm ci --omit=dev`) để ảnh cuối không mang theo TypeScript/Jest/Nest CLI.
#   - Ảnh cuối dựa trên node:22-alpine (~60MB) và chạy bằng user `node`
#     (uid 1000) — KHÔNG chạy root, theo yêu cầu bảo mật hạ tầng nhà nước.
#   - Mọi cấu hình nạp qua biến môi trường (xem backend/.env.example);
#     TUYỆT ĐỐI không nướng secret vào image.
# =============================================================================

ARG NODE_IMAGE=node:22-alpine

# -----------------------------------------------------------------------------
# Stage 1 — deps: cài đầy đủ dependencies (kể cả dev) để phục vụ bước build.
# Chỉ copy manifest trước để tận dụng layer cache của Docker: khi mã nguồn đổi
# mà package-lock.json không đổi thì layer `npm ci` được dùng lại.
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2 — build: biên dịch TypeScript sang JS bằng Nest CLI.
# `nest build` xuất ra dist/apps/api-gateway/{apps,libs}/… (giữ nguyên cây thư
# mục vì monorepo có 2 rootDir: apps/ và libs/), đồng thời tự viết lại alias
# `@vigov/shared` thành đường dẫn tương đối ⇒ runtime KHÔNG cần tsconfig-paths.
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — prod-deps: cây node_modules chỉ gồm dependencies chạy thật.
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 4 — runtime
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

# tini làm PID 1: chuyển tiếp SIGTERM tới Node và thu gom zombie process,
# giúp `docker compose down` / rolling update dừng container gọn gàng.
RUN apk add --no-cache tini

WORKDIR /app
ENV NODE_ENV=production

# Cổng lắng nghe — đọc lại từ ENV lúc chạy (main.ts: config.get('PORT', 3001)).
# Khai báo qua ARG để có thể đổi lúc build mà EXPOSE vẫn khớp.
ARG PORT=3001
ENV PORT=${PORT}

# Tiền tố REST (main.ts: app.setGlobalPrefix). Dùng cả cho HEALTHCHECK bên dưới.
ARG API_PREFIX=api/v1
ENV API_PREFIX=${API_PREFIX}

# Thư mục lưu tệp khi STORAGE_DRIVER=local — mount volume vào đây ở compose.
ENV STORAGE_LOCAL_DIR=/app/uploads

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build     --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./

# Tạo sẵn thư mục uploads thuộc sở hữu user `node` để tiến trình không-root ghi được.
RUN mkdir -p ${STORAGE_LOCAL_DIR} && chown -R node:node ${STORAGE_LOCAL_DIR}

USER node

EXPOSE ${PORT}

# HEALTHCHECK gọi `GET {API_PREFIX}/health/ready` (health.controller.ts) — endpoint
# công khai kiểm tra cả tiến trình HTTP lẫn kết nối MongoDB, trả 503 khi DB rớt.
# Dùng module http của Node để không phải cài thêm curl/wget vào ảnh.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "const http=require('http');const p=process.env.PORT||3001;const x=(process.env.API_PREFIX||'api/v1').replace(/^\/|\/$/g,'');http.get({host:'127.0.0.1',port:p,path:'/'+x+'/health/ready',timeout:4000},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/apps/api-gateway/apps/api-gateway/src/main"]
