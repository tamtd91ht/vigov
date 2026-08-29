import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../config/categories.dart';
import '../../config/quick_actions.dart';
import '../../config/theme.dart';
import '../../models/models.dart';
import '../../services/content_service.dart';
import '../../state/feedback_store.dart';
import '../../state/session_controller.dart';
import '../../widgets/common.dart';

/// Số bài viết hiển thị ở khối "Tin tức mới" trên Trang chủ.
const int kHomeNewsCount = 3;

/// Trang chủ công dân (WBS #12) — header chào, 6 ô truy cập nhanh,
/// phiếu phản ánh mới nhất và tin tức mới. Bottom nav do AppShell đảm nhiệm.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  /// Đổi khoá để dựng lại khối tin tức khi công dân kéo-để-tải-lại
  int _newsEpoch = 0;

  @override
  void initState() {
    super.initState();
    // Tải phiếu phản ánh sau khung hình đầu để không notifyListeners giữa lúc build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<FeedbackStore>().ensureLoaded();
    });
  }

  Future<void> _refresh() async {
    setState(() => _newsEpoch += 1);
    await context.read<FeedbackStore>().load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg2,
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: AppColors.navy,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            const _HomeHeader(),
            Padding(
              padding: const EdgeInsets.all(AppDimens.pagePadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _QuickActionGrid(),
                  const SizedBox(height: AppDimens.gap * 2),
                  SectionHeader(
                      title: 'Phản ánh của tôi', onSeeAll: () => context.go('/my-feedback')),
                  const _LatestTicketCard(),
                  const SizedBox(height: AppDimens.gap * 2),
                  SectionHeader(title: 'Tin tức mới', onSeeAll: () => context.go('/news')),
                  _HomeNewsList(key: ValueKey(_newsEpoch)),
                  const SizedBox(height: AppDimens.gap),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Lời chào theo buổi trong ngày.
String _greetingByTime(DateTime now) {
  final h = now.hour;
  if (h >= 5 && h < 12) return 'Chào buổi sáng';
  if (h >= 12 && h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

/// Header navy bo tròn đáy: chào theo buổi + tên công dân + đơn vị + chuông thông báo.
class _HomeHeader extends StatelessWidget {
  const _HomeHeader();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>().session;
    final name = session?.displayName ?? 'Công dân';

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.navy,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(AppDimens.pagePadding, 14, 10, 20),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_greetingByTime(DateTime.now())},',
                      style: TextStyle(color: Colors.white.withValues(alpha: .75), fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${AppConfig.orgName} · ${AppConfig.orgParent}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white.withValues(alpha: .62), fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Chuông thông báo — trung tâm thông báo kết nối ở giai đoạn backend (P3)
              Material(
                color: Colors.white.withValues(alpha: .12),
                shape: const CircleBorder(),
                child: IconButton(
                  onPressed: () =>
                      showAppSnack(context, 'Trung tâm thông báo kết nối ở giai đoạn backend'),
                  icon: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 22),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Lưới 6 ô truy cập nhanh — cấu hình tập trung tại config/quick_actions.dart.
class _QuickActionGrid extends StatelessWidget {
  const _QuickActionGrid();

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AppDimens.gap,
      crossAxisSpacing: AppDimens.gap,
      childAspectRatio: 1.08,
      children: [for (final a in homeQuickActions) _QuickActionTile(action: a)],
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({required this.action});

  final QuickAction action;

  void _open(BuildContext context) {
    // '/news' là tab trong shell → go; các màn còn lại là trang đẩy chồng → push
    if (action.route == '/news') {
      context.go(action.route);
    } else {
      context.push(action.route);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppDimens.radius),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: () => _open(context),
        borderRadius: BorderRadius.circular(AppDimens.radius),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 46,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.tint(action.color, .12),
                shape: BoxShape.circle,
              ),
              child: Icon(action.icon, size: 23, color: action.color),
            ),
            const SizedBox(height: 8),
            Text(
              action.label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.text, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

/// Card phiếu phản ánh MỚI NHẤT của công dân; đang tải → spinner, lỗi → nút thử lại.
class _LatestTicketCard extends StatelessWidget {
  const _LatestTicketCard();

  @override
  Widget build(BuildContext context) {
    final store = context.watch<FeedbackStore>();
    final tickets = store.tickets;

    if (tickets.isEmpty) {
      if (store.loading) {
        return const Card(child: LoadingState());
      }
      if (store.error != null) {
        return Card(child: ErrorState(message: store.error!, onRetry: store.load));
      }
      return const Card(
        child: EmptyState(
          icon: Icons.campaign_outlined,
          message: 'Bạn chưa gửi phản ánh nào.\nChạm "Gửi phản ánh" để bắt đầu.',
        ),
      );
    }

    final t = tickets.first;
    final cat = categoryOf(t.categoryKey);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        // Mã phiếu chứa ký tự '#' → phải encode khi ghép vào path
        onTap: () => context.push('/my-feedback/${Uri.encodeComponent(t.code)}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.tint(cat.color, .12),
                      borderRadius: BorderRadius.circular(AppDimens.radiusSm),
                    ),
                    child: Icon(cat.icon, size: 22, color: cat.color),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${t.code} · ${cat.label}',
                          style: const TextStyle(
                              color: AppColors.muted, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          t.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: AppColors.navy, fontSize: 14, fontWeight: FontWeight.w600, height: 1.35),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 20, color: AppColors.muted),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  StatusChip(label: t.status.label, color: ticketStatusColor(t.status)),
                  const SizedBox(width: 8),
                  // Nhãn SLA chỉ hiển thị khi phiếu đang xử lý (WBS #14)
                  if (t.status == TicketStatus.processing)
                    StatusChip(
                      label: t.slaHoursLeft < 0
                          ? 'Quá hạn ${-t.slaHoursLeft} giờ'
                          : 'Còn ${t.slaHoursLeft} giờ xử lý',
                      color: t.slaHoursLeft < 0 ? AppColors.red : AppColors.orange,
                      icon: Icons.timer_outlined,
                    ),
                  const Spacer(),
                  Flexible(
                    child: Text(
                      t.sentAt,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.muted, fontSize: 11.5),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Danh sách 3 bài viết mới nhất — nguồn: `GET /content/public/articles`
class _HomeNewsList extends StatefulWidget {
  const _HomeNewsList({super.key});

  @override
  State<_HomeNewsList> createState() => _HomeNewsListState();
}

class _HomeNewsListState extends State<_HomeNewsList> {
  Future<List<Article>>? _future;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<List<Article>> _fetch() =>
      context.read<ContentService>().latestArticles(kHomeNewsCount);

  void _load() => setState(() => _future = _fetch());

  @override
  Widget build(BuildContext context) {
    return AsyncBuilder<List<Article>>(
      future: _future,
      onRetry: _load,
      builder: (context, articles) {
        if (articles.isEmpty) {
          return const Card(
            child: EmptyState(icon: Icons.article_outlined, message: 'Chưa có bài viết nào.'),
          );
        }
        return Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < articles.length; i++) ...[
                if (i > 0) const Divider(),
                _HomeNewsRow(article: articles[i]),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _HomeNewsRow extends StatelessWidget {
  const _HomeNewsRow({required this.article});

  final Article article;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/news/${article.id}'),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Thumbnail mock bằng màu coverColor — ảnh thật lấy từ CMS (P3)
            Container(
              width: 54,
              height: 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.tint(article.coverColor, .16),
                borderRadius: BorderRadius.circular(AppDimens.radiusSm),
              ),
              child: Icon(Icons.article_outlined, size: 22, color: article.coverColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    article.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: AppColors.navy, fontSize: 13.5, fontWeight: FontWeight.w600, height: 1.35),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${article.category} · ${article.publishedAt}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.muted),
          ],
        ),
      ),
    );
  }
}
