---
name: tiep-can-nguoi-cao-tuoi
description: Dùng khi thiết kế hoặc sửa giao diện dành cho công dân (Zalo Mini App, trang tra cứu công khai) — cỡ chữ, vùng chạm, biểu mẫu, thông báo, khả năng tiếp cận. Kích hoạt bởi: giao diện công dân, UX, cỡ chữ, font size, vùng chạm, tap target, accessibility, tiếp cận, người cao tuổi, biểu mẫu, form, thông báo lỗi, màu sắc, tương phản, contrast.
---

# Kỹ năng: Giao diện cho công dân — ai cũng phải dùng được
# Mức: CAO | Ngăn: người dân không dùng được dịch vụ công vì giao diện

## Vì sao là yêu cầu, không phải mong muốn

Người dùng kênh công dân của ViGov là **toàn bộ dân số một xã**: có người 70 tuổi dùng
điện thoại lần đầu, có người mắt kém, có người dùng máy màn hình 5 inch đời cũ, có người
chỉ biết dùng Zalo. Nếu họ không gửi được phản ánh, dịch vụ công không tồn tại — bất kể
mã nguồn đúng đến đâu.

## MUST

| # | Luật |
|---|------|
| 1 | Cỡ chữ thân bài **tối thiểu 16px**. Chữ phụ không nhỏ hơn 14 |
| 2 | Vùng chạm **tối thiểu 44×44** điểm cho mọi nút, ô chọn, liên kết |
| 3 | Tương phản chữ/nền đạt tối thiểu 4.5:1 |
| 4 | Không truyền đạt thông tin **chỉ** bằng màu — kèm nhãn chữ hoặc biểu tượng (người mù màu, và màn hình ngoài trời) |
| 5 | Biểu mẫu gửi phản ánh: mỗi bước một việc, nói rõ trường nào bắt buộc, giữ lại nội dung đã nhập khi có lỗi |
| 6 | Thông báo lỗi nói **làm gì tiếp**, không nói sai ở đâu về mặt kỹ thuật: "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0" |
| 7 | Nhãn ô nhập luôn hiển thị (không chỉ placeholder — placeholder mất khi bắt đầu gõ) |
| 8 | Ảnh chụp hiện trường: cho phép chụp lại, xem trước, xoá; nói rõ dung lượng tối đa **trước** khi chọn |
| 9 | Trạng thái hồ sơ hiển thị bằng lời người dân hiểu: "Đang xử lý", "Đã hoàn thành" — không phải mã trạng thái |
| 10 | Nút quay lại luôn thoát được màn hiện tại |
| 11 | Thao tác chờ mạng có báo hiệu đang tải; thất bại có nút thử lại |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Chữ nhỏ hơn 14px ở bất kỳ đâu trên giao diện công dân |
| 2 | Thuật ngữ kỹ thuật hoặc thuật ngữ nội bộ hành chính trên giao diện công dân |
| 3 | Biểu mẫu dài một trang với hơn 6 ô nhập |
| 4 | Bắt buộc nhập thông tin hệ thống đã có (số điện thoại đã định danh, tên đã lưu) |
| 5 | Đếm ngược, giới hạn thời gian nhập, hay tự động chuyển màn |
| 6 | Hiện toạ độ, mã hồ sơ dạng ObjectId, hay bất kỳ mã kỹ thuật nào cho công dân |
| 7 | Dùng màu đỏ cho thông tin trung tính (người dân hiểu đỏ = có vấn đề) |
| 8 | Thông báo lỗi chỉ có mã lỗi hoặc chỉ có chữ "Lỗi" |

## Kiểm tra một màn hình công dân trước khi coi là xong

1. Thu nhỏ màn hình xuống 320px chiều ngang — còn dùng được không?
2. Đặt cỡ chữ hệ thống lên mức lớn nhất — bố cục có vỡ không?
3. Đọc to từng chuỗi trên màn — có câu nào người 70 tuổi không hiểu?
4. Ngắt mạng giữa lúc gửi — có thông báo rõ và có giữ lại nội dung đã nhập không?
5. Có thao tác nào cần hơn 3 lần chạm để tới được không?

→ `rules/critical/ngon-ngu-hanh-chinh.md` · `skills/zalo-miniapp-platform`
