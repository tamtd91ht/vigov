# ViGov — Hồ sơ phát hành 3 kênh (task P4-37)

> App công dân phát hành song song **Google Play**, **App Store** và **Zalo Mini App Store**.
> Nộp kiểm duyệt ngay khi code-complete để lead time review chạy song song với QA nội bộ.

---

## 0. Việc khách hàng phải chuẩn bị trước (không tính ngày công)

| Việc | Bên chịu trách nhiệm | Ghi chú |
|---|---|---|
| Tài khoản Google Play Console | Khách hàng | Phí đăng ký một lần, xác minh tổ chức 1–3 ngày |
| Tài khoản Apple Developer Program (tổ chức) | Khách hàng | Phí thường niên, cần mã D-U-N-S của đơn vị — **xin D-U-N-S có thể mất 1–2 tuần** |
| Zalo Official Account + Zalo Developers | Khách hàng | Điều kiện bắt buộc để chạy Mini App và gửi ZNS |
| Tên miền + chứng chỉ TLS cho backend | Khách hàng | Cả 3 store đều yêu cầu API chạy HTTPS |
| Trang Chính sách quyền riêng tư (URL công khai) | Khách hàng + đội phát triển | Bắt buộc với cả 3 store |
| Logo, ảnh chụp màn hình, mô tả ứng dụng | Đội phát triển soạn, khách duyệt | Xem mục 4 |

---

## 1. Google Play (Android)

### Chuẩn bị kỹ thuật
- **Keystore phát hành**: tạo một lần, lưu trong hệ thống quản lý bí mật của khách (mất keystore = không cập nhật được app).
  ```bash
  keytool -genkey -v -keystore vigov-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias vigov
  ```
- Khai báo `mobile/android/key.properties` (đã nằm trong `.gitignore`, **không commit**) và trỏ `signingConfigs.release` trong `mobile/android/app/build.gradle.kts`.
- `applicationId`: `vn.gov.vigov.vigov_mobile` (đặt khi scaffold — đổi thì phải tạo app mới trên Play).
- Bản build: `flutter build appbundle --release` (Play yêu cầu **AAB**, không phải APK).
- Cấu hình runtime truyền qua `--dart-define`:
  ```bash
  flutter build appbundle --release \
    --dart-define=API_BASE_URL=https://api.vigov.<tên-miền>/api/v1 \
    --dart-define=USE_MOCKS=false \
    --dart-define=ORG_NAME="Xã Đại Thắng"
  ```

### Khai báo bắt buộc trên Play Console
- **Data safety**: khai đúng dữ liệu thu thập — số điện thoại (định danh), vị trí chính xác (gửi phản ánh), ảnh (ảnh hiện trường). Nêu rõ mục đích và việc không chia sẻ cho bên thứ ba.
- **Quyền nhạy cảm**: `ACCESS_FINE_LOCATION` và `CAMERA` cần mô tả mục đích rõ ràng trong phần khai báo.
- **Target API level**: theo yêu cầu hiện hành của Play tại thời điểm nộp.
- **Nội dung**: phân loại độ tuổi, chính sách quyền riêng tư (URL), thông tin liên hệ hỗ trợ.

### Lộ trình phát hành
Internal testing → Closed testing (nhóm cán bộ xã) → Production. Lần đầu Google thường duyệt **vài ngày đến 1 tuần**.

---

## 2. App Store (iOS)

### Chuẩn bị kỹ thuật
- Cần **máy macOS** để build và nộp (Windows không build được iOS) — nếu đội không có máy Mac, dùng dịch vụ CI có macOS runner.
- Tạo App ID, Provisioning Profile (Distribution), Certificate trên Apple Developer Portal.
- Bundle ID: `vn.gov.vigov.vigovMobile`.
- Bổ sung mô tả quyền vào `mobile/ios/Runner/Info.plist` (**bắt buộc, thiếu là bị từ chối**):
  ```xml
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>Ứng dụng dùng vị trí của bạn để xác định chính xác nơi xảy ra sự việc khi gửi phản ánh tới UBND xã.</string>
  <key>NSCameraUsageDescription</key>
  <string>Ứng dụng dùng camera để bạn chụp ảnh hiện trường kèm theo phản ánh.</string>
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Ứng dụng truy cập thư viện ảnh để bạn chọn ảnh hiện trường kèm theo phản ánh.</string>
  ```
- Build: `flutter build ipa --release --dart-define=...` rồi nộp qua Xcode Organizer hoặc `xcrun altool`.

### Khai báo bắt buộc trên App Store Connect
- **App Privacy**: khai dữ liệu thu thập tương tự Play.
- **Tài khoản demo cho reviewer** — Apple yêu cầu app có đăng nhập phải cung cấp tài khoản thử. Vì app định danh bằng SĐT + OTP, cần **chuẩn bị một SĐT thử nghiệm nhận được OTP**, hoặc bật cơ chế mã OTP cố định cho số thử nghiệm (khai báo rõ trong ghi chú gửi reviewer).
- **Ghi chú cho reviewer**: giải thích đây là ứng dụng của cơ quan hành chính nhà nước cấp xã, nêu phạm vi sử dụng.
- Apple thường yêu cầu app của cơ quan chính phủ phải **do tài khoản Apple Developer của chính tổ chức đó phát hành** — không dùng tài khoản cá nhân của đội phát triển.

### Lộ trình
TestFlight (nội bộ + nhóm cán bộ) → App Store Review. Review thường **1–3 ngày**, có thể lâu hơn nếu bị hỏi thêm.

---

## 3. Zalo Mini App Store

### Chuẩn bị kỹ thuật
- Đăng nhập Zalo Developers, tạo Mini App gắn với Official Account của UBND xã.
- Điền `VITE_ZALO_APP_ID`, `VITE_ZALO_OA_ID` vào `.env` production; đặt `VITE_USE_MOCKS=false` để adapter `src/services/zalo.ts` gọi `zmp-sdk` thật.
- Kiểm tra `zalo-miniapp/app-config.json` (tiêu đề, màu header, thanh trạng thái).
- Build: `npm run build` → thư mục `dist/`, nộp bằng `zmp deploy` (Zalo Mini App CLI) hoặc tải lên qua Developers Console.
- Khai báo quyền dùng trong Mini App: số điện thoại, vị trí, camera/thư viện ảnh, quét QR.

### Lưu ý riêng
- Template **ZNS phải được Zalo duyệt riêng** (không đi cùng duyệt Mini App): thời gian **vài ngày đến 1 tuần**, nộp càng sớm càng tốt.
- Mini App của cơ quan nhà nước có thể được yêu cầu bổ sung giấy tờ chứng minh đơn vị.

---

## 4. Tài sản chung cho 3 kênh (đội phát triển soạn, khách duyệt)

| Hạng mục | Yêu cầu |
|---|---|
| Icon ứng dụng | 1024×1024 PNG không alpha (Apple), bộ adaptive icon (Android) |
| Ảnh chụp màn hình | Tối thiểu 4 ảnh mỗi kích thước: Trang chủ, Gửi phản ánh, Phản ánh của tôi, Tin tức |
| Tên hiển thị | "ViGov — Điều hành số cấp xã" (kiểm tra giới hạn ký tự từng store) |
| Mô tả ngắn | Kênh tương tác giữa người dân và UBND xã: gửi phản ánh kèm ảnh và vị trí, theo dõi tiến độ xử lý, tra cứu hồ sơ một cửa, đọc tin tức và nghe truyền thanh của xã. |
| Mô tả dài | Nêu 6 nhóm tính năng, cam kết SLA xử lý phản ánh, thông tin đơn vị vận hành |
| Chính sách quyền riêng tư | URL công khai; nêu rõ dữ liệu thu thập, mục đích, thời gian lưu, quyền của người dùng |
| Thông tin liên hệ hỗ trợ | Email + tổng đài một cửa của xã |

---

## 5. Rủi ro lịch phát hành

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Chưa có tài khoản Apple Developer tổ chức (chờ D-U-N-S) | Chặn hoàn toàn kênh iOS, có thể 1–2 tuần | Khách khởi động đăng ký ngay từ tuần 1 |
| Không có máy macOS để build iOS | Không nộp được App Store | Dùng CI có macOS runner hoặc mượn máy Mac |
| Zalo chậm duyệt template ZNS | Không gửi được thông báo cho công dân | Nộp template ngay khi code-complete; app vẫn chạy, chỉ thiếu thông báo |
| Store từ chối vì thiếu mô tả quyền / tài khoản demo | Trễ 3–7 ngày mỗi vòng | Dùng checklist mục 1–3 trước khi nộp |
| Backend chưa có HTTPS/tên miền | Cả 3 store đều từ chối | Hoàn tất TLS trước khi nộp (xem `deploy/README.md`) |
