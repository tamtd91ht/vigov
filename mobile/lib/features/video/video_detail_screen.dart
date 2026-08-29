import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../models/models.dart';
import '../../services/content_service.dart';
import '../../widgets/common.dart';
import 'video_screen.dart' show VideoThumb, formatViews;

/// Số video liên quan hiển thị cuối màn
const int kRelatedVideoCount = 3;

/// Video đang xem + danh sách video cùng chuyên mục
typedef VideoDetailData = ({VideoItem video, List<VideoItem> related});

/// Màn phát video (WBS #18) — trình phát mock.
/// Nguồn video thật (nhúng YouTube hay tự host) chờ khách chốt — câu hỏi mở #19.
class VideoDetailScreen extends StatefulWidget {
  const VideoDetailScreen({super.key, required this.id});

  final String id;

  @override
  State<VideoDetailScreen> createState() => _VideoDetailScreenState();
}

class _VideoDetailScreenState extends State<VideoDetailScreen> {
  bool _playing = false;
  Future<VideoDetailData>? _future;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  /// Video lấy từ danh sách đã tải (backend chưa có endpoint chi tiết video)
  Future<VideoDetailData> _fetch() async {
    final content = context.read<ContentService>();
    final video = await content.videoDetail(widget.id);
    final related = await content.relatedVideos(video, kRelatedVideoCount);
    return (video: video, related: related);
  }

  void _load() => setState(() => _future = _fetch());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Video tuyên truyền')),
      body: AsyncBuilder<VideoDetailData>(
        future: _future,
        onRetry: _load,
        builder: (context, data) => _body(context, data.video, data.related),
      ),
    );
  }

  Widget _body(BuildContext context, VideoItem video, List<VideoItem> related) {
    return ListView(
        padding: EdgeInsets.zero,
        children: [
          _MockPlayer(video: video, playing: _playing, onToggle: () => setState(() => _playing = !_playing)),
          Padding(
            padding: const EdgeInsets.all(AppDimens.pagePadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(video.title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                Row(
                  children: [
                    StatusChip(label: video.topic, color: video.coverColor),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('${formatViews(video.views)} lượt xem · ${video.publishedAt}',
                          style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
                    ),
                  ],
                ),
                // Schema CMS chưa có trường mô tả video → ẩn khối khi backend trả rỗng
                if (video.description.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Text(video.description,
                      textAlign: TextAlign.justify,
                      style: const TextStyle(color: AppColors.text, fontSize: 14, height: 1.7)),
                ],
                if (related.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  const Divider(),
                  const SizedBox(height: 16),
                  const SectionHeader(title: 'Video liên quan'),
                  for (final v in related)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppDimens.gap),
                      child: GestureDetector(
                        onTap: () => context.pushReplacement('/video/${v.id}'),
                        child: Row(
                          children: [
                            SizedBox(width: 124, child: VideoThumb(video: v, playIconSize: 26)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(v.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: AppColors.navy,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          height: 1.35)),
                                  const SizedBox(height: 4),
                                  Text('${formatViews(v.views)} lượt xem',
                                      style: const TextStyle(color: AppColors.muted, fontSize: 11.5)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ],
    );
  }
}

/// Khối phát mock 16:9 — trình phát thật gắn ở giai đoạn tích hợp ngoài
class _MockPlayer extends StatelessWidget {
  const _MockPlayer({required this.video, required this.playing, required this.onToggle});

  final VideoItem video;
  final bool playing;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Container(
        color: Colors.black,
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      video.coverColor.withValues(alpha: .55),
                      Colors.black.withValues(alpha: .85),
                    ],
                  ),
                ),
              ),
            ),
            Center(
              child: GestureDetector(
                onTap: onToggle,
                child: Container(
                  width: 68,
                  height: 68,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: .92),
                  ),
                  child: Icon(playing ? Icons.pause : Icons.play_arrow,
                      size: 38, color: AppColors.navy),
                ),
              ),
            ),
            Positioned(
              left: 12,
              right: 12,
              bottom: 10,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LinearProgressIndicator(
                    value: playing ? .35 : 0,
                    minHeight: 3,
                    backgroundColor: Colors.white24,
                    valueColor: const AlwaysStoppedAnimation(AppColors.pink),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Bản demo — trình phát thật (YouTube hoặc tự host) chờ khách chốt',
                    style: TextStyle(color: Colors.white.withValues(alpha: .75), fontSize: 10.5),
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
