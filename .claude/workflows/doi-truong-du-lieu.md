# Quy trình: Thêm / đổi một trường dữ liệu

Dùng khi: thêm trường, đổi tên trường, đổi kiểu trường — việc ảnh hưởng nhiều module.

## Vì sao cần một quy trình riêng

TypeScript **không** bắt được lệch giữa bốn module — mỗi module biên dịch riêng, không
import chéo nhau. Lệch trường chỉ hiện ra lúc chạy thật, dưới dạng ô trống trên giao
diện hoặc `undefined` trong dữ liệu. Không có test nào tự bắt được.

## Sáu bước, MỘT commit

| # | Việc | Tệp |
|---|---|---|
| 1 | Sửa **nguồn chuẩn** | `admin-web/src/types/index.ts` |
| 2 | Sửa backend: schema + DTO + hàm map trả về | `*.schema.ts`, `dto/`, `*.service.ts` |
| 3 | Sửa admin-web: service + component đang đọc trường đó | `src/services/`, `src/features/` |
| 4 | Sửa zalo-miniapp (nếu trường tới công dân) | `src/types/`, `src/services/`, `src/features/` |
| 5 | Sửa mobile (nếu trường tới công dân) | `lib/models/` + `fromJson`/`toJson` + widget |
| 6 | Cập nhật `data/glossary.md` nếu là khái niệm nghiệp vụ mới | |

Rồi: `npm run check:all` ở gốc — type-check + lint **cả 4 module**.

**Chia thành nhiều commit là để lại trạng thái lệch trong lịch sử.** Trường không tới
kênh công dân thì bỏ bước 4 và 5, nhưng phải nói rõ trong commit message.

## THÊM trường mới

| # | Kiểm |
|---|------|
| 1 | Có `default` an toàn chưa? Bản ghi cũ **không** có trường này |
| 2 | Có phải dữ liệu cá nhân không? → `workflows/xu-ly-du-lieu-ca-nhan.md` |
| 3 | Client có được phép **đặt** trường này không? Nếu không → **không** khai trong DTO |
| 4 | Có dùng để lọc/sắp xếp không? → thêm index |
| 5 | Là enum nghiệp vụ? → danh sách giá trị đọc từ **cấu hình**, không viết cứng trong DTO |
| 6 | Trường không có giá trị trả **chuỗi rỗng / mảng rỗng**, không trả `null` |

## ĐỔI TÊN trường

Đây là **thay đổi phá vỡ** với client đang chạy thật (app đã cài trên máy người dân).

1. Backend trả **cả hai** tên một thời gian
2. Cập nhật cả bốn module
3. Phát hành client, chờ người dùng cập nhật
4. Mới bỏ tên cũ

## ĐỔI KIỂU / ĐỔI NGHĨA trường đang có dữ liệu

**DỪNG. Hỏi trước khi làm.** Đây là việc có thể mất dữ liệu.

Nếu được đồng ý, bắt buộc:

1. Sao lưu MongoDB trước (`deploy/backup-mongo.sh`)
2. Viết script di trú có chế độ thử (`--dry-run`), in ra số bản ghi sẽ ảnh hưởng
3. Chạy thử trên bản sao dữ liệu
4. Ghi lại việc di trú vào `docs/` (và ADR nếu là quyết định có tranh luận)
5. **Không** xoá trường cũ ngay — giữ song song tới khi chắc chắn

→ `rules/critical/bao-toan-du-lieu.md`

## Quy ước tên trường

| Loại | Quy ước |
|---|---|
| Tên trường | `camelCase` tiếng Anh, **giống nhau** ở cả 4 module |
| Khoá trạng thái / danh mục | chuỗi ngắn không dấu (`moi`, `rac-thai`) — nhãn tiếng Việt ở cấu hình |
| Ngày giờ qua API | chuỗi ISO 8601; mỗi client tự định dạng |
| Tiền | **số nguyên đơn vị đồng** |
| Trường chủ sở hữu (công dân) | `citizenPhone` / `applicantPhone` + **index** |

→ `workflows/_INDEX.md` · `skills/dong-bo-kieu-4-module`
