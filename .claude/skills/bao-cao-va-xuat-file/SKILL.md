---
name: bao-cao-va-xuat-file
description: Dùng khi làm báo cáo, thống kê, biểu đồ, xuất Excel/PDF/PowerPoint, tổng hợp số liệu cho lãnh đạo. Kích hoạt bởi: báo cáo, thống kê, xuất Excel, xlsx, exceljs, PDF, pdfmake, PPTX, pptxgenjs, biểu đồ, tổng hợp, số liệu, dashboard, reports.
---

# Kỹ năng: Báo cáo và xuất tệp
# Mức: CAO | Ngăn: số liệu sai đi vào báo cáo cấp trên, dữ liệu cá nhân lọt vào tệp xuất

## Vì sao con số ở đây phải đúng tuyệt đối

Báo cáo của ViGov đi lên cấp trên và vào đánh giá cán bộ. Một con số lệch không phải là
lỗi hiển thị — nó là báo cáo sai của một cơ quan nhà nước. Nếu không chắc một con số,
**hiện "chưa có dữ liệu" thay vì hiện số ước lượng**.

## MUST

| # | Luật |
|---|------|
| 1 | Mọi thống kê loại bản ghi đã xoá mềm: `deletedAt: null` trong bộ lọc |
| 2 | Thống kê theo khoảng thời gian nói rõ **mốc đầu và mốc cuối** trên báo cáo, kèm múi giờ |
| 3 | Con số đếm dùng `countDocuments` có bộ lọc hoặc `aggregate` có `$match` đầu tiên |
| 4 | Tệp xuất áp dụng **cùng** chính sách che dữ liệu cá nhân như API → `skills/che-du-lieu-ca-nhan` |
| 5 | Tệp xuất ghi ở chân trang: tên cơ quan (đọc từ cấu hình), thời điểm xuất, người xuất |
| 6 | Xuất tệp là thao tác **ghi vết** — ai xuất báo cáo gì lúc nào → `rules/critical/nhat-ky-thao-tac.md` |
| 7 | Số liệu bằng 0 hiện `0`, không hiện rỗng. Không có dữ liệu hiện "Chưa có dữ liệu" |
| 8 | Tiền hiển thị đơn vị đồng, có dấu phân cách nghìn theo chuẩn Việt Nam, không thập phân |
| 9 | Ngày trên báo cáo định dạng `dd/MM/yyyy` |
| 10 | Xuất tệp lớn có giới hạn số dòng và giới hạn khoảng thời gian — chặn ở DTO |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Tính tỷ lệ phần trăm khi mẫu số bằng 0 (hiện `—`, không hiện `NaN` hay `Infinity`) |
| 2 | Làm tròn trước khi cộng (cộng trước, làm tròn sau) |
| 3 | Đưa số điện thoại, CCCD, hay nội dung đơn thư đầy đủ vào tệp xuất trừ khi được yêu cầu tường minh và có phân quyền riêng |
| 4 | Xuất toàn bộ collection không giới hạn (làm treo máy chủ, và tệp không mở được) |
| 5 | Trộn dữ liệu của nhiều xã vào một báo cáo khi hệ thống chưa chốt câu hỏi mở #13 |
| 6 | Đặt tên tệp xuất chứa dữ liệu cá nhân |
| 7 | Sinh biểu đồ có nhãn tiếng Anh |
| 8 | Ghi tệp tạm vào thư mục mã nguồn — dùng thư mục tạm của hệ thống, xoá sau khi gửi |

## Thư viện đang dùng

| Định dạng | Thư viện | Ghi chú |
|---|---|---|
| Excel `.xlsx` | `exceljs` | Chỉ dùng để **ghi**; `npm audit` cảnh báo `uuid` bắc cầu ở mức trung bình, **không** chạm tới đường mã bị lỗi. Không `audit fix --force` (hạ `exceljs` xuống 3.4.0, phá API) |
| PDF | `pdfmake` | Cần khai font có dấu tiếng Việt, nếu không chữ ra ô vuông |
| PowerPoint | `pptxgenjs` | Dùng cho báo cáo trình bày trước lãnh đạo |

## Kiểm tra một báo cáo trước khi coi là xong

1. Đối chiếu một con số với truy vấn tay trên cùng bộ dữ liệu — có khớp?
2. Bộ lọc có loại bản ghi đã xoá mềm chưa?
3. Có mốc thời gian nào tính theo múi giờ máy chủ thay vì UTC+7?
4. Mở tệp xuất — chữ tiếng Việt có dấu đủ không? Có dữ liệu cá nhân nào không nên có?
5. Trường hợp không có dữ liệu — báo cáo hiện gì?

→ `skills/sla-va-trang-thai` · `skills/tim-kiem-mongo-an-toan` · `skills/che-du-lieu-ca-nhan`
