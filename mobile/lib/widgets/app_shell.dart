import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../state/radio_player_controller.dart';

/// Tab bottom nav — cấu hình tập trung
class _NavTab {
  const _NavTab(this.label, this.icon, this.activeIcon, this.route);

  final String label;
  final IconData icon;
  final IconData activeIcon;
  final String route;
}

const List<_NavTab> _tabs = [
  _NavTab('Trang chủ', Icons.home_outlined, Icons.home, '/'),
  _NavTab('Phản ánh', Icons.forum_outlined, Icons.forum, '/my-feedback'),
  _NavTab('Tin tức', Icons.article_outlined, Icons.article, '/news'),
  _NavTab('Cá nhân', Icons.person_outline, Icons.person, '/profile'),
];

/// Khung app: bottom nav 4 tab + nút "Gửi phản ánh" nổi ở giữa + mini player truyền thanh.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});

  final Widget child;

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    for (var i = _tabs.length - 1; i >= 0; i--) {
      final r = _tabs[i].route;
      if (r == '/' ? location == '/' : location.startsWith(r)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final index = _currentIndex(context);
    return Scaffold(
      body: Column(
        children: [
          Expanded(child: child),
          const RadioMiniPlayer(),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/send-feedback'),
        backgroundColor: AppColors.pink,
        foregroundColor: Colors.white,
        tooltip: 'Gửi phản ánh',
        child: const Icon(Icons.campaign_outlined, size: 26),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        color: Colors.white,
        elevation: 8,
        padding: EdgeInsets.zero,
        shape: const CircularNotchedRectangle(),
        notchMargin: 7,
        child: SizedBox(
          height: 62,
          child: Row(
            children: [
              _tabButton(context, 0, index),
              _tabButton(context, 1, index),
              const SizedBox(width: 64), // chừa chỗ FAB
              _tabButton(context, 2, index),
              _tabButton(context, 3, index),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tabButton(BuildContext context, int i, int current) {
    final tab = _tabs[i];
    final active = i == current;
    final color = active ? AppColors.navy : AppColors.muted;
    return Expanded(
      child: InkWell(
        onTap: () => context.go(tab.route),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(active ? tab.activeIcon : tab.icon, size: 23, color: color),
            const SizedBox(height: 3),
            Text(tab.label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }
}

/// Mini player truyền thanh — hiển thị trên mọi tab khi đang có bản tin (WBS #17: giữ phát khi chuyển màn)
class RadioMiniPlayer extends StatelessWidget {
  const RadioMiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final player = context.watch<RadioPlayerController>();
    if (!player.active) return const SizedBox.shrink();
    final b = player.bulletin!;
    return Material(
      color: AppColors.navy,
      child: InkWell(
        onTap: () => context.push('/radio'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            children: [
              IconButton(
                onPressed: player.toggle,
                icon: Icon(player.playing ? Icons.pause_circle : Icons.play_circle, color: Colors.white, size: 32),
                padding: EdgeInsets.zero,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(b.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    LinearProgressIndicator(
                      value: player.progress,
                      minHeight: 3,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation(AppColors.pink),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text('${formatRadioTime(player.position)} / ${formatRadioTime(player.duration)}',
                  style: const TextStyle(color: Colors.white70, fontSize: 11)),
              IconButton(
                onPressed: player.stop,
                icon: const Icon(Icons.close, color: Colors.white54, size: 18),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
