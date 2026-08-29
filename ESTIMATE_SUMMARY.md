# ViGov Phase 1 — Báo cáo Estimate (Tóm tắt)

**Ngày lập**: 26/08/2026 · **Người lập**: tamtd · **Trạng thái**: ước tính sơ bộ (ROM) phục vụ lập kế hoạch, chưa phải báo giá cố định

---

## Dự án

**ViGov** — nền tảng Điều hành số cấp xã/phường, gồm **3 sản phẩm**:

1. **Web Quản trị** (11 phân hệ): Dashboard điều hành, quản lý công việc Kanban, văn bản & đơn thư (có OCR), ngân sách/giải ngân, phản ánh người dân, bản đồ kinh tế số, báo cáo, cấu hình, CMS nội dung, quản lý người dùng & bảo mật.
2. **Zalo Mini App cho công dân** (9 màn hình): gửi phản ánh kèm ảnh + GPS, theo dõi phiếu, tra cứu hồ sơ QR, tin tức, truyền thanh, video, danh bạ chính quyền.
3. **Backend nền tảng**: micro-services NestJS, thông báo Zalo ZNS, lưu trữ file, tìm kiếm, audit, workflow xuyên phân hệ, bảo mật API.

## Con số chốt

| | |
|---|---|
| **Tổng ngày công** | **≈ 19 ngày** (1 senior full-stack + AI coding, 8h/ngày) |
| **Chi phí phát triển** | **≈ 24–25 triệu VND** (đơn giá 1.3M/ngày, đã gộp chi phí công cụ AI) |
| **Thời gian lịch** | **~4 tuần** làm việc |
| **Chi phí ngoài (KH tự trả)** | Zalo OA/ZNS, OCR provider, bản đồ (VietMap/Goong), hạ tầng cloud |

## Phân bổ theo phase

| Phase | Nội dung | Ngày |
|---|---|---:|
| P0 | Kiến trúc, chốt giải pháp, dựng khung dự án | 1.0 |
| P1–P3 | Xây dựng toàn bộ: Web Quản trị (3.5) + Mini App (4.0 — gồm thiết kế UI/UX vì không có mockup) + Backend (1.5), AI fan-out song song | 9.0 |
| Hệ số | Tích hợp bên ngoài 15% + QA 15% + sửa lỗi 15% | 4.5 |
| P4 | Triển khai hạ tầng, bảo mật, phát hành Mini App Store, hỗ trợ UAT | 2.0 |
| Dự phòng | 15% | 2.5 |
| **Tổng** | | **19.0** |

**Mốc bàn giao**: hết **ngày 10** — code-complete, demo được toàn bộ tính năng · hết **tuần 4** — bàn giao production + nộp kiểm duyệt Mini App Store.

## Vì sao chỉ 19 ngày? (so với đội truyền thống)

Cùng phạm vi này, đội truyền thống (BA + 2–3 dev + QA) thường cần **4–6 tháng, chi phí gấp 10–15 lần**. Mô hình AI coding: AI viết 100% code (UI/UX + backend) bằng nhiều agent chạy song song — mỗi ngày hoàn thành 3–5 phân hệ hoàn chỉnh; con người chỉ giữ vai trò chốt giải pháp, review và làm việc với khách hàng. Mockup Web Quản trị đã có sẵn làm spec chi tiết, giảm gần hết chi phí thiết kế UI.

## Rủi ro & điều kiện cần lưu ý

1. **Trục liên thông văn bản nhà nước CHƯA nằm trong phạm vi** — nếu khách yêu cầu: +3–5 ngày và phụ thuộc đầu mối cơ quan nhà nước.
2. **Lead time bên ngoài không nằm trong ngày công**: Zalo duyệt template ZNS (vài ngày–1 tuần), kiểm duyệt Mini App Store — đã lên kế hoạch nộp song song từ tuần 1 nhưng là yếu tố ngoài tầm kiểm soát.
3. **Khách hàng phải tự đăng ký & trả phí**: Zalo OA/Business, dịch vụ OCR, bản đồ (Google Maps không có giấy phép tại VN — dùng VietMap/Goong hoặc mã nguồn mở).
4. **Các lựa chọn chưa chốt có thể cộng thêm**: hosting on-premise (+1–2), nhiều phường/xã multi-tenant (+1–2), OCR tự dựng (+1–2), realtime toàn cục (+0.5–1). Đã liệt kê đầy đủ ~27 câu hỏi cần khách xác nhận trong tài liệu kỹ thuật.
5. **19 ngày là sàn an toàn** — đã bao gồm thiết kế UI/UX Mini App (không có mockup sẵn), QA, sửa lỗi theo feedback và dự phòng 15%; quote thấp hơn đồng nghĩa mọi vòng chỉnh sửa của khách vượt ngân sách.

> Chi tiết kỹ thuật, mapping WBS và danh sách câu hỏi mở: xem `ESTIMATE_TECHNICAL.md`.
