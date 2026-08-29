import 'package:flutter/material.dart';

import '../../config/app_config.dart';
import '../../config/theme.dart';
import '../../mocks/directory_mock.dart';
import '../../models/models.dart';
import '../../services/device/call_service.dart';
import '../../widgets/common.dart';

// ── Hằng số màn Danh bạ ───────────────────────────────────────────────
const String _kTitle = 'Danh bạ chính quyền';
const String _kSearchHint = 'Tìm theo tên, chức danh, bộ phận, SĐT…';
const String _kLeadersHeader = 'Lãnh đạo UBND xã';
const String _kDepartmentsHeader = 'Bộ phận chuyên môn';
const String _kEmptyMessage = 'Không tìm thấy liên hệ phù hợp.\nThử từ khoá khác.';
const String _kHotlineTitle = 'Tổng đài một cửa';

/// Màu avatar xoay vòng theo thứ tự liên hệ — lấy từ palette AppColors.
const List<Color> _kAvatarColors = [
  AppColors.navy,
  AppColors.blue,
  AppColors.green,
  AppColors.orange,
  AppColors.purple,
  AppColors.teal,
  AppColors.pink,
  AppColors.slate,
];

/// Danh bạ chính quyền (WBS #19) — tra cứu và liên hệ cán bộ xã.
class DirectoryScreen extends StatefulWidget {
  const DirectoryScreen({super.key});

  @override
  State<DirectoryScreen> createState() => _DirectoryScreenState();
}

class _DirectoryScreenState extends State<DirectoryScreen> {
  final CallService _callService = CallService();
  final TextEditingController _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _matches(GovContact c) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return c.name.toLowerCase().contains(q) ||
        c.title.toLowerCase().contains(q) ||
        c.department.toLowerCase().contains(q) ||
        c.phone.toLowerCase().contains(q);
  }

  Future<void> _call(String phone) async {
    await _callService.call(phone);
    if (!mounted) return;
    showAppSnack(context, 'Đang gọi $phone… (mô phỏng)');
  }

  Future<void> _message(String phone) async {
    await _callService.message(phone);
    if (!mounted) return;
    showAppSnack(context, 'Đang mở tin nhắn tới $phone… (mô phỏng)');
  }

  @override
  Widget build(BuildContext context) {
    final leaders =
        mockGovContacts.where((c) => c.group == ContactGroup.leader && _matches(c)).toList();
    final departments =
        mockGovContacts.where((c) => c.group == ContactGroup.department && _matches(c)).toList();
    final noResult = leaders.isEmpty && departments.isEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(_kTitle),
            Text(
              AppConfig.orgName,
              style: const TextStyle(
                  color: AppColors.muted, fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppDimens.pagePadding),
        children: [
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              hintText: _kSearchHint,
              prefixIcon: Icon(Icons.search, color: AppColors.muted),
            ),
            onChanged: (value) => setState(() => _query = value),
          ),
          const SizedBox(height: AppDimens.gap + 4),
          if (noResult)
            const EmptyState(icon: Icons.person_search_outlined, message: _kEmptyMessage)
          else ...[
            if (leaders.isNotEmpty) ...[
              const SectionHeader(title: _kLeadersHeader),
              for (var i = 0; i < leaders.length; i++) ...[
                _ContactCard(
                  contact: leaders[i],
                  avatarColor: _kAvatarColors[i % _kAvatarColors.length],
                  onCall: () => _call(leaders[i].phone),
                  onMessage: () => _message(leaders[i].phone),
                ),
                const SizedBox(height: AppDimens.gap - 2),
              ],
              const SizedBox(height: AppDimens.gap - 4),
            ],
            if (departments.isNotEmpty) ...[
              const SectionHeader(title: _kDepartmentsHeader),
              for (var i = 0; i < departments.length; i++) ...[
                _ContactCard(
                  contact: departments[i],
                  avatarColor: _kAvatarColors[i % _kAvatarColors.length],
                  onCall: () => _call(departments[i].phone),
                ),
                const SizedBox(height: AppDimens.gap - 2),
              ],
            ],
          ],
          const SizedBox(height: AppDimens.gap),
          _HotlineCard(onCall: () => _call(AppConfig.hotline)),
        ],
      ),
    );
  }
}

/// Hàng liên hệ: avatar chữ cái đầu + thông tin + nút gọi (và nhắn tin nếu có).
class _ContactCard extends StatelessWidget {
  const _ContactCard({
    required this.contact,
    required this.avatarColor,
    required this.onCall,
    this.onMessage,
  });

  final GovContact contact;
  final Color avatarColor;
  final VoidCallback onCall;
  final VoidCallback? onMessage;

  @override
  Widget build(BuildContext context) {
    final initial = contact.name.isEmpty ? '?' : contact.name.characters.first.toUpperCase();

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.tint(avatarColor, .12),
              child: Text(
                initial,
                style: TextStyle(color: avatarColor, fontSize: 17, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    contact.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: 14.5),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    contact.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.text, fontSize: 12.5),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${contact.department} · ${contact.phone}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (onMessage != null) ...[
              _RoundActionButton(
                icon: Icons.chat_bubble_outline_rounded,
                color: AppColors.blue,
                tooltip: 'Nhắn tin ${contact.name}',
                onTap: onMessage!,
              ),
              const SizedBox(width: 8),
            ],
            _RoundActionButton(
              icon: Icons.phone_rounded,
              color: AppColors.green,
              tooltip: 'Gọi ${contact.phone}',
              onTap: onCall,
            ),
          ],
        ),
      ),
    );
  }
}

/// Nút hành động tròn nền tint màu.
class _RoundActionButton extends StatelessWidget {
  const _RoundActionButton({
    required this.icon,
    required this.color,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: AppColors.tint(color, .12),
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 40,
            height: 40,
            child: Icon(icon, size: 19, color: color),
          ),
        ),
      ),
    );
  }
}

/// Card tổng đài một cửa ở cuối danh sách.
class _HotlineCard extends StatelessWidget {
  const _HotlineCard({required this.onCall});

  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.tint(AppColors.navy, .12),
              child: const Icon(Icons.support_agent_rounded, color: AppColors.navy, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    _kHotlineTitle,
                    style: TextStyle(
                        color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: 14.5),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${AppConfig.hotline} · ${AppConfig.orgName}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _RoundActionButton(
              icon: Icons.phone_rounded,
              color: AppColors.green,
              tooltip: 'Gọi ${AppConfig.hotline}',
              onTap: onCall,
            ),
          ],
        ),
      ),
    );
  }
}
