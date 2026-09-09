---
name: tuan-thu-phap-ly
description: Dùng khi câu hỏi liên quan tới nghị định, quy định pháp luật, thời hạn lưu trữ tài liệu, quyền của công dân về dữ liệu cá nhân, an toàn thông tin cấp độ hệ thống. Kích hoạt bởi: nghị định, NĐ 13/2023, NĐ 85/2016, pháp lý, tuân thủ, compliance, lưu trữ, thời hạn lưu, quyền được xoá, dữ liệu cá nhân, an toàn thông tin, cấp độ hệ thống, thanh tra.
---

# Kỹ năng: Tuân thủ pháp lý
# Mức: CAO | Ngăn: làm sai quy định, xoá tài liệu phải lưu, thu dữ liệu không có cơ sở

## Giới hạn của kỹ năng này

Đây là **bản đồ để biết phải hỏi ai và hỏi gì**, không phải tư vấn pháp lý. Câu hỏi
pháp lý cụ thể phải do khách hàng (UBND xã) và bộ phận pháp chế trả lời. Vai trò của
người viết mã: **nhận ra chỗ có ràng buộc pháp lý và dừng lại hỏi**, thay vì tự quyết.

## Văn bản pháp luật liên quan tới ViGov

| Văn bản | Chạm vào gì | Hệ quả với mã |
|---|---|---|
| **Nghị định 13/2023/NĐ-CP** — bảo vệ dữ liệu cá nhân | Số điện thoại, họ tên, địa chỉ, CCCD, ảnh, nội dung đơn thư | Phải có cơ sở pháp lý để thu · phải thông báo mục đích · phải giới hạn phạm vi · chủ thể có quyền yêu cầu xoá · chuyển dữ liệu ra ngoài phải kiểm soát |
| **Nghị định 85/2016/NĐ-CP** — an toàn hệ thống thông tin theo cấp độ | Toàn hệ thống | Hệ thống của cơ quan nhà nước phải được xác định cấp độ và đáp ứng yêu cầu tương ứng. Việc này **ngoài phạm vi Phase 1** — xem `SECURITY.md` mục 5 |
| **Luật Lưu trữ** và quy định lưu trữ hồ sơ hành chính | Văn bản đến/đi, đơn thư, hồ sơ một cửa | Tài liệu có **thời hạn lưu trữ theo quy định** — không được xoá cứng → `rules/critical/bao-toan-du-lieu.md` |
| **Luật Khiếu nại / Luật Tố cáo** | Phân loại đơn thư | Khiếu nại và tố cáo có thủ tục và thời hạn riêng, khác phản ánh/kiến nghị → `rules/critical/ngon-ngu-hanh-chinh.md` |
| Quy định về tiếp nhận, xử lý phản ánh kiến nghị | Phân hệ Phản ánh | SLA theo lĩnh vực; phải trả lời công dân |

## MUST

| # | Luật |
|---|------|
| 1 | Mỗi trường dữ liệu cá nhân thu thập phải trả lời được ba câu: **thu để làm gì · ai xem được · giữ bao lâu**. Chưa trả lời được thì chưa thu |
| 2 | Nhật ký thao tác giữ **tối thiểu 12 tháng** (SECURITY.md mục 4, việc 12) |
| 3 | Chuyển dữ liệu cá nhân ra bên thứ ba → ghi lại đã gửi gì cho ai lúc nào → `skills/adapter-ben-thu-ba` |
| 4 | Yêu cầu xoá dữ liệu cá nhân → ẩn danh, **giữ** phần hồ sơ nghiệp vụ và nhật ký → `skills/che-du-lieu-ca-nhan` |
| 5 | Màn hình thu dữ liệu cá nhân của công dân có thông báo mục đích sử dụng, dễ đọc |
| 6 | Hồ sơ xin quyền API Zalo phải khớp với luồng mã thật (Zalo kiểm) → `skills/zalo-miniapp-platform` |
| 7 | Việc vượt ngoài phạm vi Phase 1 (pentest, WAF, SIEM, mã hoá ở tầng lưu trữ, MFA, đánh giá tuân thủ NĐ 13 và NĐ 85) → nói rõ là ngoài phạm vi, không âm thầm bỏ |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Tự quyết định một câu hỏi pháp lý (thời hạn lưu, được thu trường gì, được gửi ra đâu) |
| 2 | Tiêu huỷ tài liệu hành chính bằng lệnh kỹ thuật |
| 3 | Thu thêm một trường dữ liệu cá nhân "để dành sau này dùng" |
| 4 | Gửi dữ liệu cá nhân sang một dịch vụ ngoài chưa được chốt về pháp lý |
| 5 | Khẳng định hệ thống "tuân thủ NĐ 13/2023" — Phase 1 **chưa** có đánh giá tuân thủ chính thức |
| 6 | Đưa nội dung đơn thư tố cáo ra ngoài phạm vi người có quyền xem (có yêu cầu bảo vệ người tố cáo) |

## Điều kiện DỪNG — hỏi trước khi làm

- Thêm một trường dữ liệu cá nhân mới
- Gửi dữ liệu cá nhân sang một hệ thống mới
- Xoá hoặc ẩn danh dữ liệu ở quy mô lớn
- Đặt hoặc đổi thời hạn lưu trữ
- Mở dữ liệu cho một vai trò mới xem
- Công bố dữ liệu ra công khai (kể cả đã tổng hợp — dữ liệu tổng hợp trên quy mô nhỏ
  vẫn có thể suy ra được cá nhân)

→ `rules/critical/du-lieu-ca-nhan.md` · `rules/critical/bao-toan-du-lieu.md` · `data/tuan-thu-phap-ly.md`
