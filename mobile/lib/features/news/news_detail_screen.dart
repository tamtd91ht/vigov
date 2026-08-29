import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../models/models.dart';
import '../../services/content_service.dart';
import '../../widgets/common.dart';
import 'news_screen.dart' show formatNumber, kArticleTypeIcons;

/// Màu nhãn theo loại bài viết
const Map<ArticleType, Color> kArticleTypeColors = {
  ArticleType.news: AppColors.blue,
  ArticleType.event: AppColors.pink,
  ArticleType.notice: AppColors.orange,
};

/// Số bài liên quan hiển thị cuối bài
const int kRelatedArticleCount = 3;

/// Bài viết + danh sách tin liên quan tải kèm trong một lần
typedef ArticleDetailData = ({Article article, List<Article> related});

/// Chi tiết bài viết Tin tức – Sự kiện – Thông báo (WBS #16).
/// Nguồn: `GET /content/public/articles/:id` — backend tự tăng lượt xem mỗi lần mở.
class NewsDetailScreen extends StatefulWidget {
  const NewsDetailScreen({super.key, required this.id});

  final String id;

  @override
  State<NewsDetailScreen> createState() => _NewsDetailScreenState();
}

class _NewsDetailScreenState extends State<NewsDetailScreen> {
  Future<ArticleDetailData>? _future;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  /// Tải chi tiết bài viết rồi lấy tiếp danh sách tin cùng loại
  Future<ArticleDetailData> _fetch() async {
    final content = context.read<ContentService>();
    final article = await content.articleDetail(widget.id);
    final related = await content.relatedArticles(article, kRelatedArticleCount);
    return (article: article, related: related);
  }

  void _load() => setState(() => _future = _fetch());

  @override
  Widget build(BuildContext context) {
    // Bài viết dùng SliverAppBar riêng nên trạng thái chờ/lỗi cần AppBar thường
    // để công dân vẫn quay lại được.
    return FutureBuilder<ArticleDetailData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          final data = snapshot.data!;
          return _ArticleBody(article: data.article, related: data.related);
        }
        return Scaffold(
          appBar: AppBar(title: const Text('Bài viết')),
          body: snapshot.hasError
              ? ErrorState(message: describeError(snapshot.error), onRetry: _load)
              : const LoadingState(),
        );
      },
    );
  }
}

/// Thân bài viết — giữ nguyên bố cục SliverAppBar đã dựng
class _ArticleBody extends StatelessWidget {
  const _ArticleBody({required this.article, required this.related});

  final Article article;
  final List<Article> related;

  @override
  Widget build(BuildContext context) {
    final typeColor = kArticleTypeColors[article.type]!;
    final paragraphs = article.content.split('\n\n');

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 200,
            pinned: true,
            backgroundColor: article.coverColor,
            foregroundColor: Colors.white,
            actions: [
              IconButton(
                icon: const Icon(Icons.share_outlined),
                tooltip: 'Chia sẻ',
                onPressed: () =>
                    showAppSnack(context, 'Chia sẻ bài viết sẽ bổ sung cùng tích hợp ngoài'),
              ),
            ],
            flexibleSpace: LayoutBuilder(
              builder: (context, constraints) {
                final topPadding = MediaQuery.of(context).padding.top;
                final collapsed = constraints.maxHeight <= kToolbarHeight + topPadding + 12;
                return FlexibleSpaceBar(
                  centerTitle: false,
                  titlePadding: const EdgeInsetsDirectional.only(start: 54, bottom: 15, end: 60),
                  title: collapsed
                      ? Text(
                          article.category,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                        )
                      : null,
                  background: Container(
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
                          right: -18,
                          bottom: -22,
                          child: Icon(
                            kArticleTypeIcons[article.type],
                            size: 150,
                            color: Colors.white.withValues(alpha: .18),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppDimens.pagePadding, 18, AppDimens.pagePadding, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusChip(
                    label: article.type.label,
                    color: typeColor,
                    icon: kArticleTypeIcons[article.type],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    article.title,
                    style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 21,
                        fontWeight: FontWeight.w700,
                        height: 1.35),
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
                  const SizedBox(height: 14),
                  const Divider(),
                  const SizedBox(height: 14),
                  for (final paragraph in paragraphs)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Text(
                        paragraph,
                        textAlign: TextAlign.justify,
                        style: const TextStyle(
                            color: AppColors.text, fontSize: 14.5, height: 1.75),
                      ),
                    ),
                  if (related.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    const SectionHeader(title: 'Tin liên quan'),
                    for (final other in related)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppDimens.gap),
                        child: _RelatedRow(article: other),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bài cùng loại — hàng ngang thumbnail nhỏ, mở thay thế màn hiện tại
class _RelatedRow extends StatelessWidget {
  const _RelatedRow({required this.article});

  final Article article;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.pushReplacement('/news/${article.id}'),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: article.coverColor,
                  borderRadius: BorderRadius.circular(AppDimens.radiusSm),
                ),
                child: Icon(
                  kArticleTypeIcons[article.type],
                  size: 24,
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
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          height: 1.35),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${article.category} · ${article.publishedAt}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
