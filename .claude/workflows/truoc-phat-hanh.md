# Quy trình: Trước khi phát hành

Dùng khi: chuẩn bị phát hành, chuẩn bị UAT, hoặc bàn giao cho khách hàng.

## Nguyên tắc

Đây là hệ thống của cơ quan nhà nước, phục vụ toàn bộ dân số một xã. **Không phát hành
với một hạng mục "chắc là ổn".** Mỗi mục dưới đây phải trả lời được: **đã làm / chưa làm
/ không áp dụng** — kèm bằng chứng.

---

## 1. Kiểm chứng kỹ thuật

| # | Việc | Lệnh |
|---|------|------|
| 1 | Type-check + lint cả 3 module | `npm run check:all` (gốc) |
| 2 | Test đơn vị backend | `cd backend && npm test` |
| 3 | Test e2e backend | `cd backend && npm run test:e2e` |
| 4 | Rà phụ thuộc | `npm audit --production` ở 3 module Node (**chỉ đọc**, không `audit fix`) |
| 5 | Dựng thử bằng Docker | `docker compose config` rồi `docker compose up -d` |

Test đỏ hoặc lint đỏ → **không phát hành**. Dán nguyên văn kết quả vào báo cáo.

## 2. Mười hai việc BẮT BUỘC trước production

Đối chiếu từng mục với `SECURITY.md` mục 4. Rút gọn:

| # | Việc | Cách kiểm |
|---|------|---|
| 0 | **Xoá `CITIZEN_OTP_BYPASS_CODE`** (để trống) | `docker compose logs backend \| grep "mã tạm thời"` xem đã có ai dùng |
| 1 | Đổi `JWT_SECRET` — ngẫu nhiên ≥ 32 ký tự, lưu trong trình quản lý bí mật | Production chặn khởi động nếu còn giá trị mẫu |
| 2 | Bật HTTPS/TLS, chuyển hướng HTTP → HTTPS | HSTS chỉ gắn khi `NODE_ENV=production` |
| 3 | `CORS_ORIGINS` là tên miền thật + `https://h5.zdn.vn` | Để `*` sẽ **không khởi động được** (cố ý) |
| 4 | `TRUST_PROXY` đúng số lớp proxy (thường `1`) | Nếu không, rate-limit và log ghi nhầm IP |
| 5 | Bật xác thực MongoDB, chặn cổng 27017 khỏi Internet | |
| 6 | `OTP_STORE=mongo` nếu chạy nhiều hơn một instance | |
| 7 | Bật xác thực RabbitMQ, xoá `guest/guest` | |
| 8 | Sao lưu MongoDB hằng ngày, giữ ≥ 30 bản, **đã kiểm thử khôi phục** | `deploy/backup-mongo.sh` |
| 9 | Thư mục `uploads` ngoài thư mục mã, quyền `0750`, **không** để nginx phục vụ tĩnh | |
| 10 | Ba client dùng xác thực thật, gỡ hết `NEXT_PUBLIC_DEMO_*` | |
| 11 | Mọi tệp nghiệp vụ tải lên với `isPrivate = true` | Đã cưỡng chế bằng `findPrivateById` |
| 12 | Bật log tập trung, giữ nhật ký thao tác **≥ 12 tháng** | |

## 3. Cờ môi trường phải TẮT

| Cờ | Giá trị đúng ở production |
|---|---|
| `NEXT_PUBLIC_USE_MOCKS` | `false` |
| `NEXT_PUBLIC_DEMO_USER`, `NEXT_PUBLIC_DEMO_PASSWORD` | **để trống** |
| `VITE_DEMO_MODE` | `false` |
| `CITIZEN_OTP_BYPASS_CODE` | **để trống** |

## 4. Rà soát bằng agent

| Agent | Kết quả cần |
|---|---|
| `agents/ra-soat-bao-mat.md` | Không còn phát hiện mức **CAO** chưa xử lý |
| `agents/ra-soat-tuan-thu.md` | Mức độ sẵn sàng bàn giao: **Đạt** hoặc **Đạt có điều kiện** kèm điều kiện rõ |
| `agents/kiem-thu.md` | Tất cả lệnh kiểm chứng xanh |
| `agents/dong-bo-tai-lieu.md` | Tài liệu khớp hiện trạng mã |

## 5. Tài liệu bàn giao

| Tệp | Kiểm |
|---|---|
| `README.md` | Cách chạy đúng hiện trạng; bảng xử lý sự cố đủ |
| `SECURITY.md` | Mọi phát hiện có trạng thái đúng; mục 4 và mục 5 cập nhật |
| `BAO-CAO-TIEN-DO.md` | Tiến độ khớp `pending-tasks.json` |
| `docs/01..03-*.md` | Endpoint, luồng, màn hình khớp mã |
| `docs/04-TRIEN-KHAI-VPS.md` | Runbook chạy được từ máy chủ trống |
| `docs/06-VAN-HANH.md` | Sao lưu, cập nhật, xử lý sự cố đúng hiện trạng |
| `docs/07-UAT-VA-NGHIEM-THU.md` | Kế hoạch UAT có người, có mốc |
| `docs/08..11-ZALO-*.md` | Hồ sơ phát hành và xin quyền Zalo đủ |
| `docs/README.md` | Chỉ mục khớp danh sách tệp thật |

## 6. Ghi rõ những gì NGOÀI phạm vi

Phải nói ra, không được để người đọc tưởng đã có (`SECURITY.md` mục 5):
pentest độc lập · WAF · SIEM · mã hoá ở tầng lưu trữ · quản lý bí mật tập trung · MFA
cho quản trị · **đánh giá tuân thủ NĐ 13/2023 và cấp độ an toàn theo NĐ 85/2016** ·
SAST/DAST trong CI · diễn tập khôi phục sau thảm hoạ.

**Không khẳng định hệ thống "tuân thủ NĐ 13/2023"** — Phase 1 chưa có đánh giá chính thức.

## 7. Định dạng báo cáo cuối

```
## Sẵn sàng phát hành: <Chưa | Có điều kiện | Có>

### Chặn phát hành
### Điều kiện kèm theo (phải làm khi triển khai)
### Đã kiểm và đạt
### Ngoài phạm vi Phase 1
```

→ `workflows/_INDEX.md` · `agents/ra-soat-tuan-thu.md` · `SECURITY.md`
