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

Nhóm cần token công dân:

- `POST /auth/citizen/otp/request` → `/verify`, hoặc `/auth/citizen/zalo/identify`
- `POST /feedback` — gửi phản ánh kèm ảnh và toạ độ GPS
- `GET /feedback/citizen/mine`, `/citizen/mine/:code`

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
| **Kiểm thử tự động** | **Chưa có test nào.** admin-web có 59, backend 167. Đây là khoảng trống lớn nhất của module này |
| Tra cứu hồ sơ | Vẫn dùng dữ liệu mẫu — backend **không có** endpoint vì tra vào hệ thống một cửa của tỉnh, chưa có đầu nối |
| Zalo OA / ZNS | Chưa có tài khoản thật; template ZNS chờ Zalo duyệt (1 ngày đến 1 tuần) |
| `@sentry/browser` | Lỗ hổng mức trung bình, đến bắc cầu từ `zmp-sdk`. Không tự nâng được, phải chờ Zalo phát hành bản mới |
| Lưu phiên | Đang dùng `localStorage`; chấp nhận được trong môi trường Zalo nhưng không nên giữ token dài hạn |

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
