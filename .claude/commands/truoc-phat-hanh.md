---
description: Rà soát đầy đủ trước khi phát hành / UAT / bàn giao ViGov — kiểm chứng, 12 việc bắt buộc, tuân thủ, tài liệu
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /truoc-phat-hanh

Theo `workflows/truoc-phat-hanh.md`. Lệnh này **chỉ đọc và báo cáo** — không tự sửa.

## Nguyên tắc

Đây là hệ thống của cơ quan nhà nước, phục vụ toàn bộ dân số một xã. Mỗi hạng mục phải
trả lời được **đã làm / chưa làm / không áp dụng** kèm **bằng chứng**.
Không có mục nào được để là "chắc là ổn".

## Năm phần

### 1. Kiểm chứng kỹ thuật

```bash
npm run check:all
cd backend && npm test && npm run test:e2e
cd backend && npm audit --production          # chỉ đọc, KHÔNG audit fix
cd admin-web && npm audit --production
cd zalo-miniapp && npm audit --production
docker compose config
```

Test đỏ hoặc lint đỏ → **không phát hành**.

### 2. Mười hai việc BẮT BUỘC trước production

Đối chiếu từng mục với `SECURITY.md` mục 4:

```bash
# Cờ nguy hiểm còn bật?  (chỉ kiểm CÓ/KHÔNG có giá trị — không in giá trị)
for f in .env backend/.env.local; do
  [ -f "$f" ] && grep -E '^(CITIZEN_OTP_BYPASS_CODE|JWT_SECRET|CORS_ORIGINS|TRUST_PROXY|OTP_STORE|NODE_ENV)=' "$f" \
    | sed -E 's/=(.*)$/= <đã ẩn, dài \1 >/; s/dài (.*) >/có giá trị>/' && echo "-- $f --"
done

# Mock / demo còn bật?
grep -rE '^(NEXT_PUBLIC_USE_MOCKS|NEXT_PUBLIC_DEMO_USER|NEXT_PUBLIC_DEMO_PASSWORD|VITE_DEMO_MODE)=' \
  admin-web/.env* zalo-miniapp/.env* 2>/dev/null
```

### 3. Rà soát bằng agent

| Agent | Kết quả cần |
|---|---|
| `agents/ra-soat-bao-mat` | Không còn phát hiện mức **CAO** chưa xử lý |
| `agents/ra-soat-tuan-thu` | Sẵn sàng bàn giao: **Đạt** hoặc **Đạt có điều kiện** kèm điều kiện rõ |
| `agents/dong-bo-tai-lieu` | Tài liệu khớp hiện trạng mã |

### 4. Tài liệu bàn giao

`README.md` · `SECURITY.md` · `BAO-CAO-TIEN-DO.md` · `docs/01..11-*.md`
(chỉ mục ở `docs/README.md`) · `k8s/README.md`

### 5. Ghi rõ những gì NGOÀI phạm vi

Phải nói ra để người đọc không tưởng đã có (`SECURITY.md` mục 5): pentest độc lập · WAF ·
SIEM · mã hoá ở tầng lưu trữ · quản lý bí mật tập trung · MFA cho quản trị ·
**đánh giá tuân thủ NĐ 13/2023 và cấp độ an toàn theo NĐ 85/2016** · SAST/DAST trong CI ·
diễn tập khôi phục sau thảm hoạ.

## Định dạng báo cáo

```
## Sẵn sàng phát hành: <Chưa | Có điều kiện | Có>

### Chặn phát hành
| # | Vấn đề | Bằng chứng | Việc phải làm |

### Điều kiện kèm theo (phải làm khi triển khai)
### Đối chiếu 12 việc bắt buộc trước production
| # | Việc | Trạng thái | Bằng chứng |

### Kết quả kiểm chứng
| Lệnh | Kết quả |

### Đã kiểm và đạt
### Ngoài phạm vi Phase 1
```

## KHÔNG BAO GIỜ

- Đánh giá **Có** khi còn `CITIZEN_OTP_BYPASS_CODE` bật, `JWT_SECRET` mẫu, hoặc `CORS_ORIGINS=*`
- Khẳng định "tuân thủ NĐ 13/2023" — Phase 1 chưa có đánh giá chính thức
- In **giá trị** của biến môi trường vào báo cáo (chỉ nói có/không có giá trị)
- Chạy `npm audit fix` (hạ `exceljs` và `zmp-sdk` xuống bản phá vỡ API)

→ `workflows/truoc-phat-hanh` · `agents/ra-soat-tuan-thu` · `SECURITY.md`
