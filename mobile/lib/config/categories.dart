import 'package:flutter/material.dart';
import 'theme.dart';

/// Danh mục phản ánh + SLA cam kết (WBS #13 — 12 danh mục).
/// 8 danh mục đầu đồng bộ Web Quản trị (sla.config.ts); nguồn thật: API cấu hình.
class FeedbackCategory {
  const FeedbackCategory({
    required this.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.intakeDays,
    required this.resolveDays,
  });

  final String key;
  final String label;
  final IconData icon;
  final Color color;

  /// Số ngày làm việc tiếp nhận, phân loại
  final int intakeDays;

  /// Số ngày làm việc xử lý xong
  final int resolveDays;

  String get slaText => 'Tiếp nhận trong $intakeDays ngày · xử lý trong $resolveDays ngày làm việc';
}

const List<FeedbackCategory> feedbackCategories = [
  FeedbackCategory(key: 'rac-thai', label: 'Rác thải', icon: Icons.delete_outline, color: AppColors.orange, intakeDays: 4, resolveDays: 3),
  FeedbackCategory(key: 'giao-thong', label: 'Giao thông', icon: Icons.directions_car_outlined, color: AppColors.blue, intakeDays: 4, resolveDays: 5),
  FeedbackCategory(key: 've-sinh-moi-truong', label: 'Vệ sinh môi trường', icon: Icons.eco_outlined, color: AppColors.green, intakeDays: 4, resolveDays: 3),
  FeedbackCategory(key: 'trat-tu-do-thi', label: 'Trật tự đô thị', icon: Icons.storefront_outlined, color: AppColors.purple, intakeDays: 6, resolveDays: 5),
  FeedbackCategory(key: 'an-ninh', label: 'An ninh', icon: Icons.shield_outlined, color: AppColors.red, intakeDays: 2, resolveDays: 2),
  FeedbackCategory(key: 'xay-dung', label: 'Xây dựng', icon: Icons.construction_outlined, color: AppColors.teal, intakeDays: 8, resolveDays: 7),
  FeedbackCategory(key: 'can-bo', label: 'Cán bộ', icon: Icons.badge_outlined, color: AppColors.pink, intakeDays: 4, resolveDays: 5),
  FeedbackCategory(key: 'dien-chieu-sang', label: 'Điện chiếu sáng', icon: Icons.lightbulb_outline, color: AppColors.orange, intakeDays: 4, resolveDays: 5),
  FeedbackCategory(key: 'cap-thoat-nuoc', label: 'Cấp thoát nước', icon: Icons.water_drop_outlined, color: AppColors.blue, intakeDays: 4, resolveDays: 5),
  FeedbackCategory(key: 'dat-dai', label: 'Đất đai', icon: Icons.landscape_outlined, color: AppColors.slate, intakeDays: 8, resolveDays: 7),
  FeedbackCategory(key: 'y-te-giao-duc', label: 'Y tế – Giáo dục', icon: Icons.local_hospital_outlined, color: AppColors.green, intakeDays: 4, resolveDays: 5),
  FeedbackCategory(key: 'khac', label: 'Khác', icon: Icons.more_horiz, color: AppColors.muted, intakeDays: 8, resolveDays: 7),
];

FeedbackCategory categoryOf(String keyOrLabel) => feedbackCategories.firstWhere(
      (c) => c.key == keyOrLabel || c.label == keyOrLabel,
      orElse: () => feedbackCategories.last,
    );
