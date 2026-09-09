---
name: zalo-miniapp-platform
description: Dùng khi làm việc trong zalo-miniapp/ — zmp-sdk, xin quyền API Zalo, getPhoneNumber, getLocation, camera, vùng an toàn màn hình, chế độ demo, nộp hồ sơ Mini App. Kích hoạt bởi: Zalo, Mini App, zmp-sdk, zmp, quyền API, getPhoneNumber, getLocation, followOA, safe area, VITE_, demo mode, h5.zdn.vn, webhook Zalo, ZNS.
---

# Kỹ năng: Nền tảng Zalo Mini App
# Mức: CAO | Ngăn: hồ sơ xin quyền bị từ chối, SDK treo, phiên lưu sai chỗ

## Ràng buộc của nền tảng — không thể lách

| Ràng buộc | Hệ quả |
|---|---|
| Quyền API phải được Zalo **duyệt từng quyền** | Chưa duyệt thì hàm SDK trả lỗi, không phải trả rỗng. Phải có đường dự phòng |
| `getPhoneNumber` **chưa được cấp** | Đang dùng `CITIZEN_OTP_BYPASS_CODE` → `skills/xac-thuc-otp-cong-dan` |
| Ô nhập OTP cố định **6 ký tự số** | Không thể đặt mã dài hơn ở backend |
| Mini App chạy trong WebView của Zalo | `localStorage` là kho duy nhất, và nó không an toàn cho token dài hạn (T-07) |
| Vùng an toàn đỉnh/đáy màn khác nhau theo thiết bị | Phải đặt sàn cứng, không tin giá trị SDK trả về |
| `zmp-sdk` kéo theo `@sentry/browser` có lỗ hổng mức trung bình | Không tự nâng được — chờ Zalo phát hành bản mới |

## Bốn quyền đang xin

Hồ sơ chi tiết: `docs/05-ZALO-XIN-QUYEN-API.md` · `docs/06-ZALO-MO-TA-BAN-DEMO.md` ·
`docs/07-ZALO-4-QUYEN-API-CHI-TIET.md`. Ảnh minh chứng ở `docs/anh-xin-quyen/`.
**Sửa luồng liên quan tới quyền nào thì phải cập nhật hồ sơ quyền đó** — hồ sơ và mã
lệch nhau là lý do Zalo từ chối.

## MUST

| # | Luật |
|---|------|
| 1 | Mọi lệnh SDK gọi qua **adapter** trong `src/services/` — không gọi `zmp-sdk` trực tiếp từ component |
| 2 | Lệnh SDK có **giới hạn thời gian chờ**; hết thời gian thì hiện lỗi rõ ràng, không treo màn trắng |
| 3 | Xin quyền (camera, vị trí) **trước** khi dùng, và hiện nguyên văn lỗi SDK khi bị từ chối để người dùng biết phải bật ở đâu |
| 4 | Vị trí: lấy đúng vị trí thiết bị, **không** dùng toạ độ ước lượng theo mạng, và không ghim toạ độ ước lượng lên phiếu |
| 5 | Cờ mock **SDK** tách khỏi cờ mock **dữ liệu** — hai thứ khác nhau (camera cần SDK thật dù dữ liệu là mock) |
| 6 | Chế độ demo bật/tắt bằng `VITE_DEMO_MODE`, có bộ nhận diện "ViGov Demo" hiện rõ |
| 7 | Cấu hình đọc qua `src/config/app.config.ts`, coi chuỗi rỗng là chưa đặt |
| 8 | Nút quay lại **luôn** thoát được màn (WebView không có nút back hệ thống ở mọi thiết bị) |
| 9 | Webhook Zalo (`modules/zalo-webhook`) **luôn trả 200**, chỉ xử lý khi chữ ký hợp lệ — trả lỗi làm Zalo thử lại và có thể khoá webhook |
| 10 | CORS production phải có `https://h5.zdn.vn` trong `CORS_ORIGINS` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Đặt secret vào biến `VITE_*` — chúng **nằm trong bundle** |
| 2 | Lưu refresh token hay token dài hạn trong `localStorage` (T-07) |
| 3 | Gọi `zmp-sdk` trong nhánh mã dùng chung với bản web thường (SDK không tồn tại ngoài Zalo) |
| 4 | Giả định quyền đã được cấp — luôn có nhánh xử lý khi chưa cấp |
| 5 | Nâng `zmp-sdk` xuống bản cũ để "sửa" cảnh báo `npm audit` (`audit fix --force` hạ xuống 2.9.4 — không thực hiện) |
| 6 | Thuật ngữ kỹ thuật hay tiếng Anh trên giao diện công dân → `rules/critical/ngon-ngu-hanh-chinh.md` |
| 7 | Yêu cầu công dân nhập lại thông tin mà hệ thống đã có |

## 9 màn hình

`onboarding` `home` `send-feedback` `my-feedback` `lookup` `news` `radio` `video`
`directory` `profile` (+ `idcard`, `map`)

## Sau khi sửa

```
cd zalo-miniapp && npx tsc --noEmit && npm run lint
```

Đổi luồng → cập nhật `docs/03-ZALO-MINIAPP.md`. Đổi phần liên quan tới quyền → cập nhật
hồ sơ xin quyền tương ứng.

→ `skills/xac-thuc-otp-cong-dan` · `skills/tiep-can-nguoi-cao-tuoi` · `rules/critical/bi-mat-cau-hinh.md`
