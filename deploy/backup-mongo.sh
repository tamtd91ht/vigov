#!/usr/bin/env bash
# =============================================================================
# ViGov — Sao lưu MongoDB (P4-34)
#
# Chạy từ THƯ MỤC GỐC dự án (nơi có docker-compose.yml và .env):
#     bash deploy/backup-mongo.sh
#
# Cơ chế: gọi mongodump BÊN TRONG container mongo, ghi ra /backups — thư mục
# này được bind-mount tới ${BACKUP_DIR} trên host (xem docker-compose.yml).
# Không cần cài mongo-tools trên máy chủ.
#
# Thông tin đăng nhập đọc từ .env, KHÔNG truyền qua tham số dòng lệnh
# (tham số hiện trong `ps` — ai đăng nhập máy chủ cũng đọc được).
# =============================================================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  echo "Không tìm thấy .env tại $PROJECT_DIR — hãy tạo từ .env.example." >&2
  exit 1
fi

# Nạp .env (chỉ để lấy tên user/db; mật khẩu truyền thẳng vào container qua env).
set -a
# shellcheck disable=SC1091
. ./.env
set +a

MONGO_DATABASE="${MONGO_DATABASE:-vigov}"
# Số ngày giữ bản sao lưu; đặt RETENTION_DAYS trong .env để đổi.
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="vigov-${MONGO_DATABASE}-${STAMP}.archive.gz"

echo "[backup] Bắt đầu sao lưu ${MONGO_DATABASE} → ${ARCHIVE}"

# --archive + --gzip: một file duy nhất, nén sẵn, khôi phục bằng mongorestore.
docker compose exec -T \
  -e MONGO_ROOT_USERNAME="${MONGO_ROOT_USERNAME}" \
  -e MONGO_ROOT_PASSWORD="${MONGO_ROOT_PASSWORD}" \
  mongo sh -c "mongodump \
      --username \"\$MONGO_ROOT_USERNAME\" \
      --password \"\$MONGO_ROOT_PASSWORD\" \
      --authenticationDatabase admin \
      --db ${MONGO_DATABASE} \
      --archive=/backups/${ARCHIVE} \
      --gzip \
      --quiet"

BACKUP_DIR_HOST="${BACKUP_DIR:-./backups}"
echo "[backup] Xong: ${BACKUP_DIR_HOST}/${ARCHIVE}"

# --- Dọn bản cũ ---------------------------------------------------------------
# Giữ RETENTION_DAYS ngày gần nhất. Bản sao lưu hàng tuần nên được đồng bộ
# sang máy/ổ cứng KHÁC (xem deploy/README.md) — chỉ giữ tại chỗ là chưa an toàn.
find "${BACKUP_DIR_HOST}" -name 'vigov-*.archive.gz' -type f \
     -mtime "+${RETENTION_DAYS}" -print -delete || true

echo "[backup] Hoàn tất."
