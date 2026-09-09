# ViGov Phase 1 — Báo cáo tiến độ & tài liệu kỹ thuật

**Ngày:** 06/09/2026 · **Trạng thái:** 56/61 task đã xong · 3 đang làm · 2 chờ bên ngoài
(chi tiết từng task ở `pending-tasks.json`)

> Bản trước ngày 28/08 liệt kê 9 khoảng trống tích hợp `P5-01…P5-09`. Tám trong số đó
> đã đóng; phần còn lại cùng kết quả rà soát đối chiếu WBS nằm ở **mục 6**.

---

## 1. Đã xây dựng

| Module | Công nghệ | Nội dung | Kiểm chứng |
|---|---|---|---|
| `admin-web/` | Next.js 16 · TypeScript | 11 phân hệ + Hồ sơ cá nhân + Trợ giúp | tsc 0 lỗi · eslint 0 · **88 test pass** · build 14 route |
| `backend/` | NestJS 11 · MongoDB · JWT | 21 module API | **300 test pass** · build OK |
| `zalo-miniapp/` | ReactJS · Vite · zmp-sdk | 10 màn Zalo Mini App (kèm quét CCCD) | tsc 0 · oxlint 0 · build OK |

**Web Quản trị:** Đăng nhập + RBAC, Dashboard, Nhiệm vụ (Kanban ⇄ bảng, đính kèm tệp), Văn bản & Đơn thư
(OCR 7 trường), Giải ngân, Phản ánh (SLA đếm ngược), Bản đồ kinh tế số, Báo cáo (Excel/PDF/PowerPoint),
Cấu hình, CMS, Người dùng Mini App (kèm xoá mềm), Hồ sơ cá nhân, Trợ giúp. Thanh trên cùng có tìm kiếm
toàn cục và khay thông báo; danh sách tự làm mới qua Socket.IO.

**Backend:** auth (bcrypt + JWT + OTP + refresh token xoay vòng), tasks, documents, feedback, disbursement,
content, users, settings, search, audit, files, notification, workflow, reports, dossiers, realtime,
messaging (RabbitMQ), catalogs, integrations (OCR/GIS/CCCD adapter), map, zalo-webhook, health.

**Kênh công dân:** Zalo Mini App gọi trực tiếp bộ API của backend; không màn hình nào còn đọc dữ liệu
mẫu trực tiếp (chế độ mock chỉ còn là cờ môi trường để trình diễn giao diện khi chưa có backend).

---

## 2. Kiến trúc

```
┌────────────┐              ┌──────────────┐
│ admin-web  │              │ zalo-miniapp │
│ Next.js    │              │ React+Vite   │
└─────┬──────┘              └──────┬───────┘
      │      REST + JWT            │
      └──────────────┬─────────────┘
                     ▼
              ┌──────────────────┐
              │  API Gateway     │  NestJS 11
              │  JwtAuthGuard    │  RBAC 5 vai trò
              │  ThrottlerGuard  │  AuditInterceptor
              └────────┬─────────┘
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   21 module      MongoDB        Adapter bên thứ 3
   nghiệp vụ      (Mongoose)     OCR · GIS · CCCD · ZNS · FCM
```

**Quy ước bắt buộc**
- Không hardcode: cấu hình nằm ở `src/config/*` + biến môi trường (`.env.example` mỗi module).
- Adapter cho mọi dịch vụ bên thứ 3: đổi provider chỉ sửa 1 file, không đụng nghiệp vụ.
- Tên field thống nhất giữa 4 module — `admin-web/src/types/index.ts` là nguồn chuẩn.

---

## 3. Phân quyền (RBAC)

5 vai trò × 10 phân hệ, 4 mức quyền `view < edit < approve < admin`. Định nghĩa tại `backend/libs/shared/src/auth/roles.ts`, đồng bộ `admin-web/src/config/roles.config.ts`. Guard toàn cục chặn mọi endpoint; công dân (`roleKey: citizen`) bị 403 khi gọi API quản trị (đã có test).

---

## 4. Đã tích hợp và kiểm chứng thực tế

| Hạng mục | Trạng thái |
|---|---|
| MongoDB `192.168.3.135:27017` | Đã nối, seed 10 tài khoản + 12 cấu hình SLA |
| Đăng nhập Web Quản trị → API thật | `admin`/`123456` → JWT, các API trả 200 |
| CORS `localhost:3100` → `localhost:3001` | Preflight 204, POST 201 |
| Health check | `/health` (liveness), `/health/ready` (kèm trạng thái MongoDB) |
| CI/CD | Jenkinsfile + GitHub Actions, Dockerfile 3 module, `docker-compose.yml` |
| Bảo mật | Security headers, CORS whitelist, rate-limit đăng nhập 5 lượt/phút, giới hạn sai OTP, thu hồi token khi khoá/xoá tài khoản, refresh token có phát hiện dùng lại |
| Kết xuất báo cáo | Excel (exceljs), PDF (pdfmake, nhúng Roboto để đủ dấu tiếng Việt), PowerPoint (pptxgenjs) |
| Kiểm thử tự động | 300 test backend · 88 test Web Quản trị · Zalo Mini App tsc + oxlint sạch |

**Chạy:** `npm run dev` ở thư mục gốc → API 3001, Web 3100, Zalo Mini App 5173.

---

## 5. Còn phụ thuộc bên ngoài

| Việc | Bên chịu trách nhiệm |
|---|---|
| Chốt provider OCR, đọc thẻ CCCD, bản đồ (VietMap/Goong/MapLibre) | Khách hàng |
| Zalo cấp quyền `getPhoneNumber` cho Mini App — chưa có nên đang dùng `CITIZEN_OTP_BYPASS_CODE` | Zalo |
| Zalo OA/Business + duyệt template ZNS | Khách hàng + Zalo |
| Lịch UAT + thiết bị thật (GPS/camera/QR/push) | Khách hàng |
| ~27 câu hỏi mở trong `ESTIMATE_TECHNICAL.md` | Khách hàng chốt |

---

## 6. Đối chiếu WBS — hiện trạng ngày 06/09/2026

Rà soát lại toàn bộ mã nguồn 4 module với `ViGov_Phase1_Req.xlsx` (WBS #1–#39, sheet
Techstack và 7 câu hỏi xác nhận). **Không có hạng mục WBS nào bị bỏ sót** — WBS #22, #32,
#33 vốn không tồn tại trong tệp gốc của khách; WBS #39 (điều phối dự án) do senior đảm
nhiệm, không tính dòng riêng.

### 6.1 Chín khoảng trống tích hợp của bản báo cáo trước

| Mã | Nội dung | Hiện trạng |
|---|---|---|
| `P5-01` | Nối Web Quản trị vào API thật | ✅ Xong |
| `P5-03` | Nối Zalo Mini App vào API thật | ✅ Xong |
| `P5-04` | RabbitMQ publisher/consumer thật | ✅ Xong |
| `P5-05` | Socket.IO realtime | ✅ Xong — có cả phía client (trước chỉ có cổng ở backend mà không ai nối) |
| `P5-06` | Tải tệp thật từ giao diện | ✅ Xong — kèm tệp đính kèm nhiệm vụ |
| `P5-07` | Kiểm thử tự động | ✅ Xong — 300 test backend, 88 test Web Quản trị |
| `P5-08` | Thu hồi token khi khoá tài khoản | ✅ Xong |
| `P5-09` | Nối provider thật OCR/GIS/ZNS/FCM | ⏳ Chờ khách chốt nhà cung cấp và cấp tài khoản |

### 6.2 Việc đã làm sau đợt rà soát

- **Khối A** — sáu chỗ backend đã chạy mà giao diện chưa dùng tới: tìm kiếm toàn cục,
  realtime, chuyển phản ánh thành nhiệm vụ, tạo hạng mục ngân sách, khay thông báo,
  cột Ngày đăng ký công dân (`P6-04`).
- **Khối B** — sáu hạng mục thiếu ở cả hai đầu: tra cứu hồ sơ một cửa (WBS #15), tiếp
  nhận phản ánh trực tiếp tại xã (WBS #6), tệp đính kèm nhiệm vụ (WBS #3), kết xuất
  PDF/PowerPoint (WBS #8/#27), refresh token, tự đổi mật khẩu (`P6-05`).

### 6.3 Còn lại — chặn bởi bên ngoài

| Hạng mục | WBS | Chờ ai |
|---|---|---|
| Provider OCR văn bản và đọc thẻ CCCD | #4, #25 | Khách chốt nhà cung cấp |
| Bản đồ nền thật (hiện là bản mô phỏng, adapter đã dựng sẵn) | #7, #26 | Khách chốt provider — Google Maps không có giấy phép chính thức tại VN |
| Gửi ZNS/push thật; OTP công dân hiện chỉ ghi ra log máy chủ | #23 | Khách đăng ký Zalo Business + duyệt template |
| Quyền `getPhoneNumber` của Zalo Mini App | #12 | Zalo xét duyệt — đang dùng mã tạm `CITIZEN_OTP_BYPASS_CODE` |
| Liên thông trục văn bản liên ngành | #4 | Khách đã xác nhận **ngoài phạm vi** WBS |

### 6.4 Còn lại — cần thống nhất phạm vi với khách

- **WBS #21 "micro-services"**: hiện là **monolith mô-đun** trong monorepo (một app
  `api-gateway`, 21 module). Có thư viện dùng chung + RabbitMQ nên tách được về sau,
  nhưng chưa tách thành nhiều dịch vụ triển khai độc lập.
- **Nhóm "Ứng dụng Di động" (WBS #12–20)**: làm bằng **Zalo Mini App** đúng như WBS
  mô tả. App Flutter từng làm thêm ngoài phạm vi, đã bỏ khỏi dự án ngày 09/09/2026 —
  kênh công dân chỉ còn Zalo Mini App.
- **Đa phường/xã** (câu hỏi trong WBS #9): hệ thống hiện phục vụ một đơn vị, tên đơn vị
  lấy từ biến môi trường.
- **Phạm vi realtime** (câu hỏi xác nhận #8): hiện có 3 sự kiện (phản ánh, nhiệm vụ,
  thông báo). Cần khách chốt màn nào bắt buộc cập nhật tức thời để có tiêu chí nghiệm thu.
- **Kết xuất PDF/PowerPoint** (câu hỏi trong WBS #8): đã làm cả ba định dạng, không còn
  phải chia giai đoạn.

---

## 7. Tài liệu liên quan

`docs/` (bộ tài liệu bàn giao: Backend · Web Quản trị · Zalo Mini App · Triển khai · hồ sơ xin quyền
API Zalo · mô tả bản demo Zalo) · `README.md` (cách chạy, xử lý sự cố) · `SECURITY.md` (rà soát bảo mật,
việc bắt buộc trước production) · `deploy/README.md` (triển khai) · `deploy/VPS-VA-ZALO.md` (thao tác trên
VPS và nộp Zalo) · `deploy/RELEASE.md` (hồ sơ 3 store) · `deploy/UAT.md` (10 kịch bản hồi quy) ·
`plans/` (plan chi tiết từng task) · `pending-tasks.json` (trạng thái 61 task).
