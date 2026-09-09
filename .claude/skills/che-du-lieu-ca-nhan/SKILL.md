---
name: che-du-lieu-ca-nhan
description: Dùng khi trả dữ liệu cá nhân ra API, hiển thị số điện thoại hoặc CCCD, ghi log, xuất báo cáo, ẩn danh dữ liệu theo yêu cầu xoá. Kích hoạt bởi: maskPhone, maskCccd, che số điện thoại, ẩn danh, anonymize, PII, dữ liệu cá nhân, redact, số CCCD, căn cước, xoá dữ liệu cá nhân, quyền được xoá.
---

# Kỹ năng: Che và ẩn danh dữ liệu cá nhân
# Mức: TỐI QUAN TRỌNG | Ngăn: lộ dữ liệu cá nhân qua API, log, báo cáo, tệp xuất

## Cách che hiện dùng — giữ nhất quán

| Loại | Cách che | Ví dụ |
|---|---|---|
| Số điện thoại | Giữ 3 số đầu + 3 số cuối, giữa là `•••` | `0912480311` → `091•••311` |
| Số CCCD | `maskCccd` trong `integrations/idcard/idcard.provider.ts` | |
| Chuỗi ngắn hơn ngưỡng | Giữ nguyên (che sẽ vô nghĩa) | `09123` → `09123` |
| Rỗng / `undefined` | Trả chuỗi rỗng, **không** trả `null`/`undefined` ra API | |

## NỢ KỸ THUẬT PHẢI TRẢ

`maskPhone` hiện **lặp lại ở ba nơi**:

| Tệp | Ghi chú |
|---|---|
| `modules/users/users.service.ts:112` | Bản gốc |
| `modules/feedback/feedback.service.ts:667` | Bản sao |
| `modules/dossiers/dossiers.service.ts:77` | Bản sao, có comment "GIỮ NGUYÊN cách của UsersService.maskPhone" |

Đây là rủi ro thật: sửa một chỗ, hai chỗ còn lại vẫn lộ theo cách cũ. **Khi chạm vào bất
kỳ chỗ nào trong ba chỗ đó**, gom về `libs/shared/src/privacy/mask.ts`, giữ nguyên hành
vi (test hiện có ở `dossiers.service.spec.ts` phải vẫn xanh), rồi cập nhật cả ba nơi
trong cùng một commit.

## MUST

| # | Luật |
|---|------|
| 1 | Số điện thoại và CCCD ra API **luôn** đi qua hàm che, trừ endpoint đã được yêu cầu tường minh là trả số thật |
| 2 | Endpoint trả số thật phải: có quyền riêng, ghi vết ai xem, và ghi lý do vào tài liệu |
| 3 | Che ở **tầng service** ngay trước khi trả, không che ở client — client nào quên là lộ |
| 4 | Tệp xuất (Excel, PDF, PPTX) áp dụng cùng chính sách che như API → `skills/bao-cao-va-xuat-file` |
| 5 | Nhật ký thao tác che theo `REDACTED_FIELDS`; thêm trường nhạy cảm mới thì thêm vào danh sách đó cùng lượt |
| 6 | Nội dung đơn thư (`content`) coi như **nhạy cảm** — nó có thể chứa thông tin về người thứ ba |
| 7 | Ẩn danh (theo yêu cầu xoá dữ liệu cá nhân) thay giá trị bằng giá trị đã xoá nhận diện, **giữ nguyên** hồ sơ nghiệp vụ và nhật ký |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Viết lại hàm che ở chỗ thứ tư |
| 2 | Che bằng cách cắt bớt chuỗi tuỳ ý (mỗi nơi một kiểu → không nhận diện được là cùng một người) |
| 3 | Che ở giao diện mà API vẫn trả số đầy đủ (mở DevTools là thấy) |
| 4 | Trả `null` thay cho chuỗi rỗng khi không có dữ liệu (client 4 module xử lý `null` khác nhau) |
| 5 | Ẩn danh bằng cách **xoá cứng** bản ghi → `rules/critical/bao-toan-du-lieu.md` |
| 6 | Đặt số điện thoại dạng rõ làm khoá cache, khoá phòng socket, hay tên tệp |

## Ẩn danh theo yêu cầu xoá dữ liệu cá nhân (NĐ 13/2023)

Trình tự khi công dân yêu cầu xoá:

1. Ghi nhận yêu cầu + ghi vết (ai yêu cầu, lúc nào, qua kênh nào)
2. Với **tài khoản**: xoá mềm, thu hồi phiên, ẩn danh `citizenName`, `citizenPhone`
3. Với **hồ sơ nghiệp vụ đã xử lý xong**: ẩn danh trường định danh, giữ nội dung nghiệp vụ
   và kết quả xử lý (đây là tài liệu hành chính, không được tiêu huỷ)
4. Với **tệp đính kèm là ảnh có mặt người**: đánh dấu để cán bộ quyết định — không tự xoá
5. Với **nhật ký thao tác**: giữ nguyên (nhật ký là bất biến), `actor` đã ở dạng che
6. Ghi kết quả vào nhật ký và thông báo cho công dân

Chưa có quy trình hành chính tương ứng thì **không tự làm** — nêu ra và hỏi.

→ `rules/critical/du-lieu-ca-nhan.md` · `data/tuan-thu-phap-ly.md` · `skills/ke-thua-truoc-khi-viet-moi`
