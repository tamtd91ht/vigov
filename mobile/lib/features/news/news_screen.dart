import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../models/models.dart';
import '../../services/content_service.dart';
import '../../widgets/common.dart';

/// Icon đại diện theo loại bài viết — dùng chung với màn chi tiết.
const Map<ArticleType, IconData> kArticleTypeIcons = {
  ArticleType.news: Icons.article_rounded,
  ArticleType.event: Icons.event_rounded,
  ArticleType.notice: Icons.campaign_rounded,
};

/// Định dạng số có dấu chấm ngăn cách hàng nghìn (1284 → 1.284)
String formatNumber(int n) =>
    n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => '.');

/// Tin tức – Sự kiện – Thông báo của xã (WBS #16)
class NewsScreen extends StatelessWidget {
  const NewsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: ArticleType.values.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Tin tức xã'),
          bottom: TabBar(
            indicatorColor: AppColors.pink,
            indicatorWeight: 2.5,
            labelColor: AppColors.navy,
            unselectedLabelColor: AppColors.muted,
            labelStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
            unselectedLabelStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
            tabs: [for (final type in ArticleType.values) Tab(text: type.label)],
          ),
        ),
        body: TabBarView(
          children: [for (final type in ArticleType.values) _ArticleList(type: type)],
        ),
      ),
    );
  }
}

/// Danh sách bài viết theo loại — bài đầu dạng featured, các bài sau dạng hàng ngang.
/// Nguồn: `GET /content/public/articles?type=` (không cần token).
class _ArticleList extends StatefulWidget {
  const _ArticleList({required this.type});

  final ArticleType type;

  @override
  State<_ArticleList> createState() => _ArticleListState();
}

class _ArticleListState extends State<_ArticleList>
    with AutomaticKeepAliveClientMixin<_ArticleList> {
  Future<List<Article>>? _future;

  // Giữ state khi chuyển tab để không gọi lại API mỗi lần vuốt qua lại
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<List<Article>> _fetch({bool refresh = false}) =>
      context.read<ContentService>().articles(widget.type, refresh: refresh);

  void _load({bool refresh = false}) => setState(() => _future = _fetch(refresh: refresh));

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return AsyncBuilder<List<Article>>(
      future: _future,
      onRetry: _load,
      builder: (context, articles) => RefreshIndicator(
        onRefresh: () async => _load(refresh: true),
        color: AppColors.navy,
        child: articles.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * .15),
                  EmptyState(
                    icon: kArticleTypeIcons[widget.type]!,
                    message: 'Chưa có bài viết nào trong mục ${widget.type.label}',
                  ),
                ],
              )
            : ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(AppDimens.pagePadding),
                itemCount: articles.length,
                separatorBuilder: (_, _) => const SizedBox(height: AppDimens.gap),
                itemBuilder: (context, index) {
                  final article = articles[index];
                  return index == 0
                      ? _FeaturedCard(article: article)
                      : _ArticleRow(article: article);
                },
              ),
      ),
    );
  }
}

/// Bài nổi bật đầu danh sách — cover gradient lớn + tiêu đề + excerpt
class _FeaturedCard extends StatelessWidget {
  const _FeaturedCard({required this.article});

  final Article article;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/news/${article.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 160,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    article.coverColor,
                    Color.lerp(article.coverColor, Colors.black, .25)!,
                  ],
                ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    right: -14,
                    bottom: -18,
                    child: Icon(
                      kArticleTypeIcons[article.type],
                      size: 120,
                      color: Colors.white.withValues(alpha: .18),
                    ),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .22),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        article.category,
                        style: const TextStyle(
                            color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    article.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 16.5,
                        fontWeight: FontWeight.w700,
                        height: 1.35),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    article.excerpt,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Text('${article.publishedAt} · ',
                          style: Theme.of(context).textTheme.bodySmall),
                      const Icon(Icons.visibility_outlined, size: 13, color: AppColors.muted),
                      const SizedBox(width: 3),
                      Text('${formatNumber(article.views)} lượt xem',
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bài viết dạng hàng ngang — thumbnail vuông màu cover + icon loại
class _ArticleRow extends StatelessWidget {
  const _ArticleRow({required this.article});

  final Article article;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/news/${article.id}'),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: article.coverColor,
                  borderRadius: BorderRadius.circular(AppDimens.radiusSm),
                ),
                child: Icon(
                  kArticleTypeIcons[article.type],
                  size: 30,
                  color: Colors.white.withValues(alpha: .85),
                ),
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
                          color: AppColors.navy,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          height: 1.35),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${article.category} · ${article.publishedAt}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
