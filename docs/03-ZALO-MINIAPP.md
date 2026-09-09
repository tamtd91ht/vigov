# ViGov — Tài liệu Zalo Mini App

Tài liệu bàn giao cho đội tiếp nhận. Ứng dụng dành cho **công dân**, chạy trong
webview của Zalo.

| | |
|---|---|
| Công nghệ | React 19 · Vite · TypeScript · `zmp-sdk` |
| Thư mục | `../zalo-miniapp/` |
| Cổng khi phát triển | `5173` |
| Quy mô | 10 phân hệ · 13 màn hình |
| Kiểm thử | Chưa có test tự động — xem mục 8 |

---

## 1. Cấu trúc thư mục

```
zalo-miniapp/src/
├─ main.tsx              Điểm vào
├─ router.tsx            Định tuyến + chặn theo trạng thái định danh
├─ features/<phân hệ>/   Giao diện từng phân hệ
├─ services/
│  ├─ api.ts             Bọc fetch, gắn token
│  ├─ auth.service.ts    Định danh công dân
│  ├─ content.service.ts Tin tức, video, truyền thanh, danh bạ
│  ├─ dossier.service.ts Tra cứu hồ sơ một cửa
│  ├─ feedback.service.ts Gửi và tra phản ánh của chính mình
│  └─ zalo.ts            ADAPTER SDK Zalo — xem mục 4
├─ state/                5 context React
├─ hooks/useApiResource  Cùng khuôn với admin-web
├─ config/               Cấu hình không đổi lúc chạy
├─ types/                Kiểu dữ liệu
└─ mocks/                Dữ liệu mẫu — chỉ tầng service được đọc
```

---

## 2. Mười bốn màn hình

| Đường dẫn | Màn hình | Cần định danh |
|---|---|---|
| `/onboarding` | Định danh công dân | — |
| `/` | Trang chủ | ✓ |
| `/send-feedback` | Gửi phản ánh (3 bước) | ✓ |
| `/my-feedback` | Phản ánh của tôi | ✓ |
| `/my-feedback/:code` | Chi tiết phản ánh | ✓ |
| `/lookup` | Tra cứu hồ sơ | ✓ |
| `/news`, `/news/:id` | Tin tức và chi tiết | ✓ |
| `/radio` | Bản tin truyền thanh | ✓ |
| `/video`, `/video/:id` | Video tuyên truyền | ✓ |
| `/directory` | Danh bạ chính quyền | ✓ |
| `/map` | Bản đồ kinh tế số | ✓ |
| `/profile` | Hồ sơ cá nhân | ✓ |

`RequireIdentity` bọc toàn bộ nhóm cần định danh; `RedirectIfIdentified` đẩy
người đã định danh khỏi màn onboarding.

---

## 3. Quản lý trạng thái — 5 context

| Context | Giữ gì |
|---|---|
| `SessionContext` | Phiên định danh công dân, token |
| `FeedbackContext` | Nháp phản ánh đang soạn qua 3 bước |
| `RadioContext` | Trình phát truyền thanh (chạy nền khi chuyển màn) |
| `SettingsContext` | Tuỳ chọn người dùng |
| `ToastContext` | Thông báo ngắn |

Dữ liệu từ máy chủ dùng `useApiResource` — cùng khuôn với admin-web, port sang
để hai front-end nhất quán.

---

## 4. Adapter SDK Zalo — điểm quan trọng nhất

`services/zalo.ts` bọc **toàn bộ** lời gọi `zmp-sdk`. Không component nào gọi
thẳng SDK.

| Hàm | Dùng cho |
|---|---|
| `getUserProfile()` | Tên và ảnh đại diện Zalo |
| `requestPhoneNumber()` / `requestPhoneToken()` | Định danh công dân |
| `scanQrCode()` | Quét mã tra cứu hồ sơ |
| `getLocation()` | Toạ độ GPS đính kèm phản ánh |
| `chooseImage()` | Chọn ảnh hiện trường |
| `call(phone)` / `openChat(phone)` | Gọi và nhắn cán bộ từ danh bạ |

**Vì sao cần adapter:** `zmp-sdk` chỉ chạy được bên trong Zalo. Adapter cho phép
phát triển và trình diễn toàn bộ ứng dụng trên **trình duyệt thường** — mỗi hàm
có nhánh mô phỏng khi `appConfig.api.useMocks = true`.

> **Hệ quả khi kiểm thử.** Chạy trên trình duyệt thì các tính năng gốc của Zalo
> đều là mô phỏng. Muốn nghiệm thu thật (lấy số điện thoại, quét QR, GPS, chọn
> ảnh, gọi điện) **bắt buộc chạy trong ứng dụng Zalo trên máy thật**.

---

## 5. Biến môi trường

| Tệp | Vai trò |
|---|---|
| `.env.local` | Giá trị thật — ứng dụng đọc tệp này, **không commit** |
| `.env.example` | Mẫu — commit |

> **`VITE_*` được nhúng cứng vào bundle lúc build.** Sửa xong phải dựng lại;
> đổi biến rồi khởi động lại là vô tác dụng. Không đặt bí mật vào tiền tố này.

| Biến | Ghi chú |
|---|---|
| `VITE_API_BASE_URL` | Phải là **domain công khai** của API — bên gọi là điện thoại người dân |
| `VITE_MAP_PROVIDER` | `mock` = bản đồ mô phỏng bằng CSS (không gọi mạng), giá trị khác = nền thật qua MapLibre |
| `VITE_MAP_STYLE_URL` | Style theo chuẩn MapLibre; mặc định OpenFreeMap (dữ liệu OpenStreetMap, không cần khoá API) |
| `VITE_MAP_CENTER_LAT` · `VITE_MAP_CENTER_LNG` · `VITE_MAP_ZOOM` | Tâm và mức thu phóng lúc mở màn Bản đồ |
| `VITE_USE_MOCKS` | Mặc định `false`. `true` để trình diễn offline |
| `VITE_ZALO_APP_ID`, `VITE_ZALO_OA_ID` | Điền sau khi khách đăng ký Zalo OA |
| `VITE_DEMO_MODE` | Mặc định `true` — bản demo. Xem mục 5b |

### 5b. Chế độ demo

`VITE_DEMO_MODE=true` (mặc định, kể cả khi quên khai biến) bật bốn thứ: pop-up
"Đây là ứng dụng DEMO" khi mở app, nhãn `DEMO` cạnh tiêu đề mọi màn, dòng ghi
chú "dữ liệu mô phỏng" ở đầu các màn nghiệp vụ, và tên app thành "ViGov Demo"
(cả trong app lẫn `app-config.json`, do `scripts/zmp-prepare.mjs` đọc lại biến
này). Lời văn nằm ở `src/config/demo.config.ts`.

Đặt `false` để có bản chính thức — nhớ trỏ luôn `VITE_ORG_NAME` /
`VITE_ORG_PARENT` về tên đơn vị thật, giá trị mặc định trong mã nguồn cố ý là
tên hư cấu. Bối cảnh và các bước nộp: `06-ZALO-MO-TA-BAN-DEMO.md`.

**CORS:** backend phải cho phép `https://h5.zdn.vn` — mọi Mini App chạy trong
webview mang origin này.

---

## 6. Endpoint sử dụng

Nhóm công khai, **không cần token**:

- `GET /content/public/articles`, `/public/articles/:id`
- `GET /content/public/videos`, `/public/radio`
- `GET /catalogs/public/directory` — danh bạ chính quyền
- `GET /map/public/economy` — lớp và ghim bản đồ kinh tế, đã lược bỏ họ tên
  đại diện và số điện thoại chủ cơ sở (dữ liệu cá nhân theo NĐ 13/2023)
- `GET /dossiers/lookup/:code` — tra cứu hồ sơ một cửa (WBS #15). Hạn mức
  20 lượt/phút mỗi IP; số điện thoại người nộp hồ sơ trả về đã được che sẵn
- `POST /auth/refresh` — cấp lại cặp token, xem mục 6b

Nhóm cần token công dân:

- `POST /auth/citizen/otp/request` → `/verify`, hoặc `/auth/citizen/zalo/identify`
- `POST /feedback/citizen` — gửi phản ánh kèm ảnh và toạ độ GPS
- `GET /feedback/citizen/mine`, `/citizen/mine/:code`

### 6b. Gia hạn phiên khi token hết hạn

Access token sống 8 giờ, nên mở app sau một đêm là rơi thẳng về màn liên kết số
điện thoại — trong Zalo Mini App đó là cả một luồng cấp quyền, rất dễ bỏ giữa
đường. `services/api.ts` nay xử lý như sau:

1. Gặp **401** trên một đường dẫn **không** thuộc nhóm `/auth/`, và phiên đang có
   token → gọi `POST /auth/refresh` với `refreshToken` lưu trong phiên.
2. Gia hạn được → **gửi lại đúng một lần** lời gọi vừa hỏng với token mới.
3. Gia hạn trượt (refresh token hết hạn, phiên bị thu hồi, tài khoản bị khoá) →
   xoá phiên và phát `vigov:session-expired` như trước.

`refreshToken` được lưu cùng phiên trong `localStorage` (`CitizenSession`), và
backend **xoay vòng** token mỗi lần refresh nên phải ghi lại cả token mới.

> **Vì sao gộp các lời gọi refresh đồng thời về một lượt.** Một màn hình thường
> bắn 2–3 lời gọi song song. Nếu mỗi lời gọi tự refresh thì lời gọi thứ hai gửi
> refresh token vừa bị xoay vòng — backend coi đó là dấu hiệu token bị lộ và
> **thu hồi cả phiên**. Nghĩa là chính cơ chế gia hạn lại đá người dùng ra
> ngoài. Biến `refreshInFlight` trong `api.ts` là để chặn đúng chuyện đó, không
> phải để tối ưu hoá.

---

## 7. Chạy và kiểm thử

```bash
cd zalo-miniapp
npm install
cp .env.example .env.local
npm run dev          # http://localhost:5173 — chạy được trên trình duyệt

npm run typecheck
npm run lint         # oxlint
npm run build
```

Chạy trong Zalo thật: dùng Zalo Mini App Studio nạp thư mục dự án, cấu hình
Mini App nằm ở `app-config.json`.

---

## 8. Việc còn dở

| Hạng mục | Tình trạng |
|---|---|
| **Kiểm thử tự động** | **Chưa có test nào.** admin-web có 59, backend 300. Đây là khoảng trống lớn nhất của module này |
| Tra cứu hồ sơ | Đã nối `GET /dossiers/lookup/:code` qua `services/dossier.service.ts`. Dữ liệu bên backend hiện là **seed demo** — nguồn thật phải liên thông từ hệ thống một cửa của tỉnh, hạng mục ngoài WBS (xem `01-BACKEND.md` mục 3.5) |
| Zalo OA / ZNS | Chưa có tài khoản thật; template ZNS chờ Zalo duyệt (1 ngày đến 1 tuần) |
| `@sentry/browser` | Lỗ hổng mức trung bình, đến bắc cầu từ `zmp-sdk`. Không tự nâng được, phải chờ Zalo phát hành bản mới |
| Lưu phiên | Đang dùng `localStorage`; chấp nhận được trong môi trường Zalo nhưng không nên giữ token dài hạn |
| Bản đồ nền | Có adapter thật (`MapLibreCanvas`, mặc định OpenFreeMap) song song bản mô phỏng. `maplibre-gl` ghim chính xác `5.24.0` — bản 6 nạp worker từ một tệp riêng mà bundler không phát hành, làm bản đồ trắng trơn không báo lỗi (xem `02-ADMIN-WEB.md` mục 4.5). **Điều kiện chạy được trong Zalo: tên miền tile phải được khai trong danh sách domain của Mini App trên Zalo Developers** — chưa khai thì tile im lặng không tải và màn hình chỉ có nền trống. Chưa khai xong thì để `VITE_MAP_PROVIDER=mock` |

---

## 9. Tài liệu liên quan

`01-BACKEND.md` · `02-ADMIN-WEB.md` · `04-TRIEN-KHAI.md` ·
`../deploy/RELEASE.md` (hồ sơ phát hành Zalo Mini App Store)
