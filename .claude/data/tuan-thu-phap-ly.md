# Tham chiếu pháp lý ViGov
# Nạp khi: câu hỏi về nghị định, thời hạn lưu trữ, quyền của công dân về dữ liệu cá nhân

> **Đây là bản đồ để biết phải hỏi ai và hỏi gì, KHÔNG phải tư vấn pháp lý.**
> Câu hỏi pháp lý cụ thể do khách hàng (UBND xã) và bộ phận pháp chế trả lời.
> Vai trò của người viết mã: **nhận ra chỗ có ràng buộc pháp lý và dừng lại hỏi.**

---

## Văn bản pháp luật liên quan

| Văn bản | Chạm vào gì trong ViGov | Ràng buộc thực tế với mã |
|---|---|---|
| **Nghị định 13/2023/NĐ-CP** — Bảo vệ dữ liệu cá nhân | `citizenPhone`, `applicantPhone`, `citizenName`, địa chỉ, toạ độ, ảnh hiện trường, dữ liệu thẻ căn cước, nội dung đơn thư | Xử lý dữ liệu cá nhân phải có **cơ sở pháp lý** · phải **thông báo mục đích** · phải **giới hạn phạm vi** · chủ thể có **quyền yêu cầu xoá** · chuyển dữ liệu cho bên thứ ba phải kiểm soát và ghi lại |
| **Nghị định 85/2016/NĐ-CP** — Bảo đảm an toàn hệ thống thông tin theo cấp độ | Toàn hệ thống | Hệ thống của cơ quan nhà nước phải được **xác định cấp độ** và đáp ứng yêu cầu tương ứng. **Ngoài phạm vi Phase 1** — `SECURITY.md` mục 5 |
| **Luật Lưu trữ** và quy định lưu trữ hồ sơ hành chính | Văn bản đến/đi, đơn thư, hồ sơ một cửa, quyết định giải ngân | Tài liệu có **thời hạn lưu trữ theo quy định** — **không được xoá cứng** → `rules/critical/bao-toan-du-lieu.md` |
| **Luật Khiếu nại** | Phân loại và xử lý khiếu nại | Thủ tục và thời hạn riêng, khác phản ánh/kiến nghị |
| **Luật Tố cáo** | Phân loại và xử lý tố cáo | Có yêu cầu **bảo vệ người tố cáo** — hạn chế người được xem |
| Quy định về tiếp nhận, xử lý phản ánh kiến nghị của người dân | Phân hệ Phản ánh | SLA theo lĩnh vực; **phải trả lời công dân** |

---

## Ba câu hỏi cho mỗi trường dữ liệu cá nhân

Trước khi thu thêm **bất kỳ** trường dữ liệu cá nhân nào, phải trả lời được:

1. **Thu để làm gì?** — mục đích cụ thể, không phải "để dành sau này dùng"
2. **Ai xem được?** — vai trò nào, ở dạng rõ hay đã che
3. **Giữ bao lâu?** — và sau đó xử lý thế nào

Chưa trả lời được cả ba thì **chưa thu**. Đây là yêu cầu của NĐ 13/2023, không phải
quy ước nội bộ.

---

## Dữ liệu cá nhân đang thu ở ViGov

| Trường | Mục đích | Ai xem dạng rõ | Ghi chú |
|---|---|---|---|
| `citizenPhone` | Định danh công dân, liên hệ trả kết quả | Chưa chốt vai trò nào — hiện **che** ở mọi endpoint | `feedback.service.ts` có ghi câu hỏi mở này |
| `citizenName` | Ghi trên phiếu, gọi tên khi trả lời | Cán bộ có quyền xem phân hệ | |
| Địa chỉ / toạ độ phản ánh | Xác định nơi cần xử lý | Cán bộ xử lý | Toạ độ là dữ liệu cá nhân khi gắn với một người |
| Ảnh hiện trường | Bằng chứng để xử lý và nghiệm thu | Cán bộ xử lý | Có thể chứa mặt người, biển số → tệp `isPrivate = true` |
| Nội dung phản ánh | Nội dung việc cần xử lý | Cán bộ xử lý | **Nhạy cảm** — có thể chứa thông tin người thứ ba |
| Dữ liệu thẻ căn cước | Điền sẵn hồ sơ một cửa (P5-11) | Cán bộ tiếp nhận | Module `idcard` tách riêng khỏi `ocr` **vì** ràng buộc NĐ 13/2023 |
| `applicantPhone` | Liên hệ về hồ sơ một cửa | Che ở mọi endpoint | |

---

## Yêu cầu xoá dữ liệu cá nhân — cách làm

**Không xoá cứng.** Trình tự:

1. Ghi nhận yêu cầu + ghi vết (ai yêu cầu, lúc nào, qua kênh nào)
2. **Tài khoản**: xoá mềm · thu hồi phiên · ẩn danh `citizenName`, `citizenPhone`
3. **Hồ sơ nghiệp vụ đã xử lý xong**: ẩn danh trường định danh, **giữ** nội dung nghiệp
   vụ và kết quả xử lý — đây là tài liệu hành chính, không được tiêu huỷ
4. **Tệp là ảnh có mặt người**: đánh dấu để cán bộ quyết định — không tự xoá
5. **Nhật ký thao tác**: giữ nguyên (bất biến); `actor` đã ở dạng che
6. Ghi kết quả vào nhật ký và thông báo cho công dân

Chưa có quy trình hành chính tương ứng thì **không tự làm** — nêu ra và hỏi.
→ `skills/che-du-lieu-ca-nhan`

---

## Điều kiện DỪNG — phải hỏi trước khi làm

- Thêm một trường dữ liệu cá nhân mới
- Gửi dữ liệu cá nhân sang một hệ thống mới (kể cả dịch vụ đám mây)
- Xoá hoặc ẩn danh dữ liệu ở quy mô lớn
- Đặt hoặc đổi thời hạn lưu trữ
- Mở dữ liệu cho một vai trò mới xem
- Công bố dữ liệu ra công khai — **kể cả đã tổng hợp**: trên quy mô một xã, số liệu
  tổng hợp nhỏ vẫn có thể suy ra được cá nhân

---

## Ngoài phạm vi Phase 1 (`SECURITY.md` mục 5)

Những việc này **chưa** làm, cần lập kế hoạch và dự toán riêng. **Không** khẳng định hệ
thống đã đạt các hạng mục này:

- Kiểm thử xâm nhập (pentest) do đơn vị độc lập thực hiện
- WAF trước API Gateway
- SIEM / giám sát an ninh tập trung
- Mã hoá dữ liệu ở tầng lưu trữ (MongoDB, kho tệp)
- Quản lý bí mật tập trung (Vault / Secrets Manager) thay tệp `.env`
- Xác thực đa yếu tố (MFA) cho tài khoản quản trị
- **Đánh giá tuân thủ NĐ 13/2023 và xác định cấp độ an toàn theo NĐ 85/2016**
- Quét mã tự động trong CI (SAST/DAST) và quy trình vá lỗ hổng có SLA
- Diễn tập khôi phục sau thảm hoạ

→ `skills/tuan-thu-phap-ly` · `rules/critical/du-lieu-ca-nhan.md` · `agents/ra-soat-tuan-thu.md`
