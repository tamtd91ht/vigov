# P7-03 — Bộ quyền theo tính năng: phân hệ × 5 hành động

> Trạng thái: **pending** · Lập 11/09/2026 · Độc lập với P7-01/02, nhưng cùng một đợt phát hành

## 1. Quyết định đã chốt (11/09/2026) — đóng câu hỏi mở #12

Phân quyền **theo tính năng**, gồm hai phần như người dùng nêu: **menu tính năng** (thấy
hay không thấy phân hệ) và **chức năng** (làm được gì trong phân hệ).

Bộ hành động: **xem · thêm · sửa · xoá · duyệt**.

Giữ `duyệt` là hành động riêng, không gộp vào `sửa` — vai trò Lãnh đạo phê duyệt hiện dùng
nó cho phê duyệt giải ngân, ban hành văn bản, nghiệm thu phản ánh. Gộp lại thì Kế toán duyệt
được chính đề nghị của mình.

## 2. Khung mới

v1 là **thứ bậc**: `view < edit < approve < admin` — một cán bộ có `approve` thì tự động có
`edit`, nên không diễn tả được "được duyệt nhưng không được sửa".

v2 là **tập hợp**: mỗi phân hệ giữ một tập hành động, không suy ra lẫn nhau.

```
modules: {
  tasks:        ['xem', 'them', 'sua', 'duyet'],
  disbursement: ['xem', 'duyet'],
  users:        ['xem'],
  ...
}
```

`menu` suy ra từ việc tập hành động **có `xem`** — không khai riêng, để giao diện và API
không thể lệch nhau.

| Việc | Tệp |
|---|---|
| Nguồn chuẩn | `backend/libs/shared/src/auth/roles.ts` |
| Bản sao cho giao diện | `admin-web/src/config/roles.config.ts` |
| Guard | `RequirePermission(phân_hệ, hành_động)` — đổi tham số thứ hai sang tập hành động mới |
| Điểm phải ánh xạ lại | **136** chỗ khai `@RequirePermission` trong 16 controller |
| Giữ nguyên | 22 chỗ `@Public()` / `@AnyAuthenticated()` |

## 3. Bảng ánh xạ v1 → v2 (đề xuất, cần khách xác nhận)

| Quyền v1 | Tập hành động v2 |
|---|---|
| `view` | `xem` |
| `edit` | `xem` `them` `sua` |
| `approve` | `xem` `them` `sua` `duyet` |
| `admin` | `xem` `them` `sua` `xoa` `duyet` |

Ánh xạ này **giữ nguyên hành vi hiện tại**, chỉ đổi cách diễn tả. Việc siết lại cho từng vai
trò (ví dụ Lãnh đạo chỉ `xem` + `duyet`, không `them`) là **quyết định nghiệp vụ của khách** —
liệt kê thành bảng để khách tick, không tự chốt.

## 4. Checklist

- [ ] Kiểu `Action = 'xem' | 'them' | 'sua' | 'xoa' | 'duyet'`
- [ ] `roles.ts`: 5 vai trò × 10 phân hệ, khai tập hành động tường minh, **không** để `undefined`
- [ ] `hasPermission(roleKey, module, action)` kiểm theo tập hợp, bỏ so sánh thứ bậc
- [ ] Ánh xạ 136 điểm `@RequirePermission` theo bảng mục 3
- [ ] `roles.config.ts` của `admin-web` khớp từng dòng với `roles.ts`
- [ ] Giao diện: ẩn nút theo hành động thay vì theo mức quyền (`canDelete`, `canApprove`…)
- [ ] Test: mỗi phân hệ một bộ 401 / 403 / 200 cho từng hành động
- [ ] Cập nhật `docs/01-BACKEND.md` mục RBAC và `SECURITY.md`

## 5. Rủi ro

| Rủi ro | Mức | Ứng xử |
|---|---|---|
| Ánh xạ sai một điểm → khoá đúng người cần dùng | Cao | Bảng ánh xạ máy móc theo mục 3, rà từng controller, test 403 cho từng vai trò |
| Giao diện ẩn nút mà API vẫn cho, hoặc ngược lại | Cao | `roles.config.ts` phải khớp `roles.ts`; có test so hai bảng |
| Vai trò thiếu hành động ở phân hệ mới | Trung bình | Kiểu bắt buộc khai đủ 10 phân hệ, thiếu là lỗi biên dịch |

## 6. Việc KHÔNG làm

Không giới hạn theo **bộ phận** của cán bộ (chuyên viên bộ phận A vẫn sửa được việc bộ phận
B). Đó là câu hỏi riêng, chưa chốt — xem `docs/nang-cap-v2/nhiem-vu.md` mục 10 câu 3.
