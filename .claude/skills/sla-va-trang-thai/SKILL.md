---
name: sla-va-trang-thai
description: Dùng khi làm việc với SLA, hạn xử lý, tính ngày làm việc, quá hạn, cảnh báo trước hạn, trạng thái hồ sơ, chuyển trạng thái. Kích hoạt bởi: SLA, hạn xử lý, deadline, quá hạn, ngày làm việc, daysLeft, slaHoursLeft, warnBefore, trạng thái, status, chuyển trạng thái, kanban, mức ưu tiên, priority.
---

# Kỹ năng: SLA và trạng thái hồ sơ
# Mức: CAO | Ngăn: hạn xử lý sai, báo cáo quá hạn sai, cán bộ bị đánh giá oan

## Vì sao tính sai SLA là chuyện lớn

Con số "quá hạn" của một xã đi vào báo cáo lên cấp trên và vào đánh giá cán bộ. Tính lệch
một ngày là oan cho người xử lý, hoặc là che một việc thật sự chậm. Đây là con số **phải
đúng**, không phải con số hiển thị cho đẹp.

## Nguồn cấu hình SLA

`admin-web/src/config/sla.config.ts`:

- `feedbackCategories` — danh mục lĩnh vực (8 lĩnh vực)
- `defaultSlaRules` — mỗi lĩnh vực: `intakeDays` (ngày tiếp nhận/phân loại),
  `resolveDays` (ngày xử lý xong), `unit`, `warnBefore` (mốc cảnh báo trước hạn)

Trang Cấu hình cho phép cán bộ sửa các giá trị này. Nghĩa là **mã không được giả định
giá trị cụ thể** — luôn đọc từ cấu hình / API.

## MUST

| # | Luật |
|---|------|
| 1 | Số ngày SLA **luôn** đọc từ cấu hình theo lĩnh vực, không viết cứng → `rules/critical/khong-hardcode.md` |
| 2 | `unit` là **"ngày làm việc"** — tính hạn phải bỏ Thứ Bảy, Chủ Nhật, và ngày lễ. Đếm ngày tự nhiên là sai |
| 3 | Danh sách ngày lễ nằm ở cấu hình, cập nhật được theo năm (lễ Việt Nam có ngày âm lịch, không tính được bằng công thức) |
| 4 | Hạn xử lý (`slaDeadline`) tính **một lần** lúc tiếp nhận và **lưu vào bản ghi** — không tính lại mỗi lần đọc (đổi cấu hình SLA không được làm hồ sơ cũ đổi hạn) |
| 5 | `daysLeft` / `slaHoursLeft` là giá trị **suy ra**, tính lúc đọc từ `slaDeadline` — không lưu |
| 6 | Trạng thái "Quá hạn" là trạng thái **suy ra từ hạn + trạng thái hiện tại**, không phải trạng thái người dùng đặt tay |
| 7 | Hồ sơ chuyển sang "Hoàn thành" thì **dừng** đếm quá hạn, và ghi lại đã hoàn thành trước hay sau hạn |
| 8 | Thời điểm lưu bằng `Date` UTC; hiển thị theo múi giờ Việt Nam (UTC+7) |
| 9 | Đổi trạng thái ghi timeline: ai đổi, từ trạng thái nào sang trạng thái nào, lúc nào → `rules/critical/nhat-ky-thao-tac.md` |
| 10 | Chuyển trạng thái tuân theo luồng cho phép — không cho nhảy từ "Mới" sang "Hoàn thành" |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Viết cứng số ngày SLA trong hàm tính |
| 2 | Tính hạn bằng ngày tự nhiên khi đơn vị là ngày làm việc |
| 3 | Tính lại `slaDeadline` mỗi lần đọc (hồ sơ cũ đổi hạn khi cán bộ sửa cấu hình = báo cáo lịch sử thay đổi) |
| 4 | Lưu `daysLeft` vào cơ sở dữ liệu (hôm sau là sai) |
| 5 | Cho phép đặt tay trạng thái "Quá hạn" |
| 6 | Cron tự đóng hồ sơ quá hạn mà không ghi timeline "hệ thống tự đổi" |
| 7 | Dùng giờ máy chủ theo múi giờ cục bộ để so hạn (máy chủ có thể ở múi giờ khác) |
| 8 | Đếm hồ sơ đã xoá mềm vào thống kê quá hạn |

## Trạng thái đang dùng

| Nghiệp vụ | Trạng thái (khoá) |
|---|---|
| Nhiệm vụ | `moi` `dang` `cho` `qua` `xong` |
| Văn bản / đơn thư | `moi` `dangxl` `choduyet` `xong` |
| Mức ưu tiên | `cao` `tb` `thap` |
| Độ khẩn văn bản | `Thường` `Khẩn` `Hoả tốc` |
| Nguồn nhiệm vụ | `vb` (văn bản) `pa` (phản ánh) `hop` (kết luận họp) |

Nhãn tiếng Việt và màu ở `status.config.ts`. Thêm trạng thái → sửa cấu hình đó **và**
`@IsIn` của DTO backend **và** kiểu ở 4 module → `skills/dong-bo-kieu-4-module`

→ `rules/critical/khong-hardcode.md` · `skills/bao-cao-va-xuat-file` · `data/glossary.md`
