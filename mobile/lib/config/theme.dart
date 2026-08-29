import 'package:flutter/material.dart';

/// Palette ViGov — đồng bộ nhận diện với Web Quản trị (globals.css).
class AppColors {
  AppColors._();

  static const Color navy = Color(0xFF1B3A5C);
  static const Color blue = Color(0xFF3B82C4);
  static const Color pink = Color(0xFFE91E8C);
  static const Color green = Color(0xFF27AE60);
  static const Color orange = Color(0xFFE67E22);
  static const Color purple = Color(0xFF8E44AD);
  static const Color red = Color(0xFFE74C3C);
  static const Color teal = Color(0xFF17A2A2);
  static const Color slate = Color(0xFF5B6C8F);

  static const Color bg = Color(0xFFFFFFFF);
  static const Color bg2 = Color(0xFFFAFBFC);
  static const Color border = Color(0xFFE5E8EB);
  static const Color text = Color(0xFF4A5568);
  static const Color muted = Color(0xFF8896A6);

  /// Nền nhạt cho chip/badge từ màu chính
  static Color tint(Color c, [double opacity = .10]) => c.withValues(alpha: opacity);
}

/// Bo góc/khoảng cách chuẩn toàn app
class AppDimens {
  AppDimens._();

  static const double radius = 12;
  static const double radiusSm = 9;
  static const double pagePadding = 16;
  static const double gap = 12;
}

/// ThemeData tập trung — mọi màn dùng Theme.of(context), không tự khai màu rời.
ThemeData buildAppTheme() {
  const scheme = ColorScheme.light(
    primary: AppColors.navy,
    secondary: AppColors.pink,
    surface: AppColors.bg,
    error: AppColors.red,
    onPrimary: Colors.white,
    onSecondary: Colors.white,
    onSurface: AppColors.text,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg2,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      foregroundColor: AppColors.navy,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(color: AppColors.navy, fontSize: 17, fontWeight: FontWeight.w700),
    ),
    cardTheme: CardThemeData(
      color: AppColors.bg,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppDimens.radius),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1, space: 1),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.navy,
        side: const BorderSide(color: AppColors.border),
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bg,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.blue, width: 1.6),
      ),
      hintStyle: const TextStyle(color: AppColors.muted, fontSize: 14),
    ),
    textTheme: base.textTheme
        .copyWith(
          titleLarge: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: 20),
          titleMedium: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: 16),
          titleSmall: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.w600, fontSize: 14),
          bodyMedium: const TextStyle(color: AppColors.text, fontSize: 14, height: 1.5),
          bodySmall: const TextStyle(color: AppColors.muted, fontSize: 12.5),
        )
        .apply(bodyColor: AppColors.text),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.navy,
      contentTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13.5),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
    ),
    chipTheme: base.chipTheme.copyWith(
      side: const BorderSide(color: AppColors.border),
      backgroundColor: AppColors.bg,
      selectedColor: AppColors.navy,
      labelStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.text),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
  );
}
