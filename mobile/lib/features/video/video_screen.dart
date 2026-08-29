import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../models/models.dart';
import '../../services/content_service.dart';
import '../../widgets/common.dart';

/// Nhãn chip lọc "tất cả chủ đề"
const String kAllTopics = 'Tất cả';

/// Số cột lưới video
const int kVideoGridColumns = 2;

/// Định dạng số theo locale VN: 3241 -> "3.241"
String formatViews(int n) {
  final s = n.toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
    buf.write(s[i]);
  }
  return buf.toString();
}

/// Thumbnail video 16:9 dùng chung lưới + màn chi tiết
class VideoThumb extends StatelessWidget {
  const VideoThumb({super.key, required this.video, this.playIconSize = 40, this.showDuration = true});

  final VideoItem video;
  final double playIconSize;
  final bool showDuration;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppDimens.radiusSm),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [video.coverColor, Color.lerp(video.coverColor, Colors.black, .3)!],
          ),
        ),
        child: Stack(
          children: [
            Center(
              child: Icon(Icons.play_circle_fill,
                  size: playIconSize, color: Colors.white.withValues(alpha: .9)),
            ),
            if (showDuration)
              Positioned(
                right: 6,
                bottom: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: .55),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text(video.duration,
                      style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w600)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Màn Video tuyên truyền (WBS #18).
/// Nguồn: `GET /content/public/videos` — chuyên mục lọc rút ra từ chính dữ liệu tải về.
class VideoScreen extends StatefulWidget {
  const VideoScreen({super.key});

  @override
  State<VideoScreen> createState() => _VideoScreenState();
}

class _VideoScreenState extends State<VideoScreen> {
  String _topic = kAllTopics;
  Future<List<VideoItem>>? _future;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<List<VideoItem>> _fetch({bool refresh = false}) =>
      context.read<ContentService>().videos(refresh: refresh);

  void _load({bool refresh = false}) => setState(() => _future = _fetch(refresh: refresh));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Video tuyên truyền')),
      body: AsyncBuilder<List<VideoItem>>(
        future: _future,
        onRetry: _load,
        builder: (context, all) {
          final topics = distinctLabels(all.map((v) => v.topic));
          // Chuyên mục đang chọn không còn trong dữ liệu mới → quay về "Tất cả"
          final topic = topics.contains(_topic) ? _topic : kAllTopics;
          final videos =
              topic == kAllTopics ? all : all.where((v) => v.topic == topic).toList();

          return Column(
            children: [
              SizedBox(
                height: 50,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppDimens.pagePadding, vertical: 7),
                  children: [
                    for (final t in [kAllTopics, ...topics])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(t),
                          selected: topic == t,
                          onSelected: (_) => setState(() => _topic = t),
                          labelStyle: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: topic == t ? Colors.white : AppColors.text,
                          ),
                          showCheckmark: false,
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => _load(refresh: true),
                  color: AppColors.navy,
                  child: videos.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(height: MediaQuery.of(context).size.height * .15),
                            const EmptyState(
                              icon: Icons.video_library_outlined,
                              message: 'Chưa có video trong chủ đề này',
                            ),
                          ],
                        )
                      : GridView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(AppDimens.pagePadding),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: kVideoGridColumns,
                            crossAxisSpacing: AppDimens.gap,
                            mainAxisSpacing: 16,
                            childAspectRatio: .78,
                          ),
                          itemCount: videos.length,
                          itemBuilder: (context, i) {
                            final v = videos[i];
                            return GestureDetector(
                              onTap: () => context.push('/video/${v.id}'),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  VideoThumb(video: v),
                                  const SizedBox(height: 8),
                                  Text(v.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: AppColors.navy,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          height: 1.35)),
                                  const SizedBox(height: 4),
                                  Text('${v.topic} · ${formatViews(v.views)} lượt xem',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: AppColors.muted, fontSize: 11.5)),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
