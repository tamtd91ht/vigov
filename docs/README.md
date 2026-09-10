# ViGov — Bộ tài liệu bàn giao

Nền tảng Điều hành số cấp Xã/Phường. Bộ tài liệu này dành cho đội tiếp nhận và vận hành
hệ thống.

**Đây là nơi duy nhất chứa tài liệu.** `deploy/` chỉ còn tệp chạy được
(`backup-mongo.sh`, cấu hình nginx); `k8s/` chỉ chứa manifest.

| # | Tài liệu | Dành cho | Nội dung |
|---|---|---|---|
| 1 | [`01-BACKEND.md`](01-BACKEND.md) | Lập trình viên backend | Kiến trúc NestJS, các module, RBAC, hợp đồng sự kiện, quy ước |
| 2 | [`02-ADMIN-WEB.md`](02-ADMIN-WEB.md) | Lập trình viên frontend | Next.js, 11 phân hệ, ba tầng, mẫu tải dữ liệu, phiên đăng nhập |
| 3 | [`03-ZALO-MINIAPP.md`](03-ZALO-MINIAPP.md) | Lập trình viên frontend | React + Vite, các màn hình, adapter SDK Zalo |
| 4 | [`04-TRIEN-KHAI-VPS.md`](04-TRIEN-KHAI-VPS.md) | Vận hành / DevOps | **Cách triển khai đang dùng thật.** Yêu cầu hạ tầng, kiến trúc all-in-one, runbook từng bước từ máy chủ trống |
| 5 | [`05-TRIEN-KHAI-K8S.md`](05-TRIEN-KHAI-K8S.md) | Vận hành / DevOps | CI/CD bằng Jenkins (đang dùng) + triển khai Kubernetes (**thiết kế đề xuất, chưa kiểm chứng**) |
| 6 | [`06-VAN-HANH.md`](06-VAN-HANH.md) | Vận hành | Sao lưu, xoay log, cập nhật phiên bản, rollback, xử lý sự cố |
| 7 | [`07-UAT-VA-NGHIEM-THU.md`](07-UAT-VA-NGHIEM-THU.md) | QA / quản lý dự án | Kịch bản hồi quy, kiểm thử thiết bị thật, tiêu chí nghiệm thu |
| 8 | [`08-ZALO-PHAT-HANH.md`](08-ZALO-PHAT-HANH.md) | Quản trị Mini App | Điều kiện, cấu hình trước build, nộp kiểm duyệt, template ZNS, rủi ro lịch |
| 9 | [`09-ZALO-XIN-QUYEN-API.md`](09-ZALO-XIN-QUYEN-API.md) | Quản trị Mini App | Hồ sơ xin 4 quyền API Zalo, webhook xoá dữ liệu, bản nháp Điều khoản sử dụng |
| 10 | [`10-ZALO-MO-TA-BAN-DEMO.md`](10-ZALO-MO-TA-BAN-DEMO.md) | Quản trị Mini App | Nội dung nộp xét duyệt cho **bản demo**, chế độ demo trong mã nguồn |
| 11 | [`11-ZALO-4-QUYEN-API.md`](11-ZALO-4-QUYEN-API.md) | Quản trị Mini App | Tờ làm việc từng quyền API (25 · 38 · 94 · 100), mô tả dán vào form, cách chụp ảnh |

### Quyết định kiến trúc (ADR)

Những quyết định có đánh đổi, đã cân nhắc phương án khác rồi mới chốt. Đổi ý về sau thì
viết ADR **mới** đặt cái cũ thành "Đã thay thế", không sửa đè lên bản đã chốt.

| # | Quyết định | Trạng thái |
|---|---|---|
| [0001](quyet-dinh/0001-thu-hoi-phan-anh.md) | Thu hồi phản ánh: xoá mềm · quyền `approve` · đếm cả phiếu đã gỡ vào chống spam | Đã chốt 10/09/2026 |

---

## Toàn cảnh hệ thống

```
┌────────────┐              ┌──────────────┐
│ admin-web  │              │ zalo-miniapp │
│ Next.js 16 │              │ React + Vite │
│ Cán bộ     │              │ Công dân     │
└─────┬──────┘              └──────┬───────┘
      │      REST + JWT            │
      └──────────────┬─────────────┘
                     ▼
              ┌──────────────────┐
              │   API Gateway    │  NestJS 11
              │   19 module      │
              └────────┬─────────┘
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    MongoDB        RabbitMQ      Adapter bên thứ 3
                                 OCR · GIS · ZNS · FCM
```

**Hai lớp người dùng, hai mức tin cậy khác nhau:**

- **Cán bộ** — tài khoản do quản trị viên cấp, RBAC theo phân hệ, mọi thao tác ghi vết.
- **Công dân** — định danh chỉ bằng số điện thoại + OTP. Danh tính **yếu**; mỗi công dân
  chỉ được thấy đúng dữ liệu của chính mình.

## Đọc theo tình huống

| Bạn cần | Đọc |
|---|---|
| Dựng hệ thống trên máy chủ mới | `04-TRIEN-KHAI-VPS.md` từ Bước 0 |
| Cấu hình Jenkins, hiểu pipeline CI/CD | `05-TRIEN-KHAI-K8S.md` mục 2 |
| Cân nhắc chuyển sang Kubernetes | `05-TRIEN-KHAI-K8S.md` mục 1 và 3 |
| Sao lưu, khôi phục, cập nhật phiên bản | `06-VAN-HANH.md` |
| Xử lý sự cố khi đang chạy | `06-VAN-HANH.md` mục 5 |
| Nộp / cập nhật Zalo Mini App | `08-ZALO-PHAT-HANH.md` |
| Hiểu một phân hệ trước khi sửa | Tài liệu module tương ứng, mục "Cấu trúc" và "Quy ước" |
| Thêm endpoint mới | `01-BACKEND.md` mục Quy ước |
| Gỡ lỗi "tự nhiên bị đăng xuất" | `02-ADMIN-WEB.md` mục 3 và 5 |
| Rà soát an toàn trước khi lên production | `../SECURITY.md` mục 4 |

---

## Việc còn phụ thuộc bên ngoài

Bốn hạng mục dưới đây **không** hoàn tất được bằng lập trình, cần khách hàng quyết định
hoặc cấp tài khoản:

| Hạng mục | Cần gì |
|---|---|
| OCR, bản đồ (GIS) | Khách chốt nhà cung cấp và cấp khoá API |
| Zalo OA + ZNS | Khách đăng ký OA; template ZNS chờ Zalo duyệt (1 ngày – 1 tuần) |
| Phát hành Zalo Mini App | Tài khoản Zalo Developers + Official Account của đơn vị |
| Tra cứu hồ sơ (WBS #15) | Đầu nối vào hệ thống một cửa của tỉnh — hệ thống ngoài |

Danh sách câu hỏi mở đầy đủ: `../ESTIMATE_TECHNICAL.md`.

---

## Quy tắc khi bổ sung tài liệu

**Một chủ đề — một tài liệu.** Tính năng đang làm dở thì **hoàn thiện tài liệu đã có**
của nó, không tạo tệp mới ghi phần bổ sung. Bộ tài liệu phồng lên vì mỗi lần sửa lại
thêm một tệp là bộ tài liệu không bàn giao được: người đọc không biết tệp nào còn đúng.

Trước khi tạo tệp mới, đối chiếu bảng mục lục ở trên — chắc chắn không tệp nào đang phụ
trách chủ đề đó. Tạo tệp mới thì **thêm vào mục lục ngay**.

→ Luật đầy đủ: `../.claude/skills/tai-lieu-dong-bo/SKILL.md`

---

## Tài liệu khác trong dự án

`../README.md` (chạy tại máy phát triển) · `../SECURITY.md` (rà soát bảo mật, việc bắt
buộc trước production) · `../BAO-CAO-TIEN-DO.md` (tiến độ) · `../deploy/` (tệp cấu hình
chạy được) · `../k8s/` (manifest Kubernetes) · `../plans/` (plan chi tiết từng task) ·
`../CLAUDE.md` (quy ước cho AI agent)
