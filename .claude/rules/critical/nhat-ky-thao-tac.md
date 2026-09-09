# Luật: Nhật ký thao tác (audit trail)
# Mức: TỐI QUAN TRỌNG | Cưỡng chế: BẮT BUỘC
# Ngăn: thao tác không truy được trách nhiệm, không giải trình được khi có khiếu nại

## Vì sao bắt buộc, không phải "nên có"

Đây là hệ thống của cơ quan nhà nước. Khi một phiếu phản ánh bị đóng sai, một quyết
định giải ngân bị sửa, một tài khoản công dân bị khoá — sẽ có người hỏi **ai làm, lúc
nào, dựa trên gì**. Không trả lời được là sự cố hành chính, không phải sự cố kỹ thuật.
Nhật ký thao tác phải giữ **tối thiểu 12 tháng** (SECURITY.md mục 4).

## Cơ chế hiện có

`AuditInterceptor` (`modules/audit/audit.interceptor.ts`) đăng ký `APP_INTERCEPTOR`
toàn ứng dụng, tự ghi vết **mọi request `POST`/`PATCH`/`PUT`/`DELETE` thành công**:
`actor` · `action` · `resource` (đường route đã bỏ tiền tố) · `resourceId` · `after`
(body đã che) · `ip`. Request lỗi **không** bị ghi (chỉ `tap` nhánh next).

## MUST

| # | Luật |
|---|------|
| 1 | Thao tác thay đổi dữ liệu nghiệp vụ đi qua **HTTP + phương thức ghi** để interceptor bắt được. Đổi dữ liệu bằng script, cron, hay consumer thì **phải tự gọi `AuditService.record`** |
| 2 | Trường nhạy cảm mới xuất hiện trong body → thêm vào `REDACTED_FIELDS` **cùng lúc** với việc thêm trường vào DTO |
| 3 | Hành động nghiệp vụ quan trọng ghi thêm vết nghiệp vụ (timeline) ngoài audit log: phê duyệt, từ chối, chuyển xử lý, đóng phiếu, giải ngân, khoá tài khoản |
| 4 | Timeline nghiệp vụ ghi **ai** (tên cán bộ + đơn vị) và **lúc nào**, hiển thị được cho người có quyền xem hồ sơ |
| 5 | `resourceId` phải suy ra được — route đặt tham số đường dẫn theo `ID_PARAM_KEYS` (`id`, `code`, `username`, `phone`, `arrivalNo`) hoặc bổ sung khoá mới vào danh sách đó |
| 6 | Thao tác của **công dân** (gửi phản ánh, đánh giá, sửa hồ sơ cá nhân) cũng ghi vết — `actor` là số điện thoại đã che |
| 7 | Xoá mềm ghi rõ: ai xoá, lúc nào, lý do → `bao-toan-du-lieu.md` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Đổi dữ liệu nghiệp vụ bằng `GET` (interceptor không ghi, và `GET` phải là đọc thuần) |
| 2 | Sửa hoặc xoá bản ghi trong collection nhật ký (`audit_logs`) — nhật ký là bất biến |
| 3 | Bỏ `AuditInterceptor` khỏi module "cho nhanh" hoặc "vì nó ồn" |
| 4 | Ghi giá trị nhạy cảm dạng rõ vào `after` — che trước, ghi sau |
| 5 | Ghi vết bằng `console.log` thay cho `AuditService` — log tiến trình bị xoay vòng, không truy được |
| 6 | Ghi vết trong `try/catch` rồi bỏ qua lỗi mà không có cảnh báo — mất vết mà không ai biết |

## Điều kiện DỪNG

Viết một đường ghi dữ liệu nghiệp vụ **không** đi qua HTTP (script seed sửa dữ liệu thật,
consumer RabbitMQ đổi trạng thái, cron tự động đóng phiếu quá hạn) mà chưa gọi
`AuditService.record` → dừng, bổ sung ghi vết trước khi tiếp tục.

## Danh sách hành động nghiệp vụ phải có timeline riêng

Nhiệm vụ: giao · nhận · nộp · duyệt · trả lại · hoàn thành · quá hạn
Văn bản: tiếp nhận · phân xử lý · luân chuyển · ban hành · lưu
Phản ánh: tiếp nhận · phân loại · phân công · xử lý · nghiệm thu · đóng · công dân đánh giá
Giải ngân: lập · trình · duyệt · từ chối · chi · quyết toán
Tài khoản: tạo · đổi vai trò · đặt lại mật khẩu · khoá · mở khoá · xoá mềm

→ `bao-toan-du-lieu.md` · `du-lieu-ca-nhan.md` · `data/tuan-thu-phap-ly.md`
