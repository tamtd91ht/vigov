---
name: flutter-mobile
description: Dùng khi làm việc trong mobile/ — Flutter, Dart, dart-define, secure storage, provider, go_router, build APK/AAB, phát hành store. Kích hoạt bởi: Flutter, Dart, mobile, app công dân, dart-define, app_config.dart, provider, go_router, flutter_secure_storage, SharedPreferences, APK, AAB, Google Play, App Store, Material 3.
---

# Kỹ năng: App công dân Flutter
# Mức: CAO | Ngăn: token lưu không mã hoá, cấu hình cứng trong bản build, phiên bị đá ra khi cập nhật

## Cấu trúc

```
mobile/lib/
  config/    app_config.dart · categories.dart · quick_actions.dart · theme.dart
  features/  home · onboarding · send_feedback · my_feedback · lookup
             news · radio · video · directory · profile
  services/  gọi API + services/device/ (camera, vị trí, kho an toàn)
  state/     provider
  models/ widgets/ mocks/
```

## Cấu hình — không dùng tệp env

Flutter **không** đọc `.env`. Cấu hình truyền lúc build qua `--dart-define`, đọc trong
`lib/config/app_config.dart`. Hệ quả: **thêm cấu hình mới phải cập nhật cả `app_config.dart`
và tài liệu build (`mobile/BUILD.md`)**, nếu không người build sau sẽ ra bản thiếu cấu hình.

## MUST

| # | Luật |
|---|------|
| 1 | Token và phiên lưu bằng `flutter_secure_storage` (Keychain trên iOS, AES/GCM với khoá trong KeyStore trên Android) |
| 2 | `restore()` di trú **một lần** phiên của bản cũ (`SharedPreferences`) rồi xoá sạch bản ghi cũ — cập nhật app không được đá người đang đăng nhập ra ngoài |
| 3 | Mọi cấu hình đọc qua `app_config.dart`, có giá trị mặc định an toàn |
| 4 | Danh mục lĩnh vực, nhãn trạng thái đọc từ `config/categories.dart` — khớp với ba module còn lại → `skills/dong-bo-kieu-4-module` |
| 5 | Xin quyền thiết bị (camera, vị trí) trước khi dùng, có nhánh xử lý khi người dùng từ chối |
| 6 | Vị trí: lấy đúng vị trí thiết bị, không dùng toạ độ ước lượng theo mạng |
| 7 | Chuỗi hiển thị tiếng Việt đúng chính tả, giọng lịch sự với công dân → `rules/critical/ngon-ngu-hanh-chinh.md` |
| 8 | Cỡ chữ và vùng chạm đủ lớn cho người cao tuổi → `skills/tiep-can-nguoi-cao-tuoi` |
| 9 | Kiểu dữ liệu trong `models/` khớp tên trường với `admin-web/src/types/index.ts` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Lưu token trong `SharedPreferences` (không mã hoá — đây là phát hiện T-06 đã sửa, đừng lùi lại) |
| 2 | Hardcode URL API, tên xã, toạ độ bản đồ trong mã Dart |
| 3 | Commit tệp ký (keystore, `.jks`, `key.properties`, provisioning profile) |
| 4 | Ghi log số điện thoại, CCCD, OTP bằng `print()` / `debugPrint()` |
| 5 | Bật chế độ mock ở bản phát hành store |
| 6 | Dùng `http://` cho API ở bản phát hành (Android chặn cleartext theo mặc định — và phải chặn) |
| 7 | Yêu cầu quyền thiết bị mà màn hình đó không cần |

## Kiểm tra sau khi sửa

```
cd mobile && flutter analyze && flutter test
```

Build phát hành: xem `mobile/BUILD.md`. Hồ sơ 3 store: `deploy/RELEASE.md`.

→ `skills/tiep-can-nguoi-cao-tuoi` · `skills/dong-bo-kieu-4-module` · `rules/critical/du-lieu-ca-nhan.md`
