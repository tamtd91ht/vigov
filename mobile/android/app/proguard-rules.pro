# Giữ lại lớp của Flutter và các plugin — R8 xoá nhầm sẽ gây lỗi lúc chạy
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**
