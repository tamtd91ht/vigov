# ViGov Mobile — Hướng dẫn build

## Bản phát hành Android (APK)

```bash
cd mobile
flutter build apk --release --no-tree-shake-icons \
  --dart-define=API_BASE_URL=http://<IP-máy-chủ>:3001/api/v1 \
  --dart-define=USE_MOCKS=false
```

Kết quả: `build/app/outputs/flutter-apk/app-release.apk`

### Vì sao có `--no-tree-shake-icons`

Không có cờ này, bước rút gọn font icon của Flutter 3.41.6 bị sập trên máy Windows này
(`ExceptionCode=-1073741819`, chính công cụ gợi ý thêm cờ). Đánh đổi: APK lớn hơn vài trăm KB.
Thử bỏ cờ lại sau khi nâng cấp Flutter.

### Bản AAB để nộp Google Play

Google Play yêu cầu **AAB**, không nhận APK:

```bash
flutter build appbundle --release --no-tree-shake-icons \
  --dart-define=API_BASE_URL=https://api.vigov.<tên-miền>/api/v1 \
  --dart-define=USE_MOCKS=false
```

## Ký bản phát hành

Cấu hình ký đọc từ `android/key.properties` (đã gitignore cùng `android/*.jks`).
Thiếu tệp này thì bản release tự rơi về khoá debug — chạy thử được, **không nộp store được**.

Tạo keystore mới:

```bash
keytool -genkeypair -v -keystore android/vigov-release.jks -storetype JKS \
  -keyalg RSA -keysize 2048 -validity 10000 -alias vigov
```

Rồi tạo `android/key.properties`:

```properties
storeFile=vigov-release.jks
storePassword=<mật khẩu>
keyAlias=vigov
keyPassword=<mật khẩu>
```

> **Quan trọng**: keystore hiện tại chỉ dùng cho nội bộ và UAT. Khi phát hành thật,
> UBND xã phải giữ keystore riêng của mình — **mất keystore là không cập nhật được app**
> trên Google Play nữa. Xem `deploy/RELEASE.md`.

Kiểm tra APK đã ký bằng khoá nào:

```bash
apksigner verify --print-certs build/app/outputs/flutter-apk/app-release.apk
```

## Kết nối backend

`API_BASE_URL` phải là địa chỉ điện thoại truy cập được:

| Môi trường | Giá trị |
|---|---|
| Emulator Android | `http://10.0.2.2:3001/api/v1` |
| Điện thoại thật cùng Wi-Fi | `http://<IP-LAN-máy-phát-triển>:3001/api/v1` |
| Staging / production | `https://api.vigov.<tên-miền>/api/v1` |

Android 9 trở lên **chặn HTTP thường**. Địa chỉ nội bộ phải khai trong
`android/app/src/main/res/xml/network_security_config.xml` — đổi máy phát triển
thì nhớ sửa IP trong tệp đó. Bản production dùng HTTPS nên không cần ngoại lệ này.

## Định danh khi chạy thử

Phase 1 backend **chưa gửi SMS/ZNS thật**: mã OTP được ghi ra log máy chủ
(dòng `Mã OTP cho 09xx…: 123456`). Người kiểm thử lấy mã ở đó.

## Bản iOS

Cần máy macOS:

```bash
flutter build ipa --release --no-tree-shake-icons --dart-define=...
```

Trước khi build phải có tài khoản Apple Developer của tổ chức và provisioning profile —
xem `deploy/RELEASE.md`.
