# Quy trình: Tính năng mới / task mới

Dùng khi: bắt đầu một task trong `pending-tasks.json`, hoặc thêm một tính năng.

## Bước

| # | Việc | Kiểm chứng |
|---|---|---|
| 1 | Đọc task trong `pending-tasks.json` **và** tệp plan ở `plans/` | Nói lại được phạm vi bằng một câu |
| 2 | Đọc mã hiện có ở vùng liên quan (`codegraph_context` trước, `Read` sau) | Biết cái gì đã có → không viết trùng (`skills/ke-thua-truoc-khi-viet-moi`) |
| 3 | **Nêu giả định** + liệt kê **câu hỏi mở** đang chạm tới | Người dùng thấy ta hiểu đúng |
| 4 | Xác định module bị ảnh hưởng: backend? admin-web? mobile? zalo-miniapp? | Danh sách module |
| 5 | Xác định **luật** nào áp (xem bảng dưới) | Danh sách ràng buộc |
| 6 | Lập kế hoạch `1. [bước] → kiểm chứng: [cách xác nhận]` | Kế hoạch theo dõi được |
| 7 | Đổi trạng thái task sang `in-progress` | `pending-tasks.json` |
| 8 | Làm theo kế hoạch, từng bước một | |
| 9 | Viết test cho hành vi mới | `skills/kiem-thu-vigov` |
| 10 | Chạy `npm run check:all` + test module đã sửa | Xanh, dán kết quả thật |
| 11 | Rà soát bảo mật | `agents/ra-soat-bao-mat.md` |
| 12 | Đồng bộ tài liệu | `agents/dong-bo-tai-lieu.md` |
| 13 | Đổi trạng thái task sang `done`, cập nhật `BAO-CAO-TIEN-DO.md` | |

## Bước 5 — luật nào áp cho việc này

| Tính năng chạm tới | Luật bắt buộc đọc |
|---|---|
| Dữ liệu công dân (số điện thoại, tên, địa chỉ, ảnh, CCCD) | `du-lieu-ca-nhan.md` · `cach-ly-du-lieu-cong-dan.md` |
| Endpoint mới | `phan-quyen-rbac.md` |
| Thao tác ghi dữ liệu nghiệp vụ | `nhat-ky-thao-tac.md` |
| Xoá, đổi schema, di trú dữ liệu | `bao-toan-du-lieu.md` |
| Biến môi trường, khoá API, secret | `bi-mat-cau-hinh.md` |
| Giá trị theo từng xã (tên, SLA, danh mục, toạ độ) | `khong-hardcode.md` |
| Chuỗi hiển thị cho người dùng | `ngon-ngu-hanh-chinh.md` |
| Giao diện công dân | + `skills/tiep-can-nguoi-cao-tuoi` |

## Điều kiện DỪNG — hỏi, đừng đoán

- Yêu cầu có **hai cách hiểu** dẫn tới hai kết quả khác nhau
- Task chạm một **câu hỏi mở** của khách hàng
- Cần **thêm một trường dữ liệu cá nhân** mới → `workflows/xu-ly-du-lieu-ca-nhan.md`
- Cần **đổi kiểu/nghĩa** một trường đang có dữ liệu
- Cần **nới một chốt bảo mật** (hạn mức, thời hạn token, quyền)
- Không biết nghiệp vụ hành chính thật sự chạy thế nào

## Báo cáo cuối

Nói rõ bốn thứ:

1. Đã làm gì (theo kế hoạch ở bước 6)
2. Đã chạy lệnh nào, kết quả gì
3. Đã cập nhật tài liệu nào
4. **Còn gì chưa làm và vì sao** — kể cả giả định đã dùng

→ `workflows/_INDEX.md` · `skills/quan-ly-task-plan`
