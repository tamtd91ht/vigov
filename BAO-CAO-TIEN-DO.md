# ViGov Phase 1 — Báo cáo tiến độ & tài liệu kỹ thuật

**Ngày:** 28/08/2026 · **Trạng thái:** 42/44 task đã xong, còn 2 task chờ khách hàng · **Bổ sung:** 9 task tích hợp (xem mục 6)

---

## 1. Đã xây dựng

| Module | Công nghệ | Nội dung | Kiểm chứng |
|---|---|---|---|
| `admin-web/` | Next.js 16 · TypeScript | 11 phân hệ Web Quản trị | tsc 0 lỗi · eslint 0 · build 11 route |
| `backend/` | NestJS 11 · MongoDB · JWT | 15 module API | 11/11 test e2e pass · build OK |
| `mobile/` | Flutter · Material 3 | 9 màn app công dân (Android + iOS) | `flutter analyze` sạch · build APK OK |
| `zalo-miniapp/` | ReactJS · Vite · zmp-sdk | 9 màn Zalo Mini App | tsc 0 · oxlint 0 · build OK |

**Web Quản trị:** Đăng nhập + RBAC, Dashboard, Nhiệm vụ (Kanban ⇄ bảng), Văn bản & Đơn thư (OCR 7 trường), Giải ngân, Phản ánh (SLA đếm ngược), Bản đồ kinh tế số, Báo cáo, Cấu hình, CMS, Người dùng Mini App.

**Backend:** auth (bcrypt + JWT + OTP), tasks, documents, feedback, disbursement, content, users, settings, search, audit, files, notification, workflow, reports, integrations (OCR/GIS adapter), health.

**Kênh công dân:** app Flutter và Zalo Mini App dùng chung nghiệp vụ + dữ liệu mẫu, demo đồng bộ hai kênh.

---

## 2. Kiến trúc

```
┌────────────┐   ┌────────────┐   ┌──────────────┐
│ admin-web  │   │  mobile    │   │ zalo-miniapp │
│ Next.js    │   │  Flutter   │   │ React+Vite   │
└─────┬──────┘   └─────┬──────┘   └──────┬───────┘
      │  REST + JWT    │                 │
      └────────────────┴─────────────────┘
                       ▼
              ┌──────────────────┐
              │  API Gateway     │  NestJS 11
              │  JwtAuthGuard    │  RBAC 5 vai trò
              │  ThrottlerGuard  │  AuditInterceptor
              └────────┬─────────┘
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   15 module      MongoDB        Adapter bên thứ 3
   nghiệp vụ      (Mongoose)     OCR · GIS · ZNS · FCM
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
| Bảo mật | Security headers, CORS whitelist, rate-limit đăng nhập 5 lượt/phút, giới hạn sai OTP |

**Chạy:** `npm run dev` ở thư mục gốc → API 3001, Web 3100, Zalo Mini App 5173.

---

## 5. Còn phụ thuộc bên ngoài

| Việc | Bên chịu trách nhiệm |
|---|---|
| Chốt provider OCR, bản đồ (VietMap/Goong/MapLibre) | Khách hàng |
| Zalo OA/Business + duyệt template ZNS | Khách hàng + Zalo |
| Tài khoản Google Play, Apple Developer (cần D-U-N-S) | Khách hàng |
| Máy macOS để build iOS | Khách hàng / thuê CI |
| Lịch UAT + thiết bị thật (GPS/camera/QR/push) | Khách hàng |
| ~27 câu hỏi mở trong `ESTIMATE_TECHNICAL.md` | Khách hàng chốt |

---

## 6. Khoảng trống so với WBS gốc — đã bổ sung vào `pending-tasks.json`

Đối chiếu `ViGov_Phase1_Req.xlsx` (WBS #1–#39) và sheet Techstack:

| Mã | Nội dung | Vì sao còn thiếu |
|---|---|---|
| `P5-01` | Nối Web Quản trị vào API thật (11 phân hệ) | Hiện mới nối phần đăng nhập; dữ liệu còn đọc từ `src/mocks/*` |
| `P5-02` | Nối app Flutter vào API thật | Toàn bộ đang dùng mock trong `lib/mocks/*` |
| `P5-03` | Nối Zalo Mini App vào API thật | Toàn bộ đang dùng mock trong `src/mocks/*` |
| `P5-04` | RabbitMQ — publisher/consumer thật | Techstack yêu cầu; hiện mới có hợp đồng sự kiện, workflow gọi trực tiếp |
| `P5-05` | Socket.IO realtime | Techstack yêu cầu; chưa xây (phạm vi chờ khách — câu hỏi mở #7) |
| `P5-06` | Tải tệp thật từ giao diện | Backend đã có `/files`; FE chưa gọi (ảnh phản ánh, bản scan, audio/video CMS) |
| `P5-07` | Kiểm thử tự động | Mới có 11 test e2e backend; chưa có unit test BE, test FE, widget test Flutter |
| `P5-08` | Thu hồi token khi khoá tài khoản / thu hồi phiên | Tồn đọng mức Trung bình trong `SECURITY.md` (TB-01) |
| `P5-09` | Nối provider thật: OCR, GIS, ZNS, FCM/APNs | Đang là adapter mock, chờ khách chốt nhà cung cấp |

Không có hạng mục WBS nào bị bỏ sót: WBS #22, #32, #33 vốn không tồn tại trong file gốc của khách; WBS #39 (điều phối dự án) do senior đảm nhiệm, không tính dòng riêng.

---

## 7. Tài liệu liên quan

`DEPLOYMENT.md` (runbook triển khai từng bước) · `README.md` (cách chạy, xử lý sự cố) · `SECURITY.md` (rà soát bảo mật) · `deploy/README.md` (triển khai) · `deploy/RELEASE.md` (hồ sơ 3 store) · `deploy/UAT.md` (10 kịch bản hồi quy) · `plans/` (plan chi tiết từng task).
