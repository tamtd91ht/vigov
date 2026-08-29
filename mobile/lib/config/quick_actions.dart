import 'package:flutter/material.dart';
import 'theme.dart';

/// 6 ô truy cập nhanh trên Trang chủ (WBS #12) — cấu hình tập trung, không hardcode trong màn hình.
class QuickAction {
  const QuickAction({required this.label, required this.icon, required this.color, required this.route});

  final String label;
  final IconData icon;
  final Color color;
  final String route;
}

const List<QuickAction> homeQuickActions = [
  QuickAction(label: 'Gửi phản ánh', icon: Icons.campaign_outlined, color: AppColors.pink, route: '/send-feedback'),
  QuickAction(label: 'Tra cứu hồ sơ', icon: Icons.find_in_page_outlined, color: AppColors.blue, route: '/lookup'),
  QuickAction(label: 'Truyền thanh', icon: Icons.radio_outlined, color: AppColors.orange, route: '/radio'),
  QuickAction(label: 'Video', icon: Icons.play_circle_outline, color: AppColors.purple, route: '/video'),
  QuickAction(label: 'Danh bạ', icon: Icons.contact_phone_outlined, color: AppColors.teal, route: '/directory'),
  QuickAction(label: 'Tin tức', icon: Icons.article_outlined, color: AppColors.green, route: '/news'),
];
