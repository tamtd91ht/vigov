# Hằng số và ngưỡng ViGov
# Nạp khi: cần biết hạn mức, TTL, cổng, vai trò, trạng thái hiện hành

> Đây là **bản tra cứu**, không phải nguồn chuẩn. Nguồn chuẩn luôn là tệp mã được dẫn
> ở cột cuối. Thấy lệch nhau thì tin mã, và sửa tệp này.

## Cổng và địa chỉ (môi trường phát triển)

| Thành phần | Địa chỉ | Ghi chú |
|---|---|---|
| Backend API | `http://localhost:3001/api/v1` | `PORT`, `API_PREFIX` |
| Web Quản trị | `http://localhost:3100` | **Không** phải 3000 — cổng 3000 hay bị chiếm, Next nhảy sang 3001 và đụng backend |
| Zalo Mini App | `http://localhost:5173` | Vite |
| MongoDB | `27017` | Không mở ra Internet |
| RabbitMQ | `5672` / `15672` | Không mở ra Internet |

## Hạn mức và ngưỡng bảo mật

| Tên | Giá trị mặc định | Biến | Nguồn |
|---|---|---|---|
| Hạn mức chung | 120 lượt / 60 giây | `THROTTLE_LIMIT`, `THROTTLE_TTL_SECONDS` | `configuration.ts` |
| Hạn mức nhóm xác thực | **5 lượt / phút** (login, OTP, định danh Zalo) | `AUTH_THROTTLE` | **Không nới khi `CITIZEN_OTP_BYPASS_CODE` còn bật** |
| Số lần nhập sai OTP | 5 lần → huỷ mã | | `otp.store.ts` |
| Kích thước thân yêu cầu | `1mb` | `BODY_LIMIT` | Tệp có hạn mức riêng |
| Dung lượng mỗi tệp | 20 MB (`20971520` byte) | `STORAGE_MAX_FILE_SIZE` | Kiểm ở **cả** Multer và service |
| Hạn token đăng nhập | `8h` | `JWT_EXPIRES_IN` | Không tăng |
| Hạn refresh token | `7d` | `REFRESH_EXPIRES_IN` | Xoay vòng mỗi lượt |
| Độ trễ thu hồi phiên | ~10 giây | | Bộ đệm của `SessionRegistry` |
| TTL link tệp riêng tư | trần cứng **24 giờ** | | Không nới |
| Phiếu phản ánh / công dân / ngày | 5 | `FEEDBACK_MAX_PER_DAY` | Chống spam |
| Hiệu lực HSTS | 1 năm (`31536000`) | `HSTS_MAX_AGE` | Chỉ gắn khi `NODE_ENV=production` |
| Độ dài `JWT_SECRET` tối thiểu | 32 ký tự | | Production chặn khởi động nếu còn giá trị mẫu |
| Vòng bcrypt | 10 | | |
| Độ mạnh mật khẩu cán bộ | ≥ 10 ký tự, có chữ + số, không phải mật khẩu phổ biến, không chứa tên đăng nhập | | `password-policy.ts` |
| Nhật ký thao tác — payload tối đa | 4000 ký tự JSON | `MAX_PAYLOAD_CHARS` | `audit.interceptor.ts` |
| Thời hạn giữ nhật ký thao tác | **≥ 12 tháng** | | `SECURITY.md` mục 4 |

## Phân trang

| Tham số | Mặc định | Trần cứng |
|---|---|---|
| `page` | 1 | — |
| `size` | 20 | **100** |

## Vai trò và phân hệ

**5 vai trò:** `admin` · `leader` · `officer` · `accountant` · `receptionist`
**4 mức quyền (theo thứ bậc):** `view` (1) → `edit` (2) → `approve` (3) → `admin` (4)
**10 phân hệ có phân quyền:** `overview` `tasks` `documents` `disbursement` `feedback`
`map` `reports` `cms` `users` `settings`

Nguồn chuẩn: `backend/libs/shared/src/auth/roles.ts` ↔ `admin-web/src/config/roles.config.ts`

## Trạng thái

| Nghiệp vụ | Khoá trạng thái |
|---|---|
| Nhiệm vụ | `moi` `dang` `cho` `qua` `xong` |
| Văn bản / đơn thư | `moi` `dangxl` `choduyet` `xong` |
| Mức ưu tiên | `cao` `tb` `thap` |
| Độ khẩn văn bản | `Thường` `Khẩn` `Hoả tốc` |
| Nguồn nhiệm vụ | `vb` `pa` `hop` |

Nhãn và màu: `admin-web/src/config/status.config.ts`

## Lĩnh vực phản ánh và SLA mặc định

8 lĩnh vực: `rac-thai` `giao-thong` `ve-sinh-moi-truong` `trat-tu-do-thi` `an-ninh`
`xay-dung` `can-bo` `khac`

SLA đo bằng **ngày làm việc**, mỗi lĩnh vực có `intakeDays` + `resolveDays` + `warnBefore`.
Nguồn chuẩn: `admin-web/src/config/sla.config.ts` (`defaultSlaRules`).

> ⚠ **Nợ đã biết:** giá trị SLA mặc định đang **lặp lại** ở
> `backend/apps/api-gateway/src/modules/settings/settings.service.ts` và `seed.ts`.
> Hai nguồn chuẩn cho cùng một thứ. Khi chạm vào, gom về một nguồn.

## Nhà cung cấp bên thứ ba

| Dịch vụ | Biến chọn | Mặc định |
|---|---|---|
| OCR văn bản | `OCR_PROVIDER` | `mock` (câu hỏi mở #1) |
| Đọc thẻ căn cước | `IDCARD_PROVIDER` | `mock` |
| Bản đồ / GIS | `GEO_PROVIDER` | `mock`; nền bản đồ thật: OpenFreeMap qua MapLibre (câu hỏi mở #3) |
| Đẩy thông báo | `PUSH_PROVIDER` | `mock` |
| Kho tệp | `STORAGE_DRIVER` | `local` (\| `s3`) |
| Kho OTP | `OTP_STORE` | `memory` — **bắt buộc `mongo` khi chạy nhiều instance** |

## Phiên bản đã ghim

| Gói | Phiên bản | Vì sao ghim |
|---|---|---|
| `maplibre-gl` | `5.24.0` | Bản 6 làm bản đồ trắng trơn, **không báo lỗi** |
| `exceljs` | giữ nguyên | `audit fix --force` hạ xuống 3.4.0, phá API |
| `zmp-sdk` | giữ nguyên | `audit fix --force` hạ xuống 2.9.4; chờ Zalo phát hành bản mới |

## Lệnh kiểm chứng

| Việc | Lệnh | Ở đâu |
|---|---|---|
| Type-check + lint cả 4 module | `npm run check:all` | gốc |
| Test đơn vị backend | `npm test` | `backend/` |
| Test e2e backend | `npm run test:e2e` | `backend/` (cần ≥ 500 MB trống ở thư mục tạm) |
| Type-check + lint web | `npx tsc --noEmit && npm run lint` | `admin-web/`, `zalo-miniapp/` |
| Flutter | `flutter analyze && flutter test` | `mobile/` |
