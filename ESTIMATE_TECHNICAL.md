# ViGov Phase 1 — Tài liệu Estimate Kỹ thuật

> Mô hình triển khai: **AI coding 100%** (UI/UX + Backend) chạy song song nhiều agent, 1 senior full-stack làm việc cùng 8h/ngày (chốt giải pháp, review, confirm). Đơn giá duy nhất **1.3M VND/ngày** (đã gộp chi phí công cụ AI).
>
> Nguồn: `vigov-prototype.html` (mockup Web Quản trị 8 trang — dùng làm spec UI) + `ViGov_Phase1_Req.xlsx` (WBS 21 hạng mục). Mobile Mini App không có mockup — xây từ mô tả WBS.
>
> Ngày lập: 26/08/2026

---

## 1. Kiến trúc & Techstack (theo sheet Techstack)

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Backend micro-services | **NestJS (monorepo)** | Vertical slice theo phân hệ; API gateway + shared libs |
| Cơ sở dữ liệu | **MongoDB** | |
| Message Queue | **RabbitMQ** | Notification, workflow xuyên phân hệ |
| Real-time | **Socket.IO** | Phạm vi realtime cần chốt (xem câu hỏi mở #8) |
| Tác vụ định kỳ | CronJob | Nhắc SLA, đếm ngược hạn xử lý |
| Web Quản trị | **Next.js** | |
| Zalo Mini App | **ReactJS** (template Zalo) + Zalo SDK wrapper, build bằng **Vite** | |
| CI/CD | **Jenkins** + **Docker** | |
| OCR tiếng Việt | Bên thứ 3 — **TBD** | KH tự đăng ký tài khoản |
| Bản đồ / Geocoding | Bên thứ 3 — **TBD** (VietMap / Goong / MapLibre+OSM) | Google Maps không có giấy phép chính thức tại VN — loại |

---

## 2. Bảng Estimate theo Phase

| Phase | Phạm vi | Ngày công |
|---|---|---:|
| **P0 — Kiến trúc & Chuẩn bị** | Chốt giải pháp/quy chuẩn (bản đồ, OCR, realtime, phân quyền), scaffold monorepo NestJS + Next.js + Mini App, auth/RBAC, khung UI dùng chung (sidebar, topbar, drawer, toast, bình luận/nhật ký), CI/CD skeleton | **1.0** |
| **P1 — Web Quản trị** | 11 phân hệ (WBS #1–11) — fan-out agents song song, mockup làm spec | **3.5** |
| **P2 — Zalo Mini App** | 9 màn hình (WBS #12–20) — không có mockup, gồm cả thiết kế UI/UX từ WBS | **4.0** |
| **P3 — Backend nền tảng** | 10 dịch vụ dùng chung (WBS #21–31), chưa gồm tích hợp bên ngoài | **1.5** |
| **Cộng Xây dựng (code-complete)** | | **10.0** |
| + Tích hợp bên ngoài **15%** | Zalo OA/ZNS/SDK thật, OCR provider, bản đồ/geocoding, test thiết bị thật | 1.5 |
| + QA & Kiểm thử **15%** | Regression xuyên phân hệ | 1.5 |
| + Sửa lỗi & Tinh chỉnh **15%** | Theo feedback nội bộ + khách hàng | 1.5 |
| **P4 — Triển khai & Phát hành** | Hạ tầng staging/production, hardening bảo mật, nộp Zalo Mini App Store, hỗ trợ UAT (WBS #34–38) | **2.0** |
| **Tổng phát triển cơ sở** | | **16.5** |
| + Dự phòng **15%** | | 2.5 |
| **TỔNG PHASE 1** | | **≈ 19.0 ngày** |

**Chi phí**: 19.0 × 1.3M ≈ **24.7 triệu VND** · **Lịch**: ~4 tuần làm việc.

Cross-check công thức: `10.0 × (1 + 0.15 + 0.15 + 0.15) = 14.5` → `+ 2.0 (P4) = 16.5` → `× 1.15 (dự phòng) = 18.98` ✓

---

## 3. Mapping WBS → Phase & phạm vi từng phân hệ

### P1 — Web Quản trị (Next.js) — 3.5 ngày

| WBS | Phân hệ | Phạm vi chính |
|---|---|---|
| #1 | Khung dùng chung & Đăng nhập | Sidebar + topbar, drawer chi tiết dùng chung, toast, khối bình luận & nhật ký; đăng nhập cán bộ + RBAC (chưa có trong mockup) — *phần khung làm ở P0* |
| #2 | Dashboard Tổng quan | 6 thẻ KPI drill-down, biểu đồ cột/đường, bảng "Cần xử lý ngay", bộ chọn kỳ |
| #3 | Quản lý Công việc | Kanban 5 cột ⇄ bảng, bộ lọc, drawer chi tiết (checklist tự cập nhật tiến độ, bình luận/nhật ký, đính kèm), liên kết xuyên phân hệ, form giao việc mới |
| #4 | Văn bản & Đơn thư | 2 tab, hạn đếm ngược, xem bản scan + OCR trích 7 trường (cán bộ xác nhận), timeline luân chuyển, "Chuyển thành công việc", nhãn độ mật/khẩn |
| #5 | Ngân sách / Giải ngân | Thẻ tóm tắt, danh sách + drawer (lịch sử giải ngân, vướng mắc), đề nghị giải ngân/nhắc tháo gỡ, xuất Excel |
| #6 | Phản ánh Người dân (admin) | Thống kê, lọc chip 8 danh mục, lưới phiếu SLA đếm ngược, drawer (ảnh trước/sau, bản đồ mini, timeline, đánh giá), SLA theo danh mục |
| #7 | Bản đồ Kinh tế số | Bản đồ thật (provider TBD), 8 lớp bật/tắt, popup ghim, phân tích theo ngành |
| #8 | Báo cáo | Bộ chọn kỳ + so sánh cùng kỳ, 4 nhóm biểu đồ, xếp hạng phòng ban, xuất PDF/Excel/PPT |
| #9 | Cấu hình | SLA theo danh mục, sơ đồ tổ chức (CRUD + collapse), tài khoản & phân quyền, danh mục phản ánh |
| #10 | CMS nội dung Mobile | CRUD tin tức/sự kiện/thông báo, video, bản tin truyền thanh; broadcast ZNS/push; 2 lịch sử gửi (công dân / nội bộ) — *chưa có trong mockup* |
| #11 | User Mini App & Bảo mật | Danh sách công dân (khoá/mở), 2 danh sách phiên đăng nhập, lịch sử blacklist — *chưa có trong mockup* |

### P2 — Zalo Mini App (ReactJS + Zalo SDK) — 4.0 ngày

> Không có mockup như Web Admin — 4.0 ngày đã bao gồm cả bước **thiết kế UI/UX từ mô tả WBS** (user duyệt design trước khi build). Phân rã chi tiết để đánh giá:

| WBS | Hạng mục | Nội dung công việc cụ thể | Ngày |
|---|---|---|---:|
| — | Thiết kế UI/UX toàn app | Design system mini app (màu/typography/component theo chuẩn zmp-ui), wireframe 9 màn + luồng điều hướng, user duyệt trước khi build | 0.50 |
| #12 | Home & Định danh | Scaffold dự án Zalo Mini App (zmp-ui, router, state); luồng định danh SĐT Zalo (xin quyền → nhận token → gửi server đổi SĐT, mock SDK ở phase này); bottom nav; 6 ô truy cập nhanh; widget "Phản ánh của tôi" mới nhất + mini-feed tin tức | 0.50 |
| #13 | Gửi phản ánh 3 bước | Stepper 3 bước; lưới chọn 1/12 danh mục; form mô tả (validate bắt buộc) + chụp/chọn tối đa 3 ảnh (preview, xoá); tự định vị GPS + nút "Sửa" địa chỉ; màn xác nhận: gọi API sinh mã phiếu, hiển thị cam kết SLA, nút "Theo dõi phiếu này"; xử lý luồng từ chối quyền GPS/camera | 0.75 |
| #14 | Phản ánh của tôi | Danh sách phiếu (tiêu đề, danh mục, ngày, trạng thái); màn chi tiết: mô tả, ảnh, timeline xử lý (component dùng chung với #15) | 0.25 |
| #15 | Tra cứu Hồ sơ | Nhập mã hồ sơ + quét QR (Zalo scan API, mock ở phase này); màn kết quả: thủ tục, người nộp, trạng thái, cán bộ phụ trách; tracker 4 bước; lưu & hiển thị lịch sử tra cứu (tái dùng màn chi tiết) | 0.50 |
| #16 | Tin tức – Sự kiện | 3 tab (Tin tức/Sự kiện/Thông báo), danh sách + màn chi tiết bài viết (render nội dung từ CMS) | 0.25 |
| #17 | Truyền thanh phường | Danh sách bản tin theo ngày, lọc chuyên mục; audio player sticky: play/pause, thanh tua theo thời gian, ±15 giây, đổi tốc độ (1x/1.5x/2x), giữ phát khi chuyển màn | 0.50 |
| #18 | Video tuyên truyền | Lưới video (thumbnail, thời lượng, lượt xem), lọc theo chủ đề, màn phát video | 0.25 |
| #19 | Danh bạ chính quyền | Tìm theo tên/chức danh/SĐT; 2 nhóm (Lãnh đạo/Bộ phận chuyên môn); nút gọi nhanh; nút "Nhắn Zalo" cho lãnh đạo | 0.25 |
| #20 | Cá nhân | Cài đặt cỡ chữ lớn (áp dụng toàn app), toggle nhận thông báo Zalo, lối tắt tới #14 và lịch sử #15 | 0.25 |
| | **Cộng P2** | | **4.00** |

*Ghi chú*: kết nối SDK thật (SĐT, QR, GPS trên thiết bị thật) thuộc hệ số Tích hợp bên ngoài 15%, không nằm trong 4.0 ngày này.

### P3 — Backend nền tảng (NestJS) — 1.5 ngày (+ hệ số tích hợp ngoài 15%)

| WBS | Dịch vụ | Phase |
|---|---|---|
| #21 | Thiết kế micro-services + scaffold | P0/P3 |
| #23 | Notification (ZNS + push + in-app) | P3 (code) + hệ số TH ngoài (ZNS thật) |
| #24 | File storage (scan/ảnh/audio/video) | P3 |
| #25 | Tích hợp OCR | Hệ số tích hợp ngoài |
| #26 | GIS / geocoding | Hệ số tích hợp ngoài |
| #27 | Kết xuất báo cáo PDF/Excel/PPT | P3 (+UI ở P1 #8) |
| #28 | Tìm kiếm (việc/văn bản/phản ánh) | P3 — MongoDB text search cho Phase 1 |
| #29 | Audit log | P3 |
| #30 | Workflow xuyên phân hệ (VB→việc, PA→việc) | P3 |
| #31 | Bảo mật API (encryption, blacklist, rate-limit, chống spam) | P3 |

### P4 — Triển khai (WBS #34–38) — 2.0 ngày
CI/CD Jenkins (skeleton từ P0), hạ tầng staging + production, hardening & rà soát bảo mật, regression + hỗ trợ UAT, đăng ký/nộp kiểm duyệt Zalo Mini App Store.

**WBS #39 (Điều phối dự án)**: để ngỏ — mặc định do senior phụ trách tự đảm nhiệm trong 8h/ngày, không tính dòng riêng.

---

## 4. Mô hình làm việc AI multi-agent

- **Fan-out vertical slice**: mỗi phân hệ = 1 slice hoàn chỉnh (schema + API + UI); nhiều agent dựng song song nhiều slice, tốc độ thực tế **3–5 slice/ngày** đi qua vòng review.
- **Vai trò con người (1 senior)**: chốt giải pháp/quy chuẩn ở P0, review + confirm từng slice, quyết định các câu hỏi mở, làm đầu mối với khách hàng.
- **Điểm không song song hóa được** (lý do tồn tại các hệ số 15%): băng thông review của 1 người, tích hợp/tinh chỉnh chéo phân hệ, test trên thiết bị thật (Zalo Mini App), các vòng UAT với khách.
- Mốc **code-complete = hết ngày 10** (P0–P3): demo được toàn bộ tính năng với tích hợp mock; tích hợp thật + QA + phát hành trong ~9 ngày còn lại.

---

## 5. Câu hỏi mở — Customer Confirmation (8 câu, ảnh hưởng lớn)

| # | Hạng mục | Câu hỏi | Ảnh hưởng nếu thay đổi |
|---|---|---|---|
| 1 | OCR | Tự dựng (opensource) hay tích hợp bên thứ 3? | Opensource tự dựng: **+1–2 ngày**; bên thứ 3: chi phí thật, KH tự đăng ký |
| 2 | Bản đồ GIS | VietMap / Goong / MapLibre+OSM? (Google Maps loại — không giấy phép VN) | Provider trả phí: chi phí ngoài; MapLibre free nhưng geocoding VN yếu hơn |
| 3 | Zalo OA + ZNS | Xác nhận hạng mục chi phí/tài khoản thật | Chi phí ngoài, KH tự đăng ký Zalo Business; **lead time duyệt template ZNS** |
| 4 | Định danh công dân | Giới hạn tài khoản Zalo có địa chỉ thuộc Đà Nẵng, hay không giới hạn? | Logic lọc địa bàn: +0.25 ngày |
| 5 | Trục liên thông văn bản | Trong hay ngoài phạm vi Phase 1? | **CHƯA TÍNH** — nếu thêm: **+3–5 ngày** + phụ thuộc đầu mối nhà nước |
| 6 | Hosting | Cloud thường hay on-premise/hạ tầng nhà nước? | On-premise: **+1–2 ngày** DevOps |
| 7 | Real-time | Màn hình nào bắt buộc realtime, phần còn lại polling? | Socket.IO toàn cục: **+0.5–1 ngày** |
| 8 | Multi-tenant | 1 xã hay nhiều phường/xã của thành phố? | Multi-tenant thật: **+1–2 ngày** kiến trúc |

## 6. Câu hỏi mở — theo màn hình (từ các dòng ❓ trong WBS, ảnh hưởng nhỏ 0.1–0.5 ngày/câu)

**Web Quản trị**
1. Tìm kiếm toàn cục: phạm vi thật (việc/văn bản/phản ánh/công dân)?
2. Chuông thông báo: cần trung tâm thông báo in-app hay chỉ Zalo? (in-app: +0.5)
3. Nút trợ giúp: FAQ/tài liệu hay liên hệ hỗ trợ?
4. Avatar: cần menu tài khoản/đăng xuất thật?
5. Bộ chọn kỳ Dashboard/Phản ánh/năm Ngân sách: cần chọn nhiều kỳ thật?
6. Form "Giao việc mới": trường nào, có notify người nhận?
7. Form "Tiếp nhận văn bản" + bộ lọc nâng cao: định nghĩa trường?
8. Ngân sách: ai tạo hạng mục mới, luồng tạo thế nào? Ai duyệt đề nghị giải ngân, điều gì kích hoạt nhắc?
9. Phản ánh: xử lý xong có auto gửi Zalo cho công dân?
10. Bản đồ: nguồn dữ liệu thật, tần suất cập nhật, định dạng xuất?
11. Báo cáo: cần đủ PDF/Excel/PPT ngay khi ra mắt? (bỏ PPT: **−0.5**)
12. Phân quyền: theo phân hệ / hành động / nhóm vai trò dựng sẵn? (theo hành động: +0.5–1)
13. Sơ đồ tổ chức: quy mô thực tế bao nhiêu phường/xã?
14. CMS: quy trình biên tập — ai đăng, có duyệt trước?
15. Admin có được khoá/mở tài khoản công dân trực tiếp? Ai xem blacklist?

**Zalo Mini App**
16. Công dân từ chối quyền GPS → luồng xử lý? (cần test thiết bị thật)
17. Quy tắc đánh mã phiếu thật (hiện #PA-2026-0014 sinh client)?
18. QR: chức năng nào sinh mã QR từ mã phản ánh/hồ sơ? Nguồn dữ liệu hồ sơ một cửa lấy từ đâu?
19. Video: nhúng YouTube hay tự host video admin upload? (tự host: +0.25 BE)

---

## 7. Lead time bên ngoài & việc khách hàng tự làm (không tính ngày công — kick-off tuần 1)

| Việc | Bên chịu trách nhiệm | Ghi chú |
|---|---|---|
| Đăng ký Zalo OA / Zalo Business | Khách hàng | Điều kiện dùng ZNS + nhắn Zalo cán bộ |
| Duyệt template ZNS | Zalo | Vài ngày → 1 tuần, nộp sớm |
| Kiểm duyệt Zalo Mini App Store | Zalo | Nộp khi code-complete để chạy song song |
| Đăng ký tài khoản OCR provider | Khách hàng | Sau khi chốt provider |
| Đăng ký bản đồ (nếu VietMap/Goong) | Khách hàng | Sau khi chốt provider |
| Cấp hạ tầng (nếu on-premise) | Khách hàng | Ảnh hưởng trực tiếp lịch P4 |
