# ViGov — Kế hoạch kiểm thử hồi quy & hỗ trợ UAT (task P4-38, WBS #38)

> Mục tiêu: chứng minh 4 module chạy thông suốt trên staging trước khi khách nghiệm thu,
> và có quy trình rõ ràng để tiếp nhận — xử lý — nghiệm thu lại phản hồi của khách.

---

## 1. Môi trường UAT

| Thành phần | Địa chỉ (điền khi dựng staging) | Tài khoản thử |
|---|---|---|
| Web Quản trị | `https://admin-staging.<tên-miền>` | 9 tài khoản cán bộ do `npm run seed` tạo, tài khoản quản trị `admin` / `123456`, cán bộ dùng `ViGov@2026` — **đổi ngay sau vòng UAT** |
| API Backend | `https://api-staging.<tên-miền>/api/v1` | — |
| App công dân (Android) | Bản Internal testing trên Google Play | SĐT thật của người kiểm thử (nhận OTP) |
| App công dân (iOS) | TestFlight | Như trên |
| Zalo Mini App | Bản thử nghiệm trong Zalo Developers | Tài khoản Zalo của người kiểm thử |

Dữ liệu UAT: chạy `npm run seed` (tài khoản cán bộ + cấu hình SLA), phần dữ liệu nghiệp vụ do người kiểm thử tự tạo trong quá trình chạy kịch bản.

---

## 2. Kịch bản hồi quy xuyên phân hệ (bắt buộc chạy đủ trước khi mời khách UAT)

### KB-01 — Văn bản đến → Công việc
1. Cán bộ văn phòng đăng nhập Web Quản trị, tiếp nhận văn bản mới (số ký hiệu, cơ quan, trích yếu, hạn xử lý).
2. Mở drawer chi tiết, chạy OCR, xác nhận từng trường trích xuất.
3. Bấm "Chuyển thành công việc" → kiểm tra nhiệm vụ mới xuất hiện ở phân hệ Công việc, nguồn hiển thị đúng số văn bản.
4. Tick hết checklist của nhiệm vụ → tiến độ về 100%, trạng thái chuyển "Chờ duyệt".
5. **Kỳ vọng**: liên kết hai chiều đúng, không tạo trùng nhiệm vụ khi bấm lại.

### KB-02 — Phản ánh của công dân → Xử lý → Đánh giá
1. Công dân mở **app Flutter**, định danh SĐT, gửi phản ánh: chọn danh mục, nhập mô tả, đính 2 ảnh, lấy vị trí GPS.
2. Kiểm tra màn kết quả có mã phiếu và cam kết SLA đúng theo danh mục.
3. Cán bộ thấy phiếu trên Web Quản trị, phân công cán bộ xử lý → trạng thái "Đang xử lý".
4. Cán bộ bấm "Xác nhận đã xử lý" → công dân nhận thông báo, phiếu chuyển "Đã xử lý".
5. Công dân đánh giá 5 sao kèm nhận xét → cán bộ thấy đánh giá trong drawer.
6. **Lặp lại toàn bộ bằng Zalo Mini App** để xác nhận hai kênh cho kết quả như nhau.

### KB-03 — SLA và nhắc hạn
1. Tạo phản ánh thuộc danh mục có SLA ngắn nhất (An ninh: 2 ngày).
2. Kiểm tra đồng hồ đếm ngược SLA trên Web Quản trị hiển thị đúng, chuyển đỏ khi quá hạn.
3. Kiểm tra CronJob nhắc hạn ghi log nhiệm vụ/phiếu sắp đến hạn (chạy 07:00 hằng ngày; có thể kích hoạt thủ công qua `GET /workflow/deadline-warnings`).

### KB-04 — Giải ngân
1. Tạo hạng mục ngân sách, ghi nhận 2 lần giải ngân.
2. Kiểm tra tỷ lệ % và cờ "Chậm tiến độ" tính đúng.
3. Thêm vướng mắc, gửi đề nghị giải ngân, xuất Excel — kiểm tra file mở được và số liệu khớp.

### KB-05 — CMS → App công dân
1. Cán bộ đăng bài viết mới trên Web Quản trị (trạng thái "Đã đăng").
2. Kiểm tra bài xuất hiện ở tab Tin tức của **cả app Flutter và Zalo Mini App**, mở chi tiết đọc được đầy đủ nội dung.
3. Gỡ bài về "Nháp" → bài biến mất khỏi app.

### KB-06 — Người dùng & bảo mật
1. Khoá một tài khoản công dân kèm lý do → kiểm tra tài khoản đó không đăng nhập được, bản ghi blacklist xuất hiện.
2. Mở khoá → đăng nhập lại được.
3. Thu hồi một phiên đăng nhập → phiên đó mất khỏi danh sách.
4. Gửi quá số phản ánh cho phép trong ngày → hệ thống chặn kèm thông báo tiếng Việt.

### KB-07 — Phân quyền
Đăng nhập lần lượt 5 vai trò (Quản trị, Lãnh đạo, Chuyên viên, Kế toán, Tiếp nhận một cửa), xác nhận mỗi vai trò chỉ thấy và thao tác được đúng phạm vi của mình.

### KB-08 — Báo cáo
Chọn từng kỳ (tháng/quý/6 tháng/năm), bật so sánh cùng kỳ, kiểm tra 4 nhóm biểu đồ và bảng xếp hạng khớp dữ liệu; xuất Excel kiểm tra 4 sheet.

### KB-09 — Tra cứu hồ sơ
Nhập mã hồ sơ và quét QR trên cả hai kênh công dân, kiểm tra tracker 4 bước và lịch sử tra cứu.

### KB-10 — Truyền thanh
Phát một bản tin, chuyển sang màn khác → kiểm tra thanh phát thu nhỏ vẫn giữ tiến độ; thử tua ±15 giây và đổi tốc độ.

---

## 3. Kiểm thử trên thiết bị thật (không thể thay bằng giả lập)

| Hạng mục | Thiết bị tối thiểu |
|---|---|
| Quyền GPS: cho phép / từ chối / tắt định vị hệ thống | 1 Android + 1 iPhone |
| Quyền camera & thư viện ảnh | 1 Android + 1 iPhone |
| Quét QR ngoài trời, thiếu sáng | 1 Android + 1 iPhone |
| Nhận thông báo đẩy khi app đóng | 1 Android + 1 iPhone |
| Zalo Mini App trên máy cấu hình thấp | 1 Android tầm trung/thấp |
| Cỡ chữ lớn (Rất lớn) không vỡ giao diện | Cả hai nền tảng |

---

## 4. Quy trình tiếp nhận phản hồi UAT

1. Khách ghi phản hồi vào **biên bản UAT** (mẫu ở mục 5), mỗi mục gồm: màn hình, thao tác, kết quả thực tế, kết quả mong đợi, ảnh chụp màn hình.
2. Đội phát triển phân loại trong vòng 1 ngày làm việc:
   - **Lỗi (bug)** — sai so với yêu cầu đã chốt → sửa trong phạm vi hệ số "Sửa lỗi & tinh chỉnh 15%".
   - **Yêu cầu mới (change request)** — ngoài phạm vi đã chốt → báo lại ảnh hưởng ngày công, khách quyết định đưa vào Phase 1 hay Phase 2.
   - **Câu hỏi mở đã ghi nhận** — thuộc danh sách ~27 câu trong `ESTIMATE_TECHNICAL.md`, cần khách chốt để triển khai.
3. Sửa xong → triển khai lên staging → đội chạy lại kịch bản hồi quy liên quan → mời khách nghiệm thu lại mục đó.
4. Kết thúc: hai bên ký biên bản nghiệm thu, chốt danh sách tồn đọng chuyển Phase 2 (nếu có).

---

## 5. Mẫu biên bản UAT

| # | Ngày | Người kiểm thử | Màn hình / chức năng | Thao tác | Kết quả thực tế | Kết quả mong đợi | Phân loại | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | Lỗi / Yêu cầu mới / Câu hỏi | Mới / Đang sửa / Chờ nghiệm thu / Đã đóng |

---

## 6. Tiêu chí nghiệm thu Phase 1

- [ ] 10/10 kịch bản hồi quy KB-01…KB-10 chạy đạt trên staging.
- [ ] Kiểm thử thiết bị thật đủ hạng mục ở mục 3, không còn lỗi chặn (blocker).
- [ ] `npm run test:e2e` của backend pass toàn bộ.
- [ ] Không còn lỗi mức Cao trong `SECURITY.md`.
- [ ] 3 kênh app đã nộp kiểm duyệt (hoặc đã được duyệt) theo `deploy/RELEASE.md`.
- [ ] Bàn giao: mã nguồn, tài liệu triển khai, tài khoản quản trị, hướng dẫn sử dụng cho cán bộ.
