# Quy trình: Xử lý dữ liệu cá nhân

Dùng khi: thêm một trường dữ liệu cá nhân, mở dữ liệu cho vai trò mới xem, hoặc xử lý
yêu cầu xoá dữ liệu của công dân.

> Ràng buộc gốc: **Nghị định 13/2023/NĐ-CP**. Đây là quy trình kỹ thuật, không phải tư
> vấn pháp lý — câu hỏi pháp lý do khách hàng và bộ phận pháp chế trả lời.

---

## A. THÊM một trường dữ liệu cá nhân

### Ba câu hỏi chặn cứng

| # | Câu hỏi | Ví dụ trả lời đủ |
|---|---|---|
| 1 | **Thu để làm gì?** | "Để gọi lại cho công dân khi phiếu phản ánh cần xác minh thêm" |
| 2 | **Ai xem được?** | "Chuyên viên được phân công phiếu đó, xem dạng đã che; vai trò `leader` xem dạng rõ" |
| 3 | **Giữ bao lâu?** | "Theo thời hạn lưu hồ sơ phản ánh; sau đó ẩn danh" |

**Không trả lời được cả ba thì chưa thu.** "Để dành sau này dùng" không phải câu trả lời.

### Bước

| # | Việc |
|---|------|
| 1 | Trả lời ba câu trên, ghi vào plan của task |
| 2 | Thêm trường theo `workflows/doi-truong-du-lieu.md` (sáu bước, một commit) |
| 3 | Viết hàm che nếu chưa có — **dùng lại** hàm đã có, đừng viết bản thứ tư → `skills/che-du-lieu-ca-nhan` |
| 4 | Che **ở tầng service** trước khi trả ra API |
| 5 | Thêm tên trường vào `REDACTED_FIELDS` nếu là bí mật xác thực |
| 6 | Màn hình thu dữ liệu có **thông báo mục đích** cho công dân, dễ đọc |
| 7 | Rà: trường này có lọt vào log / URL / tên tệp / khoá cache / tên phòng socket không? |
| 8 | Rà: trường này có lọt vào tệp xuất (Excel/PDF/PPTX) không? → `skills/bao-cao-va-xuat-file` |
| 9 | Test: che đúng · chuỗi ngắn giữ nguyên · rỗng trả rỗng |
| 10 | Cập nhật `data/tuan-thu-phap-ly.md` bảng "Dữ liệu cá nhân đang thu ở ViGov" |
| 11 | Cập nhật `SECURITY.md` nếu thay đổi mức phơi bày dữ liệu |

---

## B. MỞ dữ liệu cho một vai trò mới xem

**DỪNG. Đây là quyết định của khách hàng, không phải của người viết mã.**

Nêu ra: vai trò nào, trường nào, dạng rõ hay đã che, vì sao cần. Rồi hỏi.

Tham chiếu: phát hiện **T-04** trong `SECURITY.md` (quyền `users:edit` của vai trò
*Tiếp nhận một cửa*) đang chờ khách chốt ở **câu hỏi mở #15** — đừng tự nới thêm.

---

## C. Công dân YÊU CẦU XOÁ dữ liệu cá nhân

**Không xoá cứng.** Hồ sơ hành chính là tài liệu lưu trữ có thời hạn theo quy định.

| # | Việc | Ghi chú |
|---|------|---|
| 1 | Ghi nhận yêu cầu + ghi vết: ai yêu cầu, lúc nào, qua kênh nào | |
| 2 | **Tài khoản**: xoá mềm · thu hồi phiên · ẩn danh `citizenName`, `citizenPhone` | Thu hồi phiên bắt buộc, nếu không token cũ còn dùng được |
| 3 | **Hồ sơ nghiệp vụ đã xử lý xong**: ẩn danh trường định danh, **giữ** nội dung nghiệp vụ và kết quả xử lý | Đây là tài liệu hành chính |
| 4 | **Tệp là ảnh có mặt người**: đánh dấu để cán bộ quyết định | **Không tự xoá** |
| 5 | **Nhật ký thao tác**: giữ nguyên | Nhật ký bất biến; `actor` đã ở dạng che |
| 6 | Ghi kết quả vào nhật ký, thông báo cho công dân | |

Chưa có quy trình hành chính tương ứng ở xã thì **không tự làm** — nêu ra và hỏi.

Cơ chế đã có: webhook Zalo có đường nhận yêu cầu xoá dữ liệu (`modules/zalo-webhook`),
và Web Quản trị có xoá mềm tài khoản công dân.

---

## Điều kiện DỪNG chung

- Gửi dữ liệu cá nhân sang một hệ thống mới → `workflows/tich-hop-ben-thu-ba.md`
- Xoá hoặc ẩn danh dữ liệu ở **quy mô lớn**
- Đặt hoặc đổi thời hạn lưu trữ
- Công bố dữ liệu ra công khai — **kể cả đã tổng hợp**: trên quy mô một xã, số liệu
  tổng hợp nhỏ vẫn có thể suy ra được cá nhân

→ `workflows/_INDEX.md` · `rules/critical/du-lieu-ca-nhan.md` · `skills/tuan-thu-phap-ly`
