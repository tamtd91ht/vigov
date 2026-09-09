# 0001 — Thu hồi phản ánh của người dân

- Ngày: 10/09/2026
- Trạng thái: Đã chốt
- Người quyết định: Khách hàng (chủ đầu tư ViGov)
- Task liên quan: tính năng thu hồi phản ánh (`d80690c`, `c7b868f`)
- Câu hỏi mở liên quan: không

## Bối cảnh

Người dân gửi phản ánh nhầm, gửi trùng, hoặc sự việc đã tự giải quyết — cần đường rút
phiếu lại. Nhưng phiếu phản ánh là **tài liệu hành chính**, và có thể đã có cán bộ bỏ
công xác minh, nên không thể để người dân đơn phương xoá bất cứ lúc nào.

Khi dựng tính năng, ba điểm phải quyết mà không suy ra được từ yêu cầu. Đội phát triển
chọn mặc định an toàn nhất, nêu rõ đánh đổi, và khách hàng đã duyệt cả ba.

## Quyết định

### 1. "Gỡ phiếu" là XOÁ MỀM, không phải xoá cứng

Phiếu được đánh dấu `isDeleted`, biến mất khỏi danh sách của **cả người dân lẫn cán bộ**
và khỏi mọi thống kê, nhưng cán bộ vẫn tra lại được bằng `GET /feedback?deleted=true`,
kèm nguyên vẹn nhật ký xử lý.

**Hệ quả:** dữ liệu không bao giờ mất, đúng yêu cầu lưu trữ hồ sơ hành chính. Đổi lại,
mọi truy vấn trên collection `feedbacks` phải mang bộ lọc `NOT_DELETED` — sót một chỗ là
phiếu đã gỡ hiện lại trên báo cáo. Sáu module đã được rà: feedback, reports, dashboard,
search, settings, workflow.

### 2. Quyền duyệt thu hồi là `feedback:approve`, không phải `edit`

Chỉ vai trò `leader` và `admin` quyết được một yêu cầu thu hồi.

**Hệ quả:** chuyên viên (`officer`) đang xử lý phiếu **không** tự đóng được phiếu của
chính mình — giữ nguyên tắc kiểm soát nội bộ "người làm khác người duyệt". Đổi lại, ở xã
ít người thì lãnh đạo phải trực tiếp bấm duyệt; nếu vận hành thấy vướng, đổi sang `edit`
là sửa hai dòng decorator trong `feedback.controller.ts`.

### 3. Chốt chống spam VẪN ĐẾM phiếu đã thu hồi

`FEEDBACK_MAX_PER_DAY` đếm mọi phiếu một số điện thoại gửi trong 24 giờ, kể cả phiếu đã
gỡ.

**Hệ quả:** không lách được bằng vòng "gửi đủ hạn mức → thu hồi hết → gửi tiếp". Đổi lại,
người dân gửi nhầm rồi tự thu hồi ngay vẫn bị trừ lượt trong ngày hôm đó — chấp nhận
được, vì hạn mức mặc định là 5 phiếu/ngày, cao hơn nhiều nhu cầu thật của một hộ dân.

Hành vi này được khoá bằng `backend/test/feedback-withdraw-spam.e2e-spec.ts`: đây là chỗ
người đọc mã sau này rất dễ "sửa cho tử tế" bằng cách thêm `NOT_DELETED` vào
`assertNotSpamming`, và test đó là thứ chặn lại.

## Phương án đã bỏ

| Phương án | Vì sao bỏ |
|---|---|
| **Xoá cứng phiếu khi thu hồi** | Tiêu huỷ tài liệu hành chính bằng một lệnh Mongo. Phiếu phản ánh có thời hạn lưu theo quy định và có thể là căn cứ khi có khiếu nại. Không thể hoàn tác nếu người dân đổi ý hoặc thu hồi nhầm |
| **Cho người dân gỡ thẳng ở mọi trạng thái** | Cán bộ đã bỏ công xác minh, và phiếu có thể đang là căn cứ cho một nhiệm vụ đã giao. Người dân đơn phương rút là mất cả công lẫn dấu vết |
| **Quyền duyệt là `feedback:edit`** | Chuyên viên tự đóng được phiếu mình đang xử lý — mất nguyên tắc người làm khác người duyệt. Vẫn để ngỏ nếu vận hành thực tế thấy vướng |
| **Không đếm phiếu đã thu hồi vào hạn mức** | Mở đúng vòng lặp lách hạn mức nêu ở mục 3. Chốt chống spam mất tác dụng đúng vào lúc cần nó nhất |
| **Cho người dân sửa phiếu ở mọi lúc** | Đổi nội dung dưới chân người đang xử lý: cán bộ đọc một đằng, phiếu ghi một nẻo, bản ghi mất giá trị đối chứng. Nay chỉ sửa được khi **chưa ai tiếp nhận** |

## Rủi ro đã nhận

Người dân xin thu hồi rồi bị **từ chối** thì hiện vẫn xin lại được lượt mới. Chưa đặt
chốt riêng cho việc này vì chưa có dấu hiệu bị lạm dụng, và chặn cứng sẽ chặn nhầm trường
hợp người dân có lý do chính đáng bổ sung. **Điều kiện để xem lại:** thấy phiếu nào có
hơn hai lượt xin thu hồi bị từ chối liên tiếp.

→ Chi tiết kỹ thuật: `docs/01-BACKEND.md`, mục "Thu hồi và sửa phản ánh (người dân)"
