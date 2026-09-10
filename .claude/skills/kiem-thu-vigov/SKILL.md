---
name: kiem-thu-vigov
description: Dùng khi viết test, chạy test, hoặc quyết định cần test gì cho một thay đổi. Kích hoạt bởi: test, kiểm thử, jest, spec, e2e, supertest, mongodb-memory-server, unit test, coverage, typecheck, check:all, kiểm chứng.
---

# Kỹ năng: Kiểm thử trong ViGov
# Mức: CAO | Ngăn: báo "đã xong" mà chưa chạy, hồi quy ở phần bảo mật

## Lệnh kiểm chứng

| Việc | Lệnh | Ở đâu |
|---|---|---|
| Type-check + lint **cả 4 module** | `npm run check:all` | gốc dự án |
| Type-check backend | `npx tsc --noEmit -p apps/api-gateway/tsconfig.app.json` | `backend/` |
| Test đơn vị backend | `npm test` | `backend/` |
| Test e2e backend | `npm run test:e2e` | `backend/` |
| Type-check + lint web | `npx tsc --noEmit && npm run lint` | `admin-web/`, `zalo-miniapp/` |

Test e2e dùng `mongodb-memory-server` — không cần MongoDB thật, nhưng **cần ≥ 500 MB
trống** ở thư mục tạm, nếu không MongoDB từ chối tạo text index.
Cách xử lý: dọn ổ, hoặc trỏ `TEMP`/`TMP` sang ổ khác.

## Phải có test cho những gì

| Loại thay đổi | Test bắt buộc |
|---|---|
| Endpoint mới | 401 (không token) · 403 (sai quyền) · 200 (đúng quyền) → `rules/critical/phan-quyen-rbac.md` |
| Endpoint của công dân | Thêm: công dân khác đọc bản ghi này phải **404** → `rules/critical/cach-ly-du-lieu-cong-dan.md` |
| Hàm che dữ liệu cá nhân | Che đúng, chuỗi ngắn giữ nguyên, rỗng/`undefined` trả rỗng |
| Tính SLA / hạn xử lý | Bỏ cuối tuần, bỏ ngày lễ, đúng biên (hạn là chính hôm nay) |
| Xoá mềm | Bản ghi đã xoá **không** hiện trong danh sách, **không** vào thống kê |
| Chính sách mật khẩu | Từng điều kiện một test |
| Thu hồi phiên | Token còn hạn nhưng phiên đã thu hồi → 401 |
| Xác thực DTO | Trường lạ bị từ chối (400), vượt độ dài bị từ chối |
| An toàn tệp | Tệp công khai bị từ chối khi gắn vào hồ sơ nghiệp vụ; MIME thực thi được bị chặn |
| Escape regex tìm kiếm | Từ khoá `.*` không quét toàn bảng |

## MUST

| # | Luật |
|---|------|
| 1 | Test đặt cạnh mã: `<tên>.service.spec.ts`, `<tên>.controller.spec.ts` |
| 2 | Tên test viết **tiếng Việt**, nói rõ hành vi mong đợi — theo đúng cách đang dùng (`'giữ 3 số đầu + 3 số cuối, giống UsersService.maskPhone'`) |
| 3 | Test dữ liệu cá nhân dùng số điện thoại **giả** (`0900000000`), không dùng số thật |
| 4 | Sửa hành vi có test → cập nhật test **cùng lượt**, không tắt test |
| 5 | Chạy test liên quan **trước** khi báo xong; dán kết quả thật vào phần báo cáo |
| 6 | Test thất bại thì nói rõ thất bại gì, không im lặng bỏ qua |

## MUST NOT

| # | Luật |
|---|------|
| 1 | `it.skip` / `describe.skip` / `xit` để "tạm cho qua" |
| 2 | Dữ liệu cá nhân thật trong fixture, mock, hay seed |
| 3 | Test phụ thuộc thứ tự chạy, hoặc phụ thuộc dữ liệu do test khác để lại |
| 4 | Test gọi dịch vụ ngoài thật (dùng bản `mock` của adapter → `skills/adapter-ben-thu-ba`) |
| 5 | Kết nối MongoDB thật trong test (dùng `mongodb-memory-server`) |
| 6 | Báo "đã xong" khi chưa chạy được lệnh kiểm chứng — nói rõ là chưa chạy được và vì sao |
| 7 | Đổi ngưỡng/mong đợi của test để test xanh thay vì sửa mã |

## Trước khi kết thúc một task

1. `npm run check:all` ở gốc — sạch lỗi
2. Test của module đã sửa — xanh
3. Test e2e nếu đã chạm API — xanh
4. Nói rõ trong báo cáo: lệnh nào đã chạy, kết quả gì

→ `rules/critical/phan-quyen-rbac.md` · `skills/quan-ly-task-plan` · `skills/tai-lieu-dong-bo`
