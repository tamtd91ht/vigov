---
name: adapter-ben-thu-ba
description: Dùng khi tích hợp hoặc đổi nhà cung cấp dịch vụ bên ngoài — OCR, đọc thẻ căn cước, bản đồ/GIS, ZNS, FCM, S3/MinIO, SMS. Kích hoạt bởi: adapter, provider, tích hợp, bên thứ 3, OCR, idcard, căn cước, GIS, bản đồ, maplibre, ZNS, FCM, push, SMS, S3, MinIO, nhà cung cấp, mock provider, đổi provider.
---

# Kỹ năng: Adapter cho dịch vụ bên thứ ba
# Mức: CAO | Ngăn: khoá cứng vào một nhà cung cấp, dữ liệu cá nhân gửi ra ngoài không kiểm soát

## Nguyên tắc gốc của dự án

"Adapter cho mọi dịch vụ bên thứ 3: đổi nhà cung cấp chỉ sửa **một** tệp adapter, không
đụng vào tầng nghiệp vụ." (`CLAUDE.md` gốc dự án)

Với ứng dụng nhà nước còn thêm một lý do nữa: **nhà cung cấp là thứ khách hàng sẽ đổi**.
Đấu thầu lại, hết hợp đồng, quy định mới về nơi lưu dữ liệu — tất cả dẫn tới đổi nhà cung
cấp. Nếu tên nhà cung cấp nằm rải trong tầng nghiệp vụ, mỗi lần đổi là một lần viết lại.

## Adapter đang có

| Dịch vụ | Biến chọn | Thư mục | Trạng thái |
|---|---|---|---|
| OCR văn bản | `OCR_PROVIDER` | `modules/integrations/ocr/` | `mock` — câu hỏi mở #1 |
| Đọc thẻ căn cước | `IDCARD_PROVIDER` | `modules/integrations/idcard/` | `mock` — tách khỏi OCR vì khác nhà cung cấp, khác bộ trường, chịu ràng buộc NĐ 13/2023 |
| Bản đồ / GIS | `GEO_PROVIDER` | `modules/integrations/geo/` | `mock`; nền bản đồ thật đang dùng OpenFreeMap qua MapLibre — nhà cung cấp CHÍNH THỨC là câu hỏi mở #3 |
| Zalo (định danh, ZNS) | `ZALO_*` | `libs/shared/src/zalo/`, `modules/zalo-webhook/` | Thật, một phần chờ quyền |
| Đẩy thông báo | `PUSH_PROVIDER` | `modules/notification/providers/` | `mock` |
| Kho tệp | `STORAGE_DRIVER` | `modules/files/drivers/` | `local` \| `s3` |

## MUST

| # | Luật |
|---|------|
| 1 | Mỗi dịch vụ có **một interface** (`*.provider.ts`) + các bản cài đặt. Tầng nghiệp vụ chỉ biết interface |
| 2 | Chọn bản cài đặt bằng **biến môi trường** `*_PROVIDER`, đọc qua `ConfigService` |
| 3 | **Luôn** có bản cài đặt `mock` chạy được không cần mạng, không cần khoá — để phát triển và test |
| 4 | Bản `mock` trả dữ liệu **rõ ràng là giả** (không phải dữ liệu thật của khách) |
| 5 | Gọi ra ngoài **luôn** có giới hạn thời gian chờ; hết thời gian thì nghiệp vụ chính vẫn hoàn tất |
| 6 | Lỗi từ bên thứ ba **không** làm hỏng nghiệp vụ chính — bắt lỗi, ghi log, trả trạng thái "chưa xử lý được" để thử lại |
| 7 | Chỉ gửi ra ngoài **đúng trường tối thiểu** cần cho việc đó → `rules/critical/du-lieu-ca-nhan.md` |
| 8 | Ghi lại **đã gửi gì cho ai lúc nào** (không ghi nội dung dữ liệu cá nhân) — cần cho việc giải trình theo NĐ 13/2023 |
| 9 | Khoá API đọc từ `ConfigService`, khai trong `configuration.ts` + cả hai tệp env |
| 10 | Thêm nhà cung cấp mới → cập nhật `SECURITY.md` (dữ liệu gì ra khỏi hệ thống) và `docs/01-BACKEND.md` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Gọi trực tiếp SDK/HTTP của bên thứ ba từ service nghiệp vụ hoặc từ component |
| 2 | Viết cứng URL, khoá API, hay tên nhà cung cấp trong tầng nghiệp vụ |
| 3 | Gửi **toàn bộ** bản ghi ra ngoài khi chỉ cần một trường |
| 4 | Gửi dữ liệu thẻ căn cước, nội dung đơn thư ra một dịch vụ chưa được chốt về mặt pháp lý — **hỏi trước** |
| 5 | Bỏ bản `mock` khi đã có bản thật (mất khả năng phát triển và test offline) |
| 6 | Gọi ra ngoài trong vòng lặp không có hạn mức |
| 7 | Lưu kết quả từ bên thứ ba làm nguồn chuẩn mà không lưu cả thời điểm và nhà cung cấp đã trả |

## Trước khi nối một dịch vụ ngoài mới — trả lời 6 câu

1. Dữ liệu gì ra khỏi hệ thống? Có dữ liệu cá nhân không?
2. Cơ sở pháp lý để gửi dữ liệu đó là gì? (NĐ 13/2023 yêu cầu có)
3. Dữ liệu lưu ở đâu, nhà cung cấp giữ bao lâu?
4. Dịch vụ chết thì nghiệp vụ nào dừng, và có đường dự phòng gì?
5. Khoá API để ở đâu, ai xoay khoá?
6. Đã có bản `mock` chưa?

Chưa trả lời được câu 1–3 thì **chưa nối** — nêu ra và hỏi.

→ `rules/critical/du-lieu-ca-nhan.md` · `rules/critical/bi-mat-cau-hinh.md` · `data/tuan-thu-phap-ly.md`
