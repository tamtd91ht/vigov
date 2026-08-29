# vigov_mobile

Ứng dụng công dân ViGov (Android + iOS) — Flutter 3.41 / Dart 3.11, Material 3,
`provider` + `go_router` + `shared_preferences` + `http`.

## Địa chỉ backend khi chạy trên máy ảo / thiết bị thật

`AppConfig.apiBaseUrl` đọc từ `--dart-define=API_BASE_URL=...`, **không hardcode
trong mã nguồn**. Lý do: `localhost` bên trong máy ảo trỏ về chính máy ảo chứ
không phải máy phát triển, nên mỗi môi trường cần một địa chỉ khác nhau.

| Môi trường chạy | Giá trị `API_BASE_URL` |
| --- | --- |
| Emulator Android | `http://10.0.2.2:3001/api/v1` |
| Simulator iOS / Flutter desktop / web | `http://localhost:3001/api/v1` |
| Thiết bị thật cùng mạng LAN | `http://<IP-máy-phát-triển>:3001/api/v1`, ví dụ `http://192.168.1.12:3001/api/v1` |
| Máy chủ triển khai | `https://api.vigov.vn/api/v1` |

Lấy IP máy phát triển: `ipconfig` (Windows) hoặc `ifconfig` (macOS/Linux).
Thiết bị thật và máy phát triển phải cùng một mạng, và tường lửa phải mở cổng 3001.

### Chạy với backend thật

```bash
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:3001/api/v1 \
  --dart-define=USE_MOCKS=false
```

### Chạy demo offline (không cần backend)

```bash
flutter run --dart-define=USE_MOCKS=true
```

`USE_MOCKS=true` là mặc định. Nhánh rẽ mock/thật nằm **trong service**
(`IdentityService`, `FeedbackStore`, `ContentService`), màn hình không biết dữ
liệu đến từ đâu.

### Build APK

```bash
flutter build apk --debug \
  --dart-define=API_BASE_URL=http://10.0.2.2:3001/api/v1 \
  --dart-define=USE_MOCKS=false
```

### HTTP thường (cleartext) khi phát triển

Android 9+ và iOS ATS chặn HTTP thường theo mặc định. Dự án đã mở ngoại lệ **chỉ
cho địa chỉ nội bộ**:

- Android: `android/app/src/main/res/xml/network_security_config.xml` cho phép
  `10.0.2.2`, `10.0.3.2`, `localhost`, `127.0.0.1`. Chạy trên **thiết bị thật cùng
  LAN thì phải thêm IP máy phát triển** vào tệp này, ví dụ
  `<domain includeSubdomains="false">192.168.1.12</domain>`.
- iOS: `ios/Runner/Info.plist` bật `NSAllowsLocalNetworking`.

Máy chủ triển khai vẫn bắt buộc HTTPS — cấu hình trên không nới lỏng Internet công cộng.

## Lấy mã OTP khi kiểm thử (Phase 1)

Backend **chưa gửi SMS/ZNS thật**: `POST /auth/citizen/otp/request` chỉ ghi mã ra
**log máy chủ**. Người kiểm thử lấy mã bằng cách tìm dòng
`Mã OTP cho [số điện thoại]: [mã]` trong log của tiến trình NestJS
(môi trường phát triển hiện ghi ra `%TEMP%\vigov-dev.log`).

Khi `USE_MOCKS=false`, màn nhập OTP hiển thị sẵn ghi chú này cho người kiểm thử.

## Các biến `--dart-define` khác

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:3001/api/v1` | Gốc API backend |
| `USE_MOCKS` | `true` | `false` = gọi API thật |
| `ORG_NAME` | `Xã Đại Thắng` | Tên đơn vị hành chính |
| `ORG_PARENT` | `Huyện Phú Xuyên · Thành phố Hà Nội` | Đơn vị cấp trên |
| `HOTLINE` | `024 3378 2200` | Tổng đài hỗ trợ |

## Cấu trúc nguồn dữ liệu

| Màn hình | Endpoint |
| --- | --- |
| Onboarding | `POST /auth/citizen/otp/request`, `POST /auth/citizen/otp/verify` |
| Gửi phản ánh | `POST /feedback/citizen` |
| Phản ánh của tôi | `GET /feedback/citizen/mine` |
| Chi tiết phản ánh | `GET /feedback/citizen/mine/:code`, `POST /feedback/citizen/mine/:code/rating` |
| Tin tức | `GET /content/public/articles`, `GET /content/public/articles/:id` |
| Video | `GET /content/public/videos` |
| Truyền thanh | `GET /content/public/radio` |

Mã phiếu chứa ký tự `#` (ví dụ `#PA-2026-0141`) nên luôn được `Uri.encodeComponent`
trước khi ghép vào đường dẫn.

Nhóm `/content/public/*` không cần token; các endpoint còn lại gắn
`Authorization: Bearer <accessToken>` do `ApiClient` tự thêm. Gặp `401`, `ApiClient`
xoá token và báo `SessionController`, router đưa công dân về màn định danh.
