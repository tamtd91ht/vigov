# ViGov — Tài liệu Web Quản trị

Tài liệu bàn giao cho đội tiếp nhận. Mô tả kiến trúc, quy ước và những chỗ dễ
vấp của giao diện quản trị dành cho cán bộ UBND xã.

| | |
|---|---|
| Công nghệ | Next.js 16 (App Router) · React 19 · TypeScript |
| Thư mục | `../admin-web/` |
| Cổng mặc định | `3100` khi phát triển, `3000` trong container |
| Quy mô | 13 phân hệ · 20 service · 18 component dùng chung |
| Kiểm thử | 88 test (Vitest + Testing Library) |

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
├─ hooks/                  useApiResource, useCatalog, useRealtime
├─ lib/                    Định dạng, biểu tượng
├─ types/index.ts          NGUỒN CHUẨN tên trường cho cả 4 module
└─ mocks/                  Dữ liệu mẫu — chỉ tầng service được đọc
```

---

## 2. Mười ba phân hệ

| Đường dẫn | Phân hệ | Điểm đáng chú ý |
|---|---|---|
| `/` | Bảng điều hành | Thẻ KPI, biểu đồ tổng hợp |
| `/tasks` | Nhiệm vụ | Chuyển đổi Kanban ⇄ bảng, checklist, vướng mắc |
| `/documents` | Văn bản & Đơn thư | OCR trích 7 trường, cán bộ xác nhận từng trường; đính kèm phụ lục tải lên/tải về thật |
| `/disbursement` | Giải ngân | Đề nghị, vướng mắc, tiến độ theo hạng mục |
| `/feedback` | Phản ánh | Đếm ngược SLA, ghim bản đồ, ảnh hiện trường |
| `/map` | Bản đồ kinh tế số | Lớp dữ liệu và ghim cơ sở; nền bản đồ thật hoặc bản mô phỏng, chọn bằng `NEXT_PUBLIC_MAP_PROVIDER` (mục 4.5) |
| `/reports` | Báo cáo | Kết xuất Excel; PDF/PPTX trả 501 ở Phase 1 |
| `/settings` | Cấu hình | SLA, cây tổ chức, lĩnh vực phản ánh, tài khoản cán bộ |
| `/cms` | Nội dung | Bài viết, video, truyền thanh, gửi thông báo hàng loạt |
| `/users` | Người dùng Mini App | Công dân (kèm ngày đăng ký, hoạt động gần nhất), phiên đăng nhập, danh sách chặn; xoá mềm tài khoản công dân (chỉ vai trò quản trị, khôi phục ở bộ lọc "Đã xoá") |
| `/profile` | Hồ sơ cá nhân | Tài khoản đang đăng nhập, thiết bị đang mở phiên, tự đổi mật khẩu |
| `/help` | Trợ giúp | Hướng dẫn theo phân hệ, bảng vai trò × quyền, câu hỏi thường gặp, đầu mối hỗ trợ |
| `/login` | Đăng nhập | Ngoài nhóm dashboard |

Ba trang đọc tham số truy vấn để mở sẵn ngăn chi tiết một bản ghi:
`/tasks?code=NV-2601`, `/documents?arrivalNo=128`, `/feedback?code=PA-2608`.
Tìm kiếm toàn cục và trung tâm thông báo điều hướng bằng đúng các đường dẫn này,
nên gửi link cho đồng nghiệp thì họ mở ra cùng một bản ghi.

> Vì đọc tham số truy vấn (`useSearchParams`) mà trang lại được dựng sẵn dạng
> tĩnh, ba `page.tsx` tương ứng BẮT BUỘC bọc component trong `<Suspense>` —
> thiếu là `next build` báo lỗi, không phải cảnh báo.

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

## 4. Bốn mẫu tải dữ liệu

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

### 4.4 Kênh thời gian thực (Socket.IO) — dữ liệu tự làm mới

`services/realtime.service.ts` là nơi DUY NHẤT phía web biết tới socket;
`hooks/useRealtime.ts` là lớp keo cho React.

```tsx
useRealtime({ "task.changed": () => list.reload() });
```

Backend phát ba sự kiện ở namespace `/realtime`: `feedback.changed`,
`task.changed`, `notification.new`. Payload **cố tình gọn** (`{ type, code,
status, at }`) — client nhận tín hiệu rồi **tự tải lại qua API**, không vẽ từ
payload, vì quyền xem dữ liệu do máy chủ quyết định. Đang nối: trang Phản ánh,
trang Nhiệm vụ, và chuông thông báo ở thanh trên cùng.

Ba điều dễ vấp:

- **Im lặng khi không nối được là CÓ CHỦ Ý.** Kênh này chỉ là tiện lợi. Backend
  chưa bật, proxy không chuyển tiếp WebSocket, mạng chặn — tất cả đều không báo
  lỗi, không toast; giao diện chạy như trước, chỉ mất tự làm mới. Đừng "sửa" bằng
  cách hiện lỗi.
- **Một socket dùng chung cho cả phiên**, đếm số nơi đang dùng
  (`acquireRealtime` / `releaseRealtime`). Vì vậy khi rời màn hình chỉ được gỡ
  đúng listener của mình — `removeAllListeners()` sẽ cắt luôn tai nghe của chuông.
- **Địa chỉ suy ra từ `api.baseUrl`**, không khai riêng: `baseUrl` tuyệt đối thì
  lấy origin của nó, `baseUrl` tương đối (`/api/v1`, chạy sau proxy) thì lấy
  origin của trang. Socket.IO coi phần đường dẫn là TÊN NAMESPACE, kết nối thật
  vẫn đi qua `/socket.io/` — nên **reverse proxy phải chuyển tiếp `/socket.io/`
  kèm nâng cấp WebSocket**; `next.config.ts` chỉ chuyển tiếp `/api/v1/*`. Tắt hẳn
  kênh bằng `NEXT_PUBLIC_REALTIME_ENABLED=false`.

---

### 4.5 Bản đồ nền — hai adapter, chọn bằng cấu hình

`MapPage` chọn component theo `appConfig.map.provider`:

| Giá trị | Adapter | Ghi chú |
|---|---|---|
| `mock` | `MapCanvas` | Nền vẽ bằng CSS, ghim theo phần trăm khung. KHÔNG gọi mạng |
| khác | `MapLibreCanvas` | Nền thật từ `map.styleUrl` (mặc định OpenFreeMap), ghim theo `lat/lng` |

Hai adapter nhận **cùng một bộ props** nên hai panel phủ (lớp dữ liệu, phân tích
ngành) và toàn bộ luồng dữ liệu không phải sửa gì. Nội dung popup tách ra
`PinPopupContent` để hai bên không lệch nhau.

Ba thứ dễ vấp:

1. **CSP.** `next.config.ts` mở `img-src`/`connect-src` cho ĐÚNG tên miền suy ra
   từ `NEXT_PUBLIC_MAP_STYLE_URL`, và thêm `worker-src blob:` (MapLibre giải mã
   tile trong web worker). Đổi provider thì CSP đổi theo, không phải sửa tay.
2. **`maplibre-gl` nạp động** — vài trăm KB, chỉ một phân hệ dùng; nạp tĩnh là
   mọi trang khác tải theo.
3. **Ghim thiếu `lat/lng`** không đặt được lên nền thật. Dữ liệu seed đã sinh
   toạ độ tất định từ x/y; ghim thêm sau mà thiếu toạ độ thì adapter hiện đếm số
   lượng ở góc màn hình thay vì đặt sai chỗ.

> **Pháp lý khi chốt nhà cung cấp:** nền dựng từ OpenStreetMap thể hiện Hoàng Sa
> – Trường Sa theo cách trung lập của cộng đồng quốc tế, không theo cách chính
> thức của Việt Nam (Điều 11 Nghị định 18/2020/NĐ-CP). Khung nhìn cấp xã không
> bao giờ tới hai quần đảo đó nên rủi ro thực tế gần như không có, nhưng khi bàn
> giao chính thức thì đây là câu cần khách xác nhận — chọn nhà cung cấp trong
> nước (VietMap/Goong) là hết vấn đề, và chỉ là đổi biến môi trường.

---

## 5. Thanh trên cùng: tìm kiếm toàn cục và trung tâm thông báo

### 5.1 Tìm kiếm toàn cục

`components/layout/GlobalSearch.tsx` + `services/search.service.ts` → `GET /search`.

Gõ từ **2 ký tự** trở lên mới gọi máy chủ (một ký tự khớp gần như mọi bản ghi),
có độ trễ 300ms, kết quả xếp ba nhóm: nhiệm vụ · văn bản & đơn thư · phản ánh.
Đi lại bằng ↑ ↓, Enter mở dòng đang chọn (chưa chọn thì mở dòng đầu), Esc hoặc
bấm ra ngoài thì đóng.

Backend chỉ trả **vài trường mỗi dòng**, không trả bản ghi đầy đủ; bấm một kết quả
là điều hướng kèm mã bản ghi (xem bảng route ở mục 2) và phân hệ đích tự tải chi
tiết bằng service của nó. Kết quả về trễ của lần gõ trước bị bỏ qua bằng cách so
`data.q` với từ khoá hiện tại, nên không cần thêm state "đang chờ".

Hồ sơ công dân **cố tình** không nằm trong phạm vi tìm kiếm (dữ liệu cá nhân);
phạm vi cuối cùng vẫn là câu hỏi mở #28.

### 5.2 Trung tâm thông báo

`components/layout/NotificationBell.tsx` dùng CHUNG một `ApiResource` với
Topbar — badge và khay thả xuống chỉ tốn một lượt `GET /notifications`.

Bấm một thông báo: cập nhật "đã đọc" **ngay tại chỗ** bằng `setData` rồi mới gọi
`PATCH /notifications/:id/read` (badge phải tắt liền dưới ngón tay); API lỗi thì
`reload()` để con số về đúng thực tế.

Backend **chưa có** endpoint "đọc tất cả", nên "Đánh dấu đã đọc" gọi lần lượt các
mã chưa đọc đang hiển thị trong khay (tối đa 10) bằng `Promise.allSettled` và chỉ
trừ số thật sự thành công.

Đường dẫn điều hướng suy ra từ `data` của thông báo (`taskCode`, `feedbackCode`,
`documentId`) — xem `notificationLink()`. Thông báo văn bản chỉ có `documentId`
(mã CSDL) trong khi trang Văn bản mở ngăn chi tiết theo SỐ ĐẾN, nên nó chỉ mở được
phân hệ chứ chưa mở thẳng bản ghi.

---

## 6. Phiên đăng nhập — chỗ dễ vấp nhất

Phiên lưu trong `localStorage`, đọc qua `useSyncExternalStore`.

**Cạm bẫy đã từng gây lỗi thật:** các trang được dựng sẵn dạng tĩnh, nên ở lượt
hydrate `useSyncExternalStore` **bắt buộc** dùng snapshot phía máy chủ — luôn là
`null` để khớp HTML đã dựng. Nếu điều hướng ngay khi thấy `null`, mỗi lần F5
người dùng bị đá về trang đăng nhập dù phiên còn nguyên.

`AuthGuard` vì vậy phân biệt hai trạng thái khác hẳn nhau:

- **chưa biết** (chưa hydrate xong) → chờ, không điều hướng
- **đã biết là chưa đăng nhập** → mới đá về trang đăng nhập

**Hệ quả của luật "401 = đăng xuất" lên thiết kế API:** vì bất kỳ 401 nào cũng
làm `apiClient` gọi `authService.logout()`, endpoint nào có lỗi nghiệp vụ *không*
phải "phiên hết hạn" thì **không được** trả 401. Ví dụ đã áp dụng:
`PATCH /auth/me/password` trả **400** khi mật khẩu hiện tại sai — nhờ vậy
`services/profile.service.ts` gọi qua `apiClient` như mọi service khác, mà gõ sai
mật khẩu chỉ hiện lỗi tại ô nhập chứ không đá người dùng ra trang đăng nhập.

> Test bảo vệ hành vi này nằm ở `components/layout/AuthGuard.test.tsx`. Lưu ý:
> `render()` của Testing Library **không** tái hiện được lỗi vì đó là render phía
> client thuần. Phải dựng HTML bằng `renderToString` rồi `hydrateRoot` lên chính
> HTML đó. Ba test dùng `render()` vẫn xanh kể cả khi bỏ bản sửa.

---

## 6a. Mật khẩu tạm: `PasswordChangeGate`

Tài khoản mới tạo và tài khoản vừa được quản trị viên đặt lại mật khẩu mang cờ
`mustChangePassword`. Backend **chặn mọi endpoint** trừ đường đổi mật khẩu, nên
`(dashboard)/layout.tsx` bọc toàn bộ khu vực quản trị trong `PasswordChangeGate`:
cờ còn bật thì phủ kín màn hình bằng ô đổi mật khẩu, kèm đường Đăng xuất.

Đây là lớp **giải thích**, không phải lớp bảo mật — gỡ nó ra cũng không mở được
gì, vì việc chặn do `JwtAuthGuard` làm. Đổi mật khẩu xong, máy chủ cấp cặp token
mới (cờ nằm trong chữ ký JWT nên token cũ vẫn bị chặn) và
`authService.clearPasswordChangeRequirement()` cập nhật phiên ngay tại đó.

Biểu mẫu dùng chung `features/profile/ChangePasswordForm.tsx` với trang Hồ sơ cá
nhân — hai bản sao của cùng một bộ luật kiểm tra sẽ lệch nhau sau vài lần sửa.

---

## 7. Biến môi trường

| Tệp | Vai trò |
|---|---|
| `.env.local` | Giá trị thật — ứng dụng đọc tệp này, **không commit** |
| `.env.example` | Mẫu, chỉ chứa giá trị giữ chỗ — commit |

> **`NEXT_PUBLIC_*` được nhúng cứng vào mã JavaScript lúc build**, không đọc lúc
> chạy. Sửa xong **phải dựng lại image**; đổi biến rồi khởi động lại là vô tác
> dụng. Cũng vì thế: tuyệt đối không đặt bí mật vào tiền tố này.

`NEXT_PUBLIC_USE_MOCKS` mặc định `false` — gọi API thật. Đặt `true` chỉ để trình
diễn giao diện khi chưa có backend.

Biến của hai tính năng mới:

| Biến | Ý nghĩa |
|---|---|
| `NEXT_PUBLIC_REALTIME_ENABLED` | `false` để tắt hẳn kênh Socket.IO (mục 4.4) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` · `NEXT_PUBLIC_SUPPORT_PHONE` · `NEXT_PUBLIC_SUPPORT_HOURS` | Đầu mối hỗ trợ hiện ở trang Trợ giúp; để trống thì trang nói rõ "chưa cấu hình" thay vì hiện số của người khác |
| `NEXT_PUBLIC_MAP_PROVIDER` | `mock` = bản mô phỏng, giá trị khác = nền thật qua MapLibre (mục 4.5) |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Style theo chuẩn MapLibre. Tên miền trong URL này **tự được mở trong CSP** |
| `NEXT_PUBLIC_MAP_CENTER_LAT` · `NEXT_PUBLIC_MAP_CENTER_LNG` · `NEXT_PUBLIC_MAP_ZOOM` | Tâm và mức thu phóng lúc mở trang — mỗi đơn vị hành chính một giá trị |

---

## 8. Quy ước code

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

## 9. Chạy và kiểm thử

```bash
cd admin-web
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3100

npm run typecheck
npm run lint
npm test             # 88 test
npm run build        # dựng 13 route
```

Đăng nhập bằng tài khoản seed; mật khẩu lấy từ `SEED_ADMIN_PASSWORD` trong `.env`
của môi trường tương ứng.

---

## 10. Việc còn dở

| Hạng mục | Tình trạng |
|---|---|
| Tìm kiếm toàn cục | Đã nối `/search` (mục 5.1). Phạm vi tìm (công dân, giải ngân, CMS) vẫn là câu hỏi mở #28 |
| Trung tâm thông báo | Đã có khay thả xuống, đánh dấu đã đọc, điều hướng tới bản ghi (mục 5.2). Thiếu endpoint "đọc tất cả" ở backend nên phải gọi từng mã |
| Realtime | Đã nối 3 sự kiện (mục 4.4). Phạm vi realtime đầy đủ là câu hỏi mở #7; proxy production cần chuyển tiếp `/socket.io/` |
| Trang hồ sơ cá nhân | Xong. Backend đã mở `GET/DELETE /auth/me/sessions` nên mọi vai trò xem và thu hồi được TỪNG phiên của chính mình; phiên đang dùng cố tình không cho tự thu hồi (đã có nút Đăng xuất) |
| Nhắc việc trong ngăn nhiệm vụ | Nút vẫn khoá — backend chưa có endpoint gửi nhắc cho người thực hiện |
| Tệp đính kèm văn bản | Xong — tải lên (riêng tư), tải về qua link ký sẵn, gỡ tệp; bản scan gốc dùng cho OCR vẫn là trường riêng |
| Bản đồ | Có nền thật (OpenFreeMap, không cần khoá API) qua adapter MapLibre; bản mô phỏng vẫn giữ làm phương án chạy không cần mạng. Chốt nhà cung cấp CHÍNH THỨC vẫn là câu hỏi mở #3 — xem ghi chú pháp lý ở mục 4.5 |
| Kết xuất PDF/PPTX | Xong ở backend (pdfmake + pptxgenjs); giao diện gọi như Excel |

---

## 11. Tài liệu liên quan

`01-BACKEND.md` · `03-ZALO-MINIAPP.md` · `04-TRIEN-KHAI.md` ·
`../SECURITY.md` · `../admin-web/AGENTS.md`
