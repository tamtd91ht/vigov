# Luật: Dữ liệu cá nhân của công dân
# Mức: TỐI QUAN TRỌNG | Cưỡng chế: BẮT BUỘC (không có ngoại lệ tự quyết)
# Ngăn: lộ dữ liệu cá nhân, vi phạm Nghị định 13/2023/NĐ-CP, sự cố phải giải trình

## Dữ liệu nào là dữ liệu cá nhân ở ViGov

| Nhóm | Trường | Mức |
|---|---|---|
| Định danh cơ bản | `citizenPhone`, `applicantPhone`, `citizenName`, `phone` | Cá nhân cơ bản |
| Địa chỉ / vị trí | `address`, `location`, `lat`, `lng` của phiếu phản ánh | Cá nhân cơ bản |
| Thẻ căn cước | số CCCD, ngày sinh, quê quán, ảnh mặt thẻ (module `idcard`) | **Cá nhân CƠ BẢN + có thể suy ra dữ liệu nhạy cảm** |
| Nội dung đơn thư | `content` của phản ánh, khiếu nại, tố cáo | **Nhạy cảm** — có thể chứa thông tin về người khác |
| Ảnh hiện trường | tệp `purpose = scan/feedback` | Cá nhân — có thể chứa mặt người, biển số |
| Xác thực | `passwordHash`, mã OTP, refresh token, `sid` | Bí mật xác thực |

## MUST

| # | Luật |
|---|------|
| 1 | Số điện thoại trả ra API **luôn** đi qua hàm che (`maskPhone` — giữ 3 số đầu + 3 số cuối). Chỉ trả số đầy đủ ở đúng endpoint đã được yêu cầu tường minh và đã ghi vết ai xem |
| 2 | Số CCCD trả ra API đi qua `maskCccd`. Ảnh thẻ căn cước là tệp `isPrivate = true`, không bao giờ công khai |
| 3 | Mọi trường bí mật xác thực khai báo `select: false` trên schema Mongoose |
| 4 | Mã OTP **chỉ lưu HMAC**, không lưu dạng rõ — kể cả trong bộ nhớ |
| 5 | Nhật ký thao tác che trường nhạy cảm trước khi lưu (`REDACTED_FIELDS` trong `audit.interceptor.ts`) — thêm trường nhạy cảm mới thì **phải** thêm vào danh sách này |
| 6 | Gửi dữ liệu cá nhân sang bên thứ 3 (ZNS, FCM, OCR, đọc CCCD) chỉ được gửi **đúng trường tối thiểu** cho việc đó, và phải đi qua adapter (`skills/adapter-ben-thu-ba`) |
| 7 | Xoá tài khoản công dân → xoá/ẩn danh dữ liệu cá nhân theo `skills/tuan-thu-phap-ly`, giữ lại phần hồ sơ nghiệp vụ đã ẩn danh |

## MUST NOT

| # | Luật |
|---|------|
| 1 | `console.log` / `logger.log` / `print()` bất kỳ giá trị nào là số điện thoại, CCCD, OTP, mật khẩu, token — **kể cả khi debug** |
| 2 | Đưa số điện thoại, CCCD, tên công dân vào message lỗi trả về client |
| 3 | Đưa dữ liệu cá nhân vào URL, query string, hoặc tên tệp (nằm trong log nginx, lịch sử trình duyệt, Referer) |
| 4 | Đưa dữ liệu cá nhân thật vào seed data, mock data, test fixture, hoặc tài liệu |
| 5 | Đặt số điện thoại / CCCD làm khoá cache hoặc khoá phòng socket ở dạng rõ |
| 6 | Trả về danh sách công dân không phân trang, không giới hạn |
| 7 | Bật `select: true` cho `passwordHash` "để tiện kiểm tra" |

## Điều kiện DỪNG

Dừng ngay và hỏi người dùng nếu việc đang làm dẫn tới một trong các tình huống:

- Trả dữ liệu cá nhân ở dạng rõ cho một vai trò chưa được chốt là được xem
- Gửi dữ liệu cá nhân sang một hệ thống bên ngoài chưa có trong `configuration.ts`
- Ghi dữ liệu cá nhân vào một kho mới (log tập trung, hệ thống báo cáo, file xuất)

## Ràng buộc pháp lý

Nghị định 13/2023/NĐ-CP: xử lý dữ liệu cá nhân phải có **cơ sở pháp lý**, phải
**thông báo mục đích**, phải **giới hạn phạm vi**, và chủ thể có **quyền yêu cầu xoá**.
Thực tế với ViGov: mỗi trường dữ liệu cá nhân thu thập phải trả lời được "thu để làm gì,
ai xem được, giữ bao lâu". Chưa trả lời được thì chưa thu.
→ Chi tiết: `data/tuan-thu-phap-ly.md` · thực thi: `skills/che-du-lieu-ca-nhan`

## Nợ kỹ thuật đã biết

`maskPhone` hiện **lặp lại ở 3 nơi** (`users.service.ts`, `feedback.service.ts`,
`dossiers.service.ts`). Đây là rủi ro: sửa một chỗ, hai chỗ còn lại vẫn lộ.
Khi chạm vào bất kỳ chỗ nào trong ba chỗ đó, gom về `libs/shared/src/privacy/`.

→ `cach-ly-du-lieu-cong-dan.md` · `nhat-ky-thao-tac.md` · `skills/che-du-lieu-ca-nhan`
