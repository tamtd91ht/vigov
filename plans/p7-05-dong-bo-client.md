# P7-05 — Đồng bộ 3 client theo khuôn v2

> Trạng thái: **pending** · Lập 11/09/2026 · Phụ thuộc: **P7-02** (hợp đồng API) và **P7-03** (quyền)

## 1. Phạm vi

Không có mã tương thích ngược, nên `admin-web` và `zalo-miniapp` phải lên **cùng lúc** với
backend. Bản client cũ sẽ hỏng ngay khi phát hành.

| Module | Việc |
|---|---|
| Kiểu dùng chung | `admin-web/src/types/index.ts` là nguồn chuẩn — đổi trước, theo `skills/dong-bo-kieu-4-module` |
| `admin-web` | Mọi trường thời gian là `number`; mọi tham chiếu là `{ id, displayName }`; bảng nhãn nhật ký; ẩn nút theo 5 hành động |
| `zalo-miniapp` | Màn phản ánh, tra cứu, chi tiết phiếu: đọc thời gian dạng số |

## 2. Ba việc dễ bỏ sót

| # | Việc | Vì sao dễ sót |
|---|---|---|
| 1 | Bảng nhãn nhật ký `admin-web/src/config/activity.config.ts` | Backend v2 không còn trả nhãn tiếng Việt, chỉ trả `action` + `detail`. Thiếu bảng này là nhật ký hiện ra khoá kỹ thuật cho cán bộ đọc — vi phạm `ngon-ngu-hanh-chinh.md` MUST NOT #4 |
| 2 | Định dạng hiển thị thời gian | Gom vào `lib/format.ts`, **không** rải `new Date(ms).toLocaleString()` trong component. Định dạng phải là `dd/MM/yyyy` và giờ 24h |
| 3 | Ô chọn cán bộ / bộ phận | Gửi lên **id**, hiển thị **tên**. Hiện `TaskForm` gửi tên (`TaskForm.tsx:200-208`) |

## 3. Checklist

- [ ] `types/index.ts`: thời gian `number`, tham chiếu `{ id, displayName }`
- [ ] `lib/format.ts`: `formatDate(ms)`, `formatDateTime(ms)`, `daysUntil(ms)` — bỏ hàm phân tích chuỗi `dd/MM/yyyy` ở `TaskTable.tsx:15-22`
- [ ] `config/activity.config.ts`: nhãn cho từng `action`
- [ ] `config/roles.config.ts`: khớp `roles.ts` v2, 5 hành động
- [ ] Mọi `services/*.service.ts`: bỏ chuyển đổi ngày dạng chuỗi
- [ ] Mọi form có ô chọn cán bộ / bộ phận: gửi id
- [ ] Ẩn/hiện nút theo hành động (`them`, `sua`, `xoa`, `duyet`)
- [ ] `zalo-miniapp`: rà mọi chỗ hiển thị ngày
- [ ] Chế độ mock (`src/mocks/`) cập nhật theo khuôn mới, nếu không demo sẽ vỡ

## 4. Cách kiểm chứng

`npm run check:all` ở cả hai client. Mở từng phân hệ, xem một bản ghi, sửa một bản ghi. Rà
lại bằng mắt: **không** còn chỗ nào hiện `NaN`, `Invalid Date`, `undefined`, hay khoá kỹ
thuật kiểu `task.status` lọt ra giao diện.
