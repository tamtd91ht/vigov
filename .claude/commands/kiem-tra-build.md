---
description: Chạy toàn bộ kiểm chứng ViGov — type-check, lint, test đơn vị, test e2e, Flutter
argument-hint: "[module: backend | admin-web | zalo-miniapp | mobile | all] — bỏ trống thì all"
allowed-tools: Read, Bash
---

# /kiem-tra-build

Chạy kiểm chứng **thật** và báo cáo kết quả thật. Không suy đoán.

## Phạm vi

| `$1` | Chạy gì |
|---|---|
| bỏ trống / `all` | Cả 4 module |
| `backend` | type-check + test đơn vị + test e2e |
| `admin-web` | type-check + lint |
| `zalo-miniapp` | type-check + lint |
| `mobile` | `flutter analyze` + `flutter test` |

## Lệnh

```bash
# Cả 4 module — type-check + lint
npm run check:all

# Backend
cd backend
npx tsc --noEmit -p apps/api-gateway/tsconfig.app.json
npm test
npm run test:e2e

# Admin web / Mini App
cd admin-web && npx tsc --noEmit && npm run lint
cd zalo-miniapp && npx tsc --noEmit && npm run lint

# Flutter
cd mobile && flutter analyze && flutter test
```

## Định dạng báo cáo

```
| Lệnh | Kết quả |
|---|---|
| npm run check:all | ✅ sạch |
| cd backend && npm test | ✅ 42 pass |
| cd backend && npm run test:e2e | ❌ 1 fail |

### Lỗi
<dán NGUYÊN VĂN phần lỗi, không tóm tắt>

### Chưa chạy được
<lệnh nào, vì sao>
```

## Sự cố hay gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `text index required for $text query` ở test e2e | Thư mục tạm còn dưới 500 MB — MongoDB từ chối tạo index | Dọn ổ, hoặc trỏ `TEMP`/`TMP` sang ổ khác |
| `tsc --noEmit` lỗi trong `.next/dev/types/validator.ts` | Cache Next sinh dở | `npm run clean` |
| `Unable to connect to the database. Retrying...` | Chưa chạy MongoDB | `cd backend && docker compose up -d` |
| `Missing script: "dev"` | Script cũ tên `start:dev` | Dùng `npm run start:dev` |

## KHÔNG BAO GIỜ

- Báo kết quả mà chưa chạy lệnh
- Tóm lỗi thành "có lỗi" — dán nguyên văn
- Nói "test pass" khi chỉ type-check xanh
- Đổi ngưỡng test để test xanh

→ `agents/kiem-thu` · `skills/kiem-thu-vigov`
