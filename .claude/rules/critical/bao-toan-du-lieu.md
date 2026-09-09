# Luật: Bảo toàn dữ liệu — không xoá cứng, không mất mát
# Mức: TỐI QUAN TRỌNG | Cưỡng chế: BẮT BUỘC
# Ngăn: mất hồ sơ có giá trị pháp lý, mất dữ liệu do migration, không phục hồi được

## Vì sao khắt khe hơn app thương mại

Văn bản đến/đi, đơn thư, phiếu phản ánh, quyết định giải ngân là **tài liệu hành chính**.
Chúng có thời hạn lưu trữ theo quy định, có thể bị thanh tra, có thể là bằng chứng trong
khiếu nại. Xoá một bản ghi ở đây không phải là "dọn dữ liệu" — nó là **tiêu huỷ tài liệu**,
việc chỉ được làm theo quy trình hành chính, không phải bằng một lệnh Mongo.

## Phân loại dữ liệu

| Loại | Ví dụ collection | Được xoá cứng? |
|---|---|---|
| **Hồ sơ nghiệp vụ** | văn bản, đơn thư, phản ánh, nhiệm vụ, giải ngân, hồ sơ một cửa | **KHÔNG** — chỉ xoá mềm |
| **Tài khoản** | `staff_users`, `citizen_users` | **KHÔNG** — xoá mềm + thu hồi phiên |
| **Nhật ký** | `audit_logs`, timeline, `broadcast_logs` | **KHÔNG** — bất biến |
| **Tệp nghiệp vụ** | scan văn bản, ảnh hiện trường | **KHÔNG** khi còn bản ghi tham chiếu |
| Kỹ thuật, có TTL | `otp_codes`, `login_sessions`, cache | Có — hết hạn tự xoá |
| Nội dung CMS | tin, audio, video đăng cho công dân | Có, nhưng ghi vết ai xoá |

## MUST

| # | Luật |
|---|------|
| 1 | Xoá bản ghi nghiệp vụ = **xoá mềm**: đặt cờ trạng thái (`deletedAt` / `status = 'deleted'`), ghi ai xoá + lúc nào + lý do, rồi loại khỏi mọi truy vấn đọc bằng bộ lọc |
| 2 | Mọi truy vấn đọc trên collection có xoá mềm **phải** loại bản ghi đã xoá — thiếu bộ lọc là hồ sơ đã xoá hiện lại trên báo cáo |
| 3 | Đổi schema Mongoose: chỉ **thêm** trường có mặc định an toàn, hoặc **nới** ràng buộc. Đổi nghĩa/kiểu của trường đang có dữ liệu thì phải có script di trú + bản sao lưu trước |
| 4 | Script chạm dữ liệu thật: in ra số bản ghi sẽ ảnh hưởng, chạy chế độ thử (`--dry-run`) trước, và yêu cầu xác nhận tường minh |
| 5 | `seed.ts` phân biệt rõ `--fresh` (dựng lại từ trắng, **chỉ** cho máy phát triển) và chế độ bổ sung. Chạy `--fresh` trên dữ liệu thật là mất dữ liệu |
| 6 | Trước mọi việc chạm dữ liệu production: xác nhận đã có `mongodump` gần nhất (`deploy/backup-mongo.sh`) |
| 7 | Xoá tệp khỏi kho lưu trữ chỉ sau khi không còn bản ghi nghiệp vụ nào tham chiếu tới nó |

## MUST NOT

| # | Luật |
|---|------|
| 1 | `deleteMany()` · `deleteOne()` · `findOneAndDelete()` · `remove()` trên collection nghiệp vụ |
| 2 | `db.dropDatabase()` · `collection.drop()` · `dropIndexes()` ở bất kỳ đâu ngoài môi trường test dùng `mongodb-memory-server` |
| 3 | `updateMany` không có bộ lọc, hoặc bộ lọc rỗng `{}` |
| 4 | Xoá trường khỏi schema mà chưa xử lý dữ liệu đang nằm ở trường đó |
| 5 | `rm -rf` thư mục `uploads/` hoặc bất kỳ thư mục dữ liệu |
| 6 | `git reset --hard` · `git clean -fd` · `git push --force` trên nhánh có người khác dùng |
| 7 | Sửa dữ liệu thật trực tiếp bằng `mongosh` mà không ghi vết và không sao lưu trước |

## Điều kiện DỪNG

Bất kỳ lệnh nào có thể làm mất dữ liệu không phục hồi được → **DỪNG, nói rõ lệnh sẽ ảnh
hưởng những gì, và chờ người dùng xác nhận tường minh.** Không tự chạy dù người dùng có
vẻ đã đồng ý ở một ngữ cảnh khác.

## Khi thật sự cần xoá vĩnh viễn

Chỉ có một tình huống hợp pháp: **công dân yêu cầu xoá dữ liệu cá nhân** theo Nghị định
13/2023/NĐ-CP. Cách làm: ẩn danh dữ liệu cá nhân (thay bằng giá trị đã xoá nhận diện),
**giữ nguyên** phần hồ sơ nghiệp vụ và nhật ký, ghi vết việc xoá.
→ `skills/tuan-thu-phap-ly`

→ `nhat-ky-thao-tac.md` · `du-lieu-ca-nhan.md` · `skills/mongoose-schema-conventions`
