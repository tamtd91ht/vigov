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
| `readImageBlob(uri)` | Đọc ảnh đã chọn thành Blob để tải lên máy chủ |
| `call(phone)` / `openChat(phone)` | Gọi và nhắn cán bộ từ danh bạ |

**Vì sao cần adapter:** `zmp-sdk` chỉ chạy được bên trong Zalo. Adapter cho phép
phát triển và trình diễn toàn bộ ứng dụng trên **trình duyệt thường** — mỗi hàm
có nhánh mô phỏng khi `appConfig.api.useMocks = true`.

> **Hệ quả khi kiểm thử.** Chạy trên trình duyệt thì các tính năng gốc của Zalo
> đều là mô phỏng. Muốn nghiệm thu thật (lấy số điện thoại, quét QR, GPS, chọn
> ảnh, gọi điện) **bắt buộc chạy trong ứng dụng Zalo trên máy thật**.

### 4b. Ảnh hiện trường — từ máy người dân tới phiếu phản ánh

Ảnh đi qua bốn bước, và bước nào cũng có lý do riêng:

1. **Chọn** — `chooseImage()` trả `filePaths`, dùng trực tiếp làm `src` thẻ `<img>`
   để xem trước. Đây là tệp **tạm** của webview: hết hiệu lực khi đóng app.
2. **Đọc thành Blob** — `readImageBlob(uri)`. Thử `fetch` trước; nhiều webview chặn
   `fetch` trên `file://` dù thẻ `<img>` vẫn tải được, nên khi trượt thì rơi sang
   **canvas**: nạp bằng `<img>` rồi `toBlob`. Đường canvas đồng thời **thu nhỏ ảnh về
   cạnh dài 1600px** (ảnh camera nay 4–12MB, vượt hạn mức tệp và tốn 4G của người dân)
   và **bỏ EXIF** — thẻ EXIF chứa toạ độ GPS nơi chụp, dữ liệu cá nhân theo NĐ 13/2023
   mà người gửi không biết mình đang gửi.
3. **Tải lên NGAY khi chọn**, không dồn tới lúc bấm gửi — `services/files.service.ts`
   + `usePickedImages`. Mỗi ô ảnh có trạng thái riêng (`uploading` / `done` / `error`),
   ảnh lỗi hiện viền đỏ kèm nút "Thử lại" và lý do bằng chữ. Còn ảnh đang tải hoặc còn
   ảnh lỗi thì **không cho sang bước 3** — im lặng bỏ ảnh là gửi thiếu bằng chứng mà
   người gửi không biết.
4. **Gửi phiếu** với `imageFileIds`; xem lại thì đọc `imageUrls` / `resultImageUrls`.

Xem lại ảnh trên phiếu: `imageUrls` / `resultImageUrls` là link **đã ký sẵn**. Tệp
riêng tư được phục vụ với `Cross-Origin-Resource-Policy: cross-origin` — thiếu header
này thì webview Zalo (`h5.zdn.vn`, khác site với API) chặn im lặng mọi thẻ `<img>` và
người dân chỉ thấy ô ảnh trống (phát hiện `TB-17` trong `../SECURITY.md`).

### 4c. Địa chỉ của vị trí — vì sao thường để trống

Toạ độ và địa chỉ là hai việc khác nhau, và **chỉ toạ độ là chắc chắn có**:

- Toạ độ lấy từ thiết bị (`navigator.geolocation`) hoặc từ mã định vị của Zalo qua
  backend. Đây là thứ vẽ được bản đồ và là thứ cán bộ cần để tới đúng nơi.
- Địa chỉ chữ phải nhờ **provider GIS** tra ngược từ toạ độ. Nhà cung cấp thật đang
  **chờ khách chốt** (câu hỏi mở #2 — VietMap / Goong / MapLibre + nguồn mở; Google Maps
  bị loại vì không có giấy phép tại Việt Nam), nên `GEO_PROVIDER=mock`.

`MockGeoProvider` **bịa** địa chỉ từ toạ độ. Một địa chỉ bịa gắn lên toạ độ thật thì
người dân đọc tưởng thật rồi gửi phiếu sai chỗ, cán bộ tới nhầm nơi. Vì vậy backend trả
kèm `addressProvider`, và Mini App (`usableAddress`) **bỏ** mọi địa chỉ do provider
`mock` sinh ra. Hệ quả người dùng thấy: ô địa chỉ **để trống, mở sẵn cho họ tự gõ**, kèm
một dòng giải thích là đã ghim đúng vị trí nhưng chưa tra được tên đường.

> Đây **không** phải lỗi quyền. Quyền vị trí đã cấp và toạ độ đã đúng. Muốn tự điền địa
> chỉ thì chỉ cần chốt nhà cung cấp GIS rồi thêm một lớp `implements GeoProvider` và một
> nhánh trong `GeoService.resolveProvider` — không phải sửa gì ở Mini App.

> **Cần nghiệm thu trên máy thật.** Bước 2 là chỗ duy nhất còn rủi ro: hình dạng
> `filePaths` khác nhau theo phiên bản Zalo và hệ điều hành, mà cả `fetch` lẫn canvas
> đều có thể trượt (canvas bị "nhiễm" nếu nguồn ảnh khác gốc mà không có CORS). Trên
> trình duyệt thường và bản mock thì đường `fetch` luôn chạy, nên **lỗi ở đây không
> lộ ra khi kiểm thử trên máy tính**.

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
| `VITE_MAX_FILE_SIZE` | Dung lượng tối đa mỗi ảnh (byte). **Phải khớp `STORAGE_MAX_FILE_SIZE`** của backend — lệch thì người dân chờ tải hết ảnh rồi mới nhận 413 |
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
- `POST /files/upload` — tải ảnh hiện trường lên kho tệp (`purpose=feedback`,
  `isPrivate=true`); trả mã tệp để gửi kèm phiếu
- `POST /feedback/citizen` — gửi phản ánh kèm `imageFileIds` và toạ độ GPS
- `GET /feedback/citizen/mine`, `/citizen/mine/:code` — trả kèm `imageUrls` và
  `resultImageUrls` là link đọc ảnh đã ký sẵn, hiệu lực 1 giờ

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

## 9. Quan hệ với app Flutter

`../mobile/` là ứng dụng công dân bản gốc (Android + iOS), **dùng chung nghiệp vụ
và endpoint** với Mini App. Hai kênh có cùng bộ màn hình và cùng hạn chế ở phần
tra cứu hồ sơ.

Khi sửa hợp đồng dữ liệu, phải kiểm cả hai: `../zalo-miniapp/src/types/` và
`../mobile/lib/models/models.dart`.

---

## 10. Tài liệu liên quan

`01-BACKEND.md` · `02-ADMIN-WEB.md` · `04-TRIEN-KHAI.md` ·
`../deploy/RELEASE.md` (hồ sơ phát hành 3 store)
