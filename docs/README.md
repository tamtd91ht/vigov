# ViGov — Bộ tài liệu bàn giao

Nền tảng Điều hành số cấp Xã/Phường. Bộ tài liệu này dành cho đội tiếp nhận và
vận hành hệ thống.

| # | Tài liệu | Dành cho | Nội dung |
|---|---|---|---|
| 1 | [`01-BACKEND.md`](01-BACKEND.md) | Lập trình viên backend | Kiến trúc NestJS, 19 module, RBAC, hợp đồng sự kiện, quy ước |
| 2 | [`02-ADMIN-WEB.md`](02-ADMIN-WEB.md) | Lập trình viên frontend | Next.js, 11 phân hệ, ba tầng, mẫu tải dữ liệu, phiên đăng nhập |
| 3 | [`03-ZALO-MINIAPP.md`](03-ZALO-MINIAPP.md) | Lập trình viên frontend | React + Vite, 13 màn hình, adapter SDK Zalo |
| 4 | [`04-TRIEN-KHAI.md`](04-TRIEN-KHAI.md) | Vận hành / DevOps | Runbook 12 bước từ máy chủ trống, rồi chuyển sang Jenkins |
| 5 | [`05-ZALO-XIN-QUYEN-API.md`](05-ZALO-XIN-QUYEN-API.md) | Quản trị Mini App | Hồ sơ xin 4 quyền API Zalo: lý do dán vào Console, webhook xoá dữ liệu, bản nháp Điều khoản sử dụng |
| 6 | [`06-ZALO-MO-TA-BAN-DEMO.md`](06-ZALO-MO-TA-BAN-DEMO.md) | Quản trị Mini App | Nội dung nộp xét duyệt cho **bản demo**: tên, mô tả ngắn, mô tả đầy đủ, chế độ demo trong mã nguồn (`VITE_DEMO_MODE`), cách chuyển sang bản chính thức |

---

## Toàn cảnh hệ thống

```
┌────────────┐   ┌────────────┐   ┌──────────────┐
│ admin-web  │   │  mobile    │   │ zalo-miniapp │
│ Next.js 16 │   │  Flutter   │   │ React + Vite │
│ Cán bộ     │   │  Công dân  │   │ Công dân     │
└─────┬──────┘   └─────┬──────┘   └──────┬───────┘
      │      REST + JWT │                │
      └────────────────┴─────────────────┘
                       ▼
              ┌──────────────────┐
              │   API Gateway    │  NestJS 11
              │   19 module      │  125 route
              └────────┬─────────┘
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    MongoDB        RabbitMQ      Adapter bên thứ 3
    21 collection  7 sự kiện     OCR · GIS · ZNS · FCM
```

`mobile/` (Flutter, Android + iOS) dùng chung nghiệp vụ và endpoint với Zalo Mini
App — chưa có tài liệu riêng; phần lớn nội dung `03-ZALO-MINIAPP.md` áp dụng được,
khác biệt chính nằm ở adapter thiết bị và quy trình phát hành (`../deploy/RELEASE.md`).

---

## Đọc theo tình huống

| Bạn cần | Đọc |
|---|---|
| Dựng hệ thống trên máy chủ mới | `04-TRIEN-KHAI.md` từ Bước 0 |
| Hiểu một phân hệ trước khi sửa | Tài liệu module tương ứng, mục "Cấu trúc" và "Quy ước" |
| Thêm endpoint mới | `01-BACKEND.md` mục 6 (Quy ước) |
| Gỡ lỗi "tự nhiên bị đăng xuất" | `02-ADMIN-WEB.md` mục 3 và 5 |
| Rà soát an toàn trước khi lên production | `../SECURITY.md` mục 4 |
| Xử lý sự cố khi đang chạy | `../deploy/README.md` mục 8 |

---

## Việc còn phụ thuộc bên ngoài

Bốn hạng mục dưới đây **không** hoàn tất được bằng lập trình, cần khách hàng
quyết định hoặc cấp tài khoản:

| Hạng mục | Cần gì |
|---|---|
| OCR, bản đồ (GIS) | Khách chốt nhà cung cấp và cấp khoá API |
| Zalo OA + ZNS | Khách đăng ký OA; template ZNS chờ Zalo duyệt (1 ngày – 1 tuần) |
| Phát hành 3 store | Tài khoản Google Play, Apple Developer (cần D-U-N-S), Zalo Developers |
| Tra cứu hồ sơ (WBS #15) | Đầu nối vào hệ thống một cửa của tỉnh — hệ thống ngoài |

Danh sách câu hỏi mở đầy đủ: `../ESTIMATE_TECHNICAL.md`.

---

## Tài liệu khác trong dự án

`../README.md` (chạy tại máy phát triển) · `../SECURITY.md` (rà soát bảo mật, 12
việc bắt buộc trước production) · `../BAO-CAO-TIEN-DO.md` (tiến độ) ·
`../deploy/README.md` (vận hành theo chủ đề) · `../deploy/UAT.md` (10 kịch bản
nghiệm thu) · `../deploy/RELEASE.md` (phát hành app lên 3 store) · `../plans/`
(plan chi tiết từng task) · `../CLAUDE.md` (quy ước cho AI agent)
