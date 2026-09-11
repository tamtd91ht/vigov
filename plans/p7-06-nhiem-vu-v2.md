# P7-06 — Phân hệ Nhiệm vụ v2: sáu hạn chế còn lại

> Trạng thái: **pending** · Lập 11/09/2026 · Phụ thuộc: **P7-02**
> Nguồn: `docs/nang-cap-v2/nhiem-vu.md` mục 8–9

## 1. Phạm vi

Sáu hạn chế **riêng của phân hệ Nhiệm vụ**, không giải quyết được bằng khuôn dùng chung.
Các hạn chế toàn app (H-08, H-13, H-14, H-20) đã nằm ở P7-01/02/04.

| # | Hạn chế | Việc |
|---|---|---|
| H-01 | "Quá hạn" nhốt chung enum `status` | Bỏ `qua` khỏi enum; **suy ra** từ `deadline` mỗi lần đọc, **không lưu cờ** — theo nguyên tắc đã chốt ở Giải ngân (`budget.schema.ts:17-26`) |
| H-02 | Trang không có ô tìm từ khoá | Thêm ô tìm, gửi `q` (API đã nhận sẵn) |
| H-03 | Chỉ lọc theo ngày giao | Thêm lọc theo **hạn xử lý**, tách khỏi lọc ngày giao |
| H-04 | Số đếm cột Kanban sai khi quá 100 nhiệm vụ | Thêm `GET /tasks/stats` trả số lượng theo trạng thái trên **toàn bộ** bộ lọc |
| H-10 H-11 | Tick việc con theo chỉ số; sửa checklist ghi đè cả mảng | Việc con có id ổn định; thêm khoá phiên bản lạc quan cho `PATCH /tasks/:code` |
| H-12 | Tiến độ và checklist lệch nhau được | `progress` là giá trị **suy ra**, không nhận từ client |

## 2. H-01 đáng nói riêng

Cron 07:00 hằng ngày đang ghi `status = 'qua'`, **đè mất** trạng thái nghiệp vụ trước đó
(`đang thực hiện` / `chờ duyệt`). Dữ liệu đã đè **không khôi phục được** — không có trường
nào lưu trạng thái cũ.

Nghĩa là: mỗi ngày trì hoãn là thêm một lô bản ghi mất thông tin. Đây là lý do H-01 xếp ưu
tiên 1 trong bảng đánh giá, trên cả các nợ lớn hơn về quy mô.

Sau khi sửa: `markOverdue` **không** còn đổi `status`; nó chỉ ghi một mục nhật ký
`task.overdue` và gửi cảnh báo. Trạng thái quá hạn hiển thị được nhờ so `deadline` với hiện
tại ở tầng đọc.

Việc di trú cho bản ghi **đã bị đè**: không suy lại được trạng thái gốc. Đề xuất đặt về
`dang` (đang thực hiện) và ghi một mục nhật ký nói rõ giá trị này do di trú đặt — **cần
khách xác nhận**, vì đây là sửa dữ liệu hồ sơ.

## 3. Checklist

- [ ] Bỏ `qua` khỏi enum `status` của `task.schema.ts` và DTO
- [ ] `markOverdue` chỉ ghi nhật ký, không đổi trạng thái
- [ ] Trạng thái quá hạn suy ra ở tầng đọc; Kanban và bảng hiển thị như cột/nhãn riêng
- [ ] `GET /tasks/stats` + Kanban dùng số từ máy chủ
- [ ] Ô tìm từ khoá + lọc theo hạn xử lý trên `TasksPage`
- [ ] Việc con có id; `PATCH /tasks/:code/checklist/:itemId`
- [ ] Khoá phiên bản lạc quan cho `PATCH /tasks/:code`
- [ ] `progress` bỏ khỏi `UpdateTaskDto`
- [ ] Test: quá hạn suy ra đúng ở biên (hôm nay là hạn thì **chưa** quá hạn)
- [ ] Test: hai lượt sửa đồng thời — lượt sau bị từ chối, không ghi đè lặng lẽ
- [ ] Cập nhật `docs/nang-cap-v2/nhiem-vu.md`: đánh dấu hạn chế đã xử lý

## 4. Việc KHÔNG làm

| Không làm | Vì sao |
|---|---|
| Kéo-thả Kanban (H-05) | Việc giao diện thuần, tách task riêng cho gọn |
| Nút "Nhắc việc" (H-06) và thông báo người nhận việc (H-07) | Cần chốt kênh gửi — câu hỏi mở #6 |
| Giới hạn sửa theo bộ phận (H-17) | Câu hỏi chưa chốt, xem P7-03 mục 6 |
| Che mô tả nhiệm vụ sinh từ phản ánh (H-16) | Nghĩa vụ theo NĐ 13/2023 nhưng cần khách chốt ai được đọc — task riêng |
