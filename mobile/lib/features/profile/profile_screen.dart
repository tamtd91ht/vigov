import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../config/theme.dart';
import '../../state/app_settings.dart';
import '../../state/feedback_store.dart';
import '../../state/session_controller.dart';
import '../../widgets/common.dart';

/// Phiên bản hiển thị ở nhóm "Về ứng dụng" — cập nhật khi phát hành.
const String _kAppVersion = '1.0.0 (beta)';

/// Che giữa SĐT định danh: 0987654432 → 098•••432 (giữ 3 số đầu + 3 số cuối).
String maskPhone(String phone) {
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  if (digits.length < 7) return phone;
  return '${digits.substring(0, 3)}•••${digits.substring(digits.length - 3)}';
}

/// Màn "Cá nhân & Cài đặt" (WBS #20) — hồ sơ định danh, tiện ích, cỡ chữ,
/// thông báo, thông tin ứng dụng và đăng xuất.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cá nhân')),
      body: ListView(
        padding: const EdgeInsets.all(AppDimens.pagePadding),
        children: [
          const _IdentityCard(),
          const SizedBox(height: 20),
          const SectionHeader(title: 'Tiện ích của tôi'),
          const _MyUtilitiesCard(),
          const SizedBox(height: 20),
          const SectionHeader(title: 'Cài đặt hiển thị'),
          const _DisplaySettingsCard(),
          const SizedBox(height: 20),
          const SectionHeader(title: 'Thông báo'),
          const _NotificationCard(),
          const SizedBox(height: 20),
          const SectionHeader(title: 'Về ứng dụng'),
          const _AboutCard(),
          const SizedBox(height: 24),
          const _LogoutButton(),
          const SizedBox(height: 12),
          Center(
            child: Text(
              '${AppConfig.appName} · ${AppConfig.appTagline}',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

/// Header card: avatar chữ cái đầu + tên + SĐT che giữa + badge định danh.
class _IdentityCard extends StatelessWidget {
  const _IdentityCard();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>().session;
    final name = session?.displayName ?? 'Công dân';
    final phone = session?.phone ?? '';
    final initial = name.trim().isEmpty ? '?' : name.trim().characters.first.toUpperCase();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: AppColors.navy,
              child: Text(
                initial,
                style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 3),
                  if (phone.isNotEmpty)
                    Text(
                      'SĐT định danh: ${maskPhone(phone)}',
                      style: const TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                  const SizedBox(height: 8),
                  const StatusChip(label: 'Đã định danh', color: AppColors.green, icon: Icons.verified),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Nhóm lối tắt tới các tiện ích cá nhân.
class _MyUtilitiesCard extends StatelessWidget {
  const _MyUtilitiesCard();

  @override
  Widget build(BuildContext context) {
    final ticketCount = context.watch<FeedbackStore>().tickets.length;

    return Card(
      child: Column(
        children: [
          _NavTile(
            icon: Icons.forum_outlined,
            iconColor: AppColors.blue,
            title: 'Phản ánh của tôi',
            subtitle: '$ticketCount phiếu đã gửi',
            onTap: () => context.go('/my-feedback'),
          ),
          const Divider(indent: 56),
          _NavTile(
            icon: Icons.history,
            iconColor: AppColors.teal,
            title: 'Lịch sử tra cứu hồ sơ',
            onTap: () => context.push('/lookup'),
          ),
        ],
      ),
    );
  }
}

/// Cài đặt cỡ chữ toàn app — áp dụng qua MaterialApp.builder, tại đây chỉ setFont.
class _DisplaySettingsCard extends StatelessWidget {
  const _DisplaySettingsCard();

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<AppSettings>();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.format_size, size: 20, color: AppColors.navy),
                const SizedBox(width: 8),
                Text('Cỡ chữ', style: Theme.of(context).textTheme.titleSmall),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: SegmentedButton<String>(
                segments: [
                  for (final option in fontScaleOptions)
                    ButtonSegment(value: option.key, label: Text(option.label)),
                ],
                selected: {settings.font.key},
                showSelectedIcon: false,
                style: SegmentedButton.styleFrom(
                  selectedBackgroundColor: AppColors.navy,
                  selectedForegroundColor: Colors.white,
                  foregroundColor: AppColors.text,
                  side: const BorderSide(color: AppColors.border),
                  textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                ),
                onSelectionChanged: (selection) {
                  final option =
                      fontScaleOptions.firstWhere((o) => o.key == selection.first);
                  context.read<AppSettings>().setFont(option);
                  showAppSnack(context, 'Đã áp dụng cỡ chữ ${option.label}');
                },
              ),
            ),
            const SizedBox(height: 12),
            // Cỡ chữ đã áp dụng toàn app qua textScaler — dòng mẫu để thấy ngay hiệu ứng.
            const Text(
              'Xem trước: Kích thước chữ hiện tại',
              style: TextStyle(color: AppColors.muted, fontSize: 13.5),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bật/tắt nhận thông báo từ chính quyền xã.
class _NotificationCard extends StatelessWidget {
  const _NotificationCard();

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<AppSettings>();

    return Card(
      child: SwitchListTile(
        value: settings.notificationsEnabled,
        // Đăng ký/huỷ token FCM/APNs thật thực hiện ở P3 Notification (#23) —
        // Phase 2 chỉ lưu tuỳ chọn qua AppSettings.
        onChanged: (enabled) => context.read<AppSettings>().setNotifications(enabled),
        activeThumbColor: Colors.white,
        activeTrackColor: AppColors.green,
        secondary: const Icon(Icons.notifications_active_outlined, color: AppColors.orange),
        title: const Text(
          'Nhận thông báo từ chính quyền xã',
          style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w600, fontSize: 14.5),
        ),
        subtitle: const Text(
          'Kết quả phản ánh, tin khẩn, lịch cắt điện nước…',
          style: TextStyle(color: AppColors.muted, fontSize: 12.5),
        ),
      ),
    );
  }
}

/// Thông tin đơn vị vận hành, tổng đài, phiên bản, điều khoản.
class _AboutCard extends StatelessWidget {
  const _AboutCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: [
          const _NavTile(
            icon: Icons.account_balance_outlined,
            iconColor: AppColors.navy,
            title: 'Đơn vị vận hành',
            subtitle: '${AppConfig.orgName} · ${AppConfig.orgParent}',
            showChevron: false,
          ),
          const Divider(indent: 56),
          _NavTile(
            icon: Icons.phone_outlined,
            iconColor: AppColors.green,
            title: 'Tổng đài hỗ trợ',
            subtitle: AppConfig.hotline,
            onTap: () => showAppSnack(context, 'Đang gọi tổng đài ${AppConfig.hotline} (mô phỏng)…'),
          ),
          const Divider(indent: 56),
          const _NavTile(
            icon: Icons.info_outline,
            iconColor: AppColors.slate,
            title: 'Phiên bản',
            subtitle: _kAppVersion,
            showChevron: false,
          ),
          const Divider(indent: 56),
          _NavTile(
            icon: Icons.policy_outlined,
            iconColor: AppColors.purple,
            title: 'Điều khoản sử dụng & Quyền riêng tư',
            onTap: () => showAppSnack(context, 'Tài liệu sẽ bổ sung khi phát hành'),
          ),
        ],
      ),
    );
  }
}

/// Nút đăng xuất viền đỏ + hộp thoại xác nhận. Router tự đưa về /onboarding.
class _LogoutButton extends StatelessWidget {
  const _LogoutButton();

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Đăng xuất',
            style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: 17)),
        content: const Text(
          'Bạn sẽ cần định danh lại bằng số điện thoại để tiếp tục sử dụng. Đăng xuất ngay?',
          style: TextStyle(color: AppColors.text, fontSize: 14, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Ở lại', style: TextStyle(color: AppColors.muted)),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Đăng xuất',
                style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await context.read<SessionController>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () => _confirmLogout(context),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.red,
        side: const BorderSide(color: AppColors.red),
      ),
      icon: const Icon(Icons.logout, size: 19),
      label: const Text('Đăng xuất'),
    );
  }
}

/// Dòng mục trong card danh sách — icon nền nhạt + tiêu đề + phụ đề + chevron.
class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    this.subtitle,
    this.onTap,
    this.showChevron = true,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.tint(iconColor, .12),
          borderRadius: BorderRadius.circular(AppDimens.radiusSm),
        ),
        child: Icon(icon, size: 20, color: iconColor),
      ),
      title: Text(
        title,
        style: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.w600, fontSize: 14.5),
      ),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!, style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
      trailing: onTap != null && showChevron
          ? const Icon(Icons.chevron_right, size: 20, color: AppColors.muted)
          : null,
    );
  }
}
