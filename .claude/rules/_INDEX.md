# Chỉ mục luật và kỹ năng — ViGov
# Cập nhật: 09/09/2026

Hai tầng:

- **`rules/critical/`** (8 tệp) — **nạp sẵn mọi phiên**. Mức "không thương lượng".
- **`skills/<tên>/SKILL.md`** (25 kỹ năng) — **nạp lười**, tự bật khi từ khoá khớp.

Tra ở đây trước khi đi tìm trong mã.

---

## LUẬT TỐI QUAN TRỌNG (8) — nạp sẵn · `rules/critical/`

| Tệp | Chặn điều gì | Có hook cưỡng chế |
|---|---|---|
| `du-lieu-ca-nhan.md` | Lộ / ghi log / gửi ra ngoài dữ liệu cá nhân công dân | ✅ `pii_guard.py` (CHẶN) |
| `cach-ly-du-lieu-cong-dan.md` | Công dân A đọc được dữ liệu công dân B | — (rà bằng agent) |
| `phan-quyen-rbac.md` | Endpoint không quyền, leo thang quyền, token không thu hồi được | ✅ `rbac_audit_guard.py` (nhắc) |
| `nhat-ky-thao-tac.md` | Thao tác ghi không để lại vết | — |
| `bao-toan-du-lieu.md` | Xoá cứng, mất dữ liệu do migration, tiêu huỷ tài liệu lưu trữ | ✅ `data_safety_guard.py` (CHẶN) |
| `bi-mat-cau-hinh.md` | Secret lọt vào mã / bundle / git; env lệch giữa hai tệp | ✅ `secret_scan.py` (CHẶN) + `env_sync_guard.py` (nhắc) |
| `khong-hardcode.md` | Giá trị riêng của một xã nằm rải trong mã | ✅ `hardcode_guard.py` (nhắc) |
| `ngon-ngu-hanh-chinh.md` | Tiếng Việt sai, thuật ngữ hành chính sai, giọng điệu sai với công dân | — (rà bằng `/ra-soat-tuan-thu`) |

**Định dạng luật:** bảng MUST / MUST NOT + điều kiện DỪNG. Trần **120 dòng**/tệp.

---

## KỸ NĂNG (25) — nạp lười · `skills/<tên>/SKILL.md`

### Backend (7)

| Kỹ năng | Nội dung |
|---|---|
| `nestjs-module-pattern` | Cấu trúc module, controller/service/schema/dto, `@vigov/shared`, đăng ký `app.module` |
| `mongoose-schema-conventions` | Trường bắt buộc, index, TTL, xoá mềm, đổi kiểu trường |
| `api-contract-design` | Đường dẫn, phương thức, phân trang, mã lỗi, tách đường cán bộ / công dân |
| `dto-validation-hardening` | `class-validator`, `forbidNonWhitelisted`, giới hạn độ dài, trường không nhận từ client |
| `tim-kiem-mongo-an-toan` | Escape `$regex`, `$text` index, `aggregate` an toàn, giới hạn truy vấn |
| `hang-doi-rabbitmq` | Hàng đợi thông báo / workflow, consumer idempotent, retry, việc theo lịch |
| `realtime-socket` | Xác thực lúc handshake, phân phòng theo quyền, không phát dữ liệu nghiệp vụ |

### Bảo mật và định danh (4)

| Kỹ năng | Nội dung |
|---|---|
| `an-toan-tep-upload` | Tệp nghiệp vụ vs nội dung công khai, MIME, link ký HMAC, path traversal |
| `phien-va-token` | JWT + `sid`, `SessionRegistry`, refresh xoay vòng, thu hồi phiên, mật khẩu tạm |
| `xac-thuc-otp-cong-dan` | OTP `crypto.randomInt`, kho HMAC, `OTP_STORE`, mã tạm `CITIZEN_OTP_BYPASS_CODE` |
| `che-du-lieu-ca-nhan` | `maskPhone` / `maskCccd`, ẩn danh theo yêu cầu xoá, **nợ 3 bản trùng** |

### Client (3)

| Kỹ năng | Nội dung |
|---|---|
| `nextjs-admin-web` | App Router, bảo vệ route ở tầng máy chủ, `NEXT_PUBLIC_*`, cấu hình, cổng 3100 |
| `zalo-miniapp-platform` | `zmp-sdk` qua adapter, quyền API Zalo, vùng an toàn, chế độ demo, webhook |
| `tiep-can-nguoi-cao-tuoi` | Cỡ chữ, vùng chạm, tương phản, biểu mẫu, thông báo lỗi cho công dân |

### Xuyên module (4)

| Kỹ năng | Nội dung |
|---|---|
| `dong-bo-kieu-4-module` | `types/index.ts` là nguồn chuẩn; sáu bước một commit khi đổi trường |
| `sla-va-trang-thai` | Ngày làm việc, ngày lễ, lưu `slaDeadline` một lần, trạng thái suy ra |
| `adapter-ben-thu-ba` | Interface + provider, bản `mock` bắt buộc, sáu câu hỏi trước khi nối |
| `ke-thua-truoc-khi-viet-moi` | Tìm trước khi viết, gom bản trùng, nơi đặt mã dùng chung |

### Quy trình (7)

| Kỹ năng | Nội dung |
|---|---|
| `kiem-thu-vigov` | Lệnh kiểm chứng, bảng "thay đổi nào cần test gì" |
| `tai-lieu-dong-bo` | Bảng tra "sửa gì thì cập nhật tài liệu gì" |
| `quan-ly-task-plan` | `pending-tasks.json`, `plans/`, câu hỏi mở của khách |
| `quyet-dinh-kien-truc` | Khi nào ghi ADR, khuôn mẫu, các quyết định chưa thành ADR |
| `trien-khai-docker` | Cạm bẫy biến môi trường rỗng, CORS, nginx, việc bắt buộc trước production |
| `bao-cao-va-xuat-file` | Số liệu phải đúng, xuất Excel/PDF/PPTX, che dữ liệu trong tệp xuất |
| `tuan-thu-phap-ly` | NĐ 13/2023, NĐ 85/2016, lưu trữ, điều kiện DỪNG để hỏi |

---

## TRA NHANH THEO VIỆC ĐANG LÀM

| Đang làm | Đọc |
|---|---|
| Thêm endpoint | `phan-quyen-rbac` · `api-contract-design` · `dto-validation-hardening` · `workflows/them-endpoint` |
| Chạm số điện thoại / CCCD / ảnh công dân | `du-lieu-ca-nhan` · `che-du-lieu-ca-nhan` · `workflows/xu-ly-du-lieu-ca-nhan` |
| Đường dành cho công dân | `cach-ly-du-lieu-cong-dan` · `xac-thuc-otp-cong-dan` |
| Xoá / đổi schema / di trú | `bao-toan-du-lieu` · `mongoose-schema-conventions` · `workflows/doi-truong-du-lieu` |
| Tệp, đính kèm, ảnh | `an-toan-tep-upload` |
| Đăng nhập, token, khoá tài khoản | `phien-va-token` |
| Thêm biến môi trường | `bi-mat-cau-hinh` · `trien-khai-docker` |
| Đổi tên trường | `dong-bo-kieu-4-module` · `workflows/doi-truong-du-lieu` |
| Tính hạn, trạng thái | `sla-va-trang-thai` |
| Báo cáo, thống kê, xuất tệp | `bao-cao-va-xuat-file` |
| Nối dịch vụ ngoài | `adapter-ben-thu-ba` · `workflows/tich-hop-ben-thu-ba` |
| Giao diện công dân | `tiep-can-nguoi-cao-tuoi` · `ngon-ngu-hanh-chinh` |
| Giao diện cán bộ | `nextjs-admin-web` · `khong-hardcode` |
| Chuẩn bị phát hành | `workflows/truoc-phat-hanh` · `agents/ra-soat-tuan-thu` |

---

## GIỚI HẠN KÍCH THƯỚC

| Loại | Trần dòng |
|---|---|
| `rules/critical/*.md` | 120 |
| `skills/**/SKILL.md` | 250 |
| `agents/*.md` | 200 |
| `commands/*.md` | 150 |
| `workflows/*.md` | 200 |

Vượt trần: tách tệp, chuyển mã sang `skills/`, chuyển văn xuôi sang `docs/`.
**Không** nhân bản nội dung — luôn tham chiếu chéo.

HẾT
