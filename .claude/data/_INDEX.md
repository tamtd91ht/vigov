# Dữ liệu tham chiếu — chỉ mục

Nạp lười theo nhu cầu. **Đây là bản tra cứu, không phải nguồn chuẩn** — nguồn chuẩn
luôn là mã nguồn. Thấy lệch thì tin mã, và sửa tệp tham chiếu.

| Tệp | Nạp khi |
|---|---|
| `glossary.md` | Gặp thuật ngữ hành chính chưa rõ, hoặc trước khi đặt tên khái niệm nghiệp vụ mới |
| `constants.md` | Cần biết hạn mức, TTL, cổng, vai trò, trạng thái, phiên bản đã ghim |
| `modules.json` | Cần biết module nào làm gì, chịu luật nào, có cạm bẫy gì |
| `tuan-thu-phap-ly.md` | Câu hỏi về nghị định, thời hạn lưu trữ, quyền của công dân về dữ liệu cá nhân |

## Nguồn chuẩn thật sự nằm ở đâu

| Thứ | Nguồn chuẩn |
|---|---|
| Kiểu dữ liệu nghiệp vụ | `admin-web/src/types/index.ts` |
| Vai trò và bảng quyền | `backend/libs/shared/src/auth/roles.ts` ↔ `admin-web/src/config/roles.config.ts` |
| Biến môi trường backend | `backend/libs/shared/src/config/configuration.ts` |
| Trạng thái, nhãn, màu | `admin-web/src/config/status.config.ts` |
| Danh mục lĩnh vực + SLA | `admin-web/src/config/sla.config.ts` |
| Danh sách task | `pending-tasks.json` (gốc dự án) |
| Câu hỏi mở của khách | `ESTIMATE_TECHNICAL.md` |
| Rủi ro bảo mật + việc trước production | `SECURITY.md` |
