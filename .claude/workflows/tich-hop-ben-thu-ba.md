# Quy trình: Nối một dịch vụ bên thứ ba

Dùng khi: tích hợp OCR, đọc thẻ căn cước, GIS/bản đồ, ZNS, FCM, SMS, S3/MinIO, hoặc bất
kỳ dịch vụ ngoài nào.

## Sáu câu hỏi phải trả lời TRƯỚC khi viết mã

| # | Câu hỏi | Chưa trả lời được thì |
|---|---|---|
| 1 | **Dữ liệu gì ra khỏi hệ thống?** Có dữ liệu cá nhân không? | **DỪNG** — hỏi |
| 2 | **Cơ sở pháp lý** để gửi dữ liệu đó là gì? (NĐ 13/2023 yêu cầu có) | **DỪNG** — hỏi khách hàng |
| 3 | Dữ liệu lưu ở đâu, nhà cung cấp giữ bao lâu? | **DỪNG** — hỏi |
| 4 | Dịch vụ chết thì nghiệp vụ nào dừng? Có đường dự phòng gì? | Thiết kế đường dự phòng |
| 5 | Khoá API để ở đâu, ai xoay khoá? | `.env.local` + `.env.example` + `configuration.ts` |
| 6 | Đã có bản `mock` chưa? | Viết bản `mock` trước |

Câu 1–3 là **chặn cứng**. Không có câu trả lời thì không nối — kể cả khi việc đó làm
tính năng chậm lại.

## Bước

| # | Việc | Kiểm chứng |
|---|---|---|
| 1 | Trả lời sáu câu hỏi trên, ghi lại | Có văn bản, không phải nhớ trong đầu |
| 2 | Khai **interface** ở `modules/integrations/<dịch-vụ>/<dịch-vụ>.provider.ts` | Tầng nghiệp vụ chỉ biết interface |
| 3 | Viết bản `mock` — chạy được **không cần mạng, không cần khoá** | Test dùng được bản này |
| 4 | Viết bản thật, chọn bằng biến `<DỊCH_VỤ>_PROVIDER` | `ConfigService.get(...)` |
| 5 | Thêm biến vào `configuration.ts` + `.env.local` + `.env.example` (+ `docker-compose.yml` nếu qua Docker) | Hook `env_sync_guard` không nhắc |
| 6 | Đặt **giới hạn thời gian chờ** cho mọi lệnh gọi ra ngoài | Hết thời gian không treo nghiệp vụ |
| 7 | Bắt lỗi: dịch vụ lỗi **không** làm hỏng nghiệp vụ chính | Trả trạng thái "chưa xử lý được" để thử lại |
| 8 | Chỉ gửi **trường tối thiểu** cần cho việc đó | Rà lại payload gửi đi |
| 9 | Ghi lại **đã gửi gì cho ai lúc nào** (không ghi nội dung dữ liệu cá nhân) | Cần cho giải trình theo NĐ 13/2023 |
| 10 | Cập nhật `SECURITY.md` — dữ liệu gì ra khỏi hệ thống | Có dòng mới |
| 11 | Cập nhật `docs/01-BACKEND.md` + `.claude/data/constants.md` (bảng nhà cung cấp) | |
| 12 | Ghi ADR nếu việc chọn nhà cung cấp có tranh luận | `skills/quyet-dinh-kien-truc` |

## KHÔNG BAO GIỜ

- Gọi trực tiếp SDK/HTTP của bên thứ ba từ service nghiệp vụ hoặc từ component
- Viết cứng URL, khoá API, hay tên nhà cung cấp trong tầng nghiệp vụ
- Gửi **toàn bộ** bản ghi khi chỉ cần một trường
- Gửi dữ liệu thẻ căn cước hoặc nội dung đơn thư ra dịch vụ chưa được chốt pháp lý
- Bỏ bản `mock` khi đã có bản thật (mất khả năng phát triển và test offline)
- Gọi ra ngoài trong vòng lặp không có hạn mức

## Nhà cung cấp đang chờ khách chốt

| Dịch vụ | Câu hỏi mở | Hiện tại |
|---|---|---|
| OCR văn bản | #1 | `mock` |
| Đọc thẻ căn cước | — | `mock`; tách khỏi `ocr` vì ràng buộc NĐ 13/2023 |
| GIS / bản đồ | #3 | `mock`; nền bản đồ thật dùng OpenFreeMap (không cần khoá API) |
| Đẩy thông báo | — | `mock` |

**Không tự chốt** nhà cung cấp chính thức — đó là quyết định của khách hàng.

→ `workflows/_INDEX.md` · `skills/adapter-ben-thu-ba` · `data/tuan-thu-phap-ly.md`
