# ViGov — Tài liệu Web Quản trị

Tài liệu bàn giao cho đội tiếp nhận. Mô tả kiến trúc, quy ước và những chỗ dễ
vấp của giao diện quản trị dành cho cán bộ UBND xã.

| | |
|---|---|
| Công nghệ | Next.js 16 (App Router) · React 19 · TypeScript |
| Thư mục | `../admin-web/` |
| Cổng mặc định | `3100` khi phát triển, `3000` trong container |
| Quy mô | 11 phân hệ · 17 service · 18 component dùng chung |
| Kiểm thử | 59 test (Vitest + Testing Library) |

> `../admin-web/AGENTS.md` cảnh báo Next.js bản này có thay đổi phá vỡ so với các
> bản phổ biến. Tra tài liệu tại `node_modules/next/dist/docs/` trước khi viết mã.

---

## 1. Cấu trúc thư mục

```
admin-web/src/
├─ app/                    Định tuyến App Router
│  ├─ (dashboard)/         Nhóm route có Sidebar + Topbar, bọc trong AuthGuard
│  └─ login/               Trang đăng nhập, KHÔNG nằm trong nhóm trên
├─ features/<phân hệ>/     Toàn bộ giao diện của một phân hệ
├─ services/               Tầng gọi API — nơi DUY NHẤT biết backend
├─ components/ui/          18 component dùng chung
├─ components/layout/      Sidebar, Topbar, AuthGuard
├─ config/                 Cấu hình không đổi lúc chạy
├─ hooks/                  useApiResource, useCatalog
├─ lib/                    Định dạng, biểu tượng
├─ types/index.ts          NGUỒN CHUẨN tên trường cho cả 4 module
└─ mocks/                  Dữ liệu mẫu — chỉ tầng service được đọc
```

---

## 2. Mười một phân hệ

| Đường dẫn | Phân hệ | Điểm đáng chú ý |
|---|---|---|
| `/` | Bảng điều hành | Thẻ KPI, biểu đồ tổng hợp |
| `/tasks` | Nhiệm vụ | Chuyển đổi Kanban ⇄ bảng, checklist, vướng mắc |
| `/documents` | Văn bản & Đơn thư | OCR trích 7 trường, cán bộ xác nhận từng trường |
| `/disbursement` | Giải ngân | Đề nghị, vướng mắc, tiến độ theo hạng mục |
| `/feedback` | Phản ánh | Đếm ngược SLA, ghim bản đồ, ảnh hiện trường |
| `/map` | Bản đồ kinh tế số | Lớp dữ liệu và ghim cơ sở |
| `/reports` | Báo cáo | Kết xuất Excel; PDF/PPTX trả 501 ở Phase 1 |
| `/settings` | Cấu hình | SLA, cây tổ chức, lĩnh vực phản ánh, tài khoản cán bộ |
| `/cms` | Nội dung | Bài viết, video, truyền thanh, gửi thông báo hàng loạt |
| `/users` | Người dùng Mini App | Công dân, phiên đăng nhập, danh sách chặn |
| `/login` | Đăng nhập | Ngoài nhóm dashboard |

---

## 3. Ba tầng, không đi tắt

```
features/*  →  services/*  →  backend
(giao diện)    (gọi API)      (REST)
```

**Component không bao giờ gọi `apiClient` trực tiếp** và không đọc `mocks/`.
Mọi truy cập dữ liệu đi qua một hàm trong `services/`. Nhờ vậy đổi endpoint hay
đổi hình dạng dữ liệu chỉ sửa một tầng.

`services/api.ts` bọc `fetch`, tự gắn `Authorization: Bearer`, và **gặp 401 thì
gọi `authService.logout()`** — nghĩa là bất kỳ lời gọi nào bị từ chối cũng làm
người dùng bị đăng xuất. Khi gỡ lỗi "tự nhiên bị đăng xuất", hãy mở tab Network
tìm request trả 401 trước tiên.

---

## 4. Ba mẫu tải dữ liệu

### 4.1 `useApiResource` — dữ liệu nghiệp vụ chính

```tsx
const tasks = useApiResource(() => listTasks({ page }), [page]);
// tasks.data | tasks.loading | tasks.error | tasks.reload() | tasks.setData()
```

Bọc trong `<DataState>` để có sẵn trạng thái đang tải, lỗi kèm nút thử lại, và
trạng thái rỗng. Kết quả về trễ của lần gọi cũ bị bỏ qua, không ghi đè kết quả mới.

### 4.2 `useCatalog` — danh mục đổ dropdown

```tsx
const departments = useCatalog(fetchDepartments);   // luôn là mảng
```

Lỗi hay đang tải đều trả mảng rỗng — dropdown tạm trống thay vì chặn cả trang
bằng màn hình lỗi.

### 4.3 Kho dùng chung — dữ liệu tra ở khắp nơi

`services/staff-directory.ts` và `services/category-directory.ts`.

Dùng khi giá trị được tra **trong vòng lặp render**: `<Avatar>` xuất hiện vài
chục lần trên một bảng, nhãn lĩnh vực phản ánh được tra ở bảng, ngăn chi tiết,
biểu đồ báo cáo và bảng SLA. Nếu mỗi nơi tự gọi thì mở một trang là bắn hàng
chục lượt gọi giống hệt nhau.

Kho tải **một lượt cho cả phiên**, không có trạng thái tải (dùng giá trị mặc
định trong lúc chờ) nên bảng không nhấp nháy. Sau khi thêm/xoá phải gọi
`invalidate...()` để các màn khác tải lại.

---

## 5. Phiên đăng nhập — chỗ dễ vấp nhất

Phiên lưu trong `localStorage`, đọc qua `useSyncExternalStore`.

**Cạm bẫy đã từng gây lỗi thật:** các trang được dựng sẵn dạng tĩnh, nên ở lượt
hydrate `useSyncExternalStore` **bắt buộc** dùng snapshot phía máy chủ — luôn là
`null` để khớp HTML đã dựng. Nếu điều hướng ngay khi thấy `null`, mỗi lần F5
người dùng bị đá về trang đăng nhập dù phiên còn nguyên.

`AuthGuard` vì vậy phân biệt hai trạng thái khác hẳn nhau:

- **chưa biết** (chưa hydrate xong) → chờ, không điều hướng
- **đã biết là chưa đăng nhập** → mới đá về trang đăng nhập

> Test bảo vệ hành vi này nằm ở `components/layout/AuthGuard.test.tsx`. Lưu ý:
> `render()` của Testing Library **không** tái hiện được lỗi vì đó là render phía
> client thuần. Phải dựng HTML bằng `renderToString` rồi `hydrateRoot` lên chính
> HTML đó. Ba test dùng `render()` vẫn xanh kể cả khi bỏ bản sửa.

---

## 6. Biến môi trường

| Tệp | Vai trò |
|---|---|
| `.env.local` | Giá trị thật — ứng dụng đọc tệp này, **không commit** |
| `.env.example` | Mẫu, chỉ chứa giá trị giữ chỗ — commit |

> **`NEXT_PUBLIC_*` được nhúng cứng vào mã JavaScript lúc build**, không đọc lúc
> chạy. Sửa xong **phải dựng lại image**; đổi biến rồi khởi động lại là vô tác
> dụng. Cũng vì thế: tuyệt đối không đặt bí mật vào tiền tố này.

`NEXT_PUBLIC_USE_MOCKS` mặc định `false` — gọi API thật. Đặt `true` chỉ để trình
diễn giao diện khi chưa có backend.

---

## 7. Quy ước code

**Không hardcode.** URL, tên đơn vị, danh mục, SLA, trạng thái, màu sắc nằm ở
`config/*` hoặc biến môi trường — không rải rác trong component.

**`types/index.ts` là nguồn chuẩn** tên trường cho cả 4 module. Đổi ở đây phải
đối chiếu backend và hai ứng dụng công dân.

**Hằng số giao ước để ở `config/`, không lấy qua API.** Ví dụ `UNASSIGNED`
(`"Chưa phân công"`) là chuỗi backend trả về ở trường `assignee` — đó là giao
ước giữa hai bên, không phải dữ liệu.

**Thao tác trên tài khoản công dân phải dùng `id`.** Danh sách trả số điện thoại
đã che (`098•••321`); số đó không tra ngược được và có thể trùng nhau giữa hai
người. Đây từng là lỗi 404 ở mọi lần khoá tài khoản.

---

## 8. Chạy và kiểm thử

```bash
cd admin-web
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3100

npm run typecheck
npm run lint
npm test             # 59 test
npm run build        # dựng 11 route
```

Đăng nhập bằng tài khoản seed; mật khẩu lấy từ `SEED_ADMIN_PASSWORD` trong `.env`
của môi trường tương ứng.

---

## 9. Việc còn dở

| Hạng mục | Tình trạng |
|---|---|
| Tìm kiếm toàn cục trên thanh trên cùng | Backend có `/search`, giao diện chưa nối — phạm vi chờ khách chốt |
| Trung tâm thông báo | Chuông đã hiện số chưa đọc từ API; chưa có khay thả xuống |
| Trang hồ sơ cá nhân | Chưa xây |
| Bản đồ | Khung mô phỏng, ghim theo phần trăm — chờ khách chốt nhà cung cấp bản đồ |
| Kết xuất PDF/PPTX | Backend trả 501 ở Phase 1, giao diện hiển thị đúng thông báo |

---

## 10. Tài liệu liên quan

`01-BACKEND.md` · `03-ZALO-MINIAPP.md` · `04-TRIEN-KHAI.md` ·
`../SECURITY.md` · `../admin-web/AGENTS.md`
