---
description: Đối chiếu cặp .env.local / .env.example của 4 nơi, kiểm biến thiếu và secret đặt sai tiền tố
allowed-tools: Read, Bash, Grep
---

# /kiem-tra-env

Đối chiếu **tên biến** giữa tệp giá trị thật và tệp mẫu. **Chỉ so tên, không đọc và
không in giá trị.**

## Bốn cặp tệp

| Nơi | Giá trị thật | Mẫu |
|---|---|---|
| Gốc dự án (cho `docker-compose.yml`) | `.env` | `.env.example` |
| Backend | `backend/.env.local` | `backend/.env.example` |
| Web Quản trị | `admin-web/.env.local` | `admin-web/.env.example` |
| Zalo Mini App | `zalo-miniapp/.env.local` | `zalo-miniapp/.env.example` |


## Lệnh

```bash
for pair in ".:.env" "backend:.env.local" "admin-web:.env.local" "zalo-miniapp:.env.local"; do
  dir="${pair%%:*}"; real="${pair##*:}"
  [ -f "$dir/$real" ] || { echo "== $dir: thiếu $real =="; continue; }
  echo "== $dir =="
  echo "-- có giá trị thật nhưng THIẾU trong .env.example --"
  keys() { grep -oE '^[A-Z][A-Z0-9_]*=' "$1" 2>/dev/null | tr -d '=' | sort -u; }
  comm -23 <(keys "$dir/$real") <(keys "$dir/.env.example")
  echo "-- có trong mẫu nhưng chưa đặt ở máy này --"
  comm -13 <(keys "$dir/$real") <(keys "$dir/.env.example")
done

# Secret đặt sau tiền tố CÔNG KHAI — biến này nằm trong bundle gửi trình duyệt
grep -hoE '^(NEXT_PUBLIC_|VITE_)[A-Z0-9_]*' admin-web/.env* zalo-miniapp/.env* 2>/dev/null \
  | sort -u | grep -iE 'SECRET|PASSWORD|TOKEN|PRIVATE|CREDENTIAL|_KEY$|APIKEY|BYPASS|SALT'

# Biến backend đã khai trong configuration.ts chưa
grep -oE 'process\.env\.[A-Z0-9_]+' backend/libs/shared/src/config/configuration.ts | sort -u

# Biến truyền qua Docker
grep -oE '\$\{[A-Z0-9_]+' docker-compose.yml | tr -d '${' | sort -u
```

## Cần kiểm thêm bằng mắt

| # | Việc |
|---|------|
| 1 | Biến mới của backend đã khai trong `libs/shared/src/config/configuration.ts` chưa? |
| 2 | Biến mới của `admin-web` / `zalo-miniapp` đã khai trong `src/config/app.config.ts` chưa? |
| 3 | Biến cần truyền qua Docker đã có trong `docker-compose.yml` **và** `.env.example` gốc chưa? |
| 4 | Biến đọc bằng `envText`/`envNumber`/`envFlag` chứ không phải `??` trần? (Docker sinh ra **chuỗi rỗng**, `??` sẽ nhận) |
| 5 | Có secret nào lọt vào `NEXT_PUBLIC_*` / `VITE_*` không? |

## Định dạng báo cáo

```
### Thiếu trong .env.example (người clone repo sẽ thiếu mà không biết)
| Nơi | Tên biến |

### Có trong mẫu nhưng chưa đặt ở máy này
| Nơi | Tên biến |

### ⚠ Secret đặt sau tiền tố công khai
| Tên biến | Vì sao nguy hiểm |

### Biến chưa khai trong tệp cấu hình tập trung
### Biến chưa truyền qua Docker
```

## KHÔNG BAO GIỜ

- Đọc `.env.local` rồi in nội dung ra chat / commit / tài liệu — nói **tên** biến, không nói giá trị
- Sao giá trị thật từ `.env.local` sang `.env.example`
- Tự sinh giá trị cho một secret còn thiếu — **hỏi người dùng**

→ `rules/critical/bi-mat-cau-hinh.md` · `skills/trien-khai-docker`
