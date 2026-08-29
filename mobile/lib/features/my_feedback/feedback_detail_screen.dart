import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/categories.dart';
import '../../config/theme.dart';
import '../../models/models.dart';
import '../../services/api_client.dart';
import '../../state/feedback_store.dart';
import '../../widgets/common.dart';

// ===== Hằng số màn chi tiết phiếu phản ánh (task P2-14, WBS #14) =====
const String _kTitle = 'Chi tiết phản ánh';
const String _kDescriptionHeader = 'Mô tả';
const String _kImagesHeader = 'Ảnh hiện trường';
const String _kNoImages = 'Không đính kèm ảnh';
const String _kLocationHeader = 'Vị trí';
const String _kTimelineHeader = 'Tiến trình xử lý';
const String _kRatingHeader = 'Đánh giá';
const String _kRatingThanks = 'Cảm ơn bạn đã đánh giá';
const String _kRatingPrompt = 'Bạn hài lòng với kết quả xử lý chứ?';
const String _kRatingHint = 'Nhận xét của bạn (không bắt buộc)';
const String _kRatingSubmit = 'Gửi đánh giá';
const String _kRatingNeedStar = 'Vui lòng chọn số sao trước khi gửi';
const String _kRatingSent = 'Đã gửi đánh giá. Cảm ơn bạn!';
const String _kProcessingNote = 'Bạn sẽ nhận thông báo khi phản ánh được xử lý xong';
const double _kImageSize = 84;

/// Chi tiết một phiếu phản ánh — header, mô tả, ảnh, vị trí, timeline, đánh giá.
/// Dữ liệu lấy từ `/feedback/citizen/mine/:code` (mã phiếu chứa '#' nên được encode).
class FeedbackDetailScreen extends StatefulWidget {
  const FeedbackDetailScreen({super.key, required this.code});

  final String code;

  @override
  State<FeedbackDetailScreen> createState() => _FeedbackDetailScreenState();
}

class _FeedbackDetailScreenState extends State<FeedbackDetailScreen> {
  Future<FeedbackTicket>? _future;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<FeedbackTicket> _fetch() => context.read<FeedbackStore>().detail(widget.code);

  void _load() => setState(() => _future = _fetch());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(_kTitle)),
      body: AsyncBuilder<FeedbackTicket>(
        future: _future,
        onRetry: _load,
        builder: (context, ticket) => RefreshIndicator(
          onRefresh: () async => _load(),
          color: AppColors.navy,
          // Sau khi đánh giá, dùng luôn phiếu backend vừa trả về — khỏi gọi lại API
          child: _Content(
            ticket: ticket,
            onRated: (rated) => setState(() => _future = Future.value(rated)),
          ),
        ),
      ),
    );
  }
}

/// Thân màn chi tiết — giữ nguyên bố cục đã dựng, chỉ đổi nguồn dữ liệu.
class _Content extends StatelessWidget {
  const _Content({required this.ticket, required this.onRated});

  final FeedbackTicket ticket;

  /// Nhận phiếu đã cập nhật sau khi gửi đánh giá (timeline có thêm mốc đánh giá)
  final ValueChanged<FeedbackTicket> onRated;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppDimens.pagePadding),
      children: [
        _Header(ticket: ticket),
        const SizedBox(height: AppDimens.gap),
        _Block(
          title: _kDescriptionHeader,
          child: Text(ticket.description, style: Theme.of(context).textTheme.bodyMedium),
        ),
        const SizedBox(height: AppDimens.gap),
        _Block(
          title: _kImagesHeader,
          child: ticket.imageColors.isEmpty
              ? const Text(_kNoImages, style: TextStyle(color: AppColors.muted, fontSize: 13))
              : _MockImageRow(colors: ticket.imageColors),
        ),
        const SizedBox(height: AppDimens.gap),
        _Block(
          title: _kLocationHeader,
          child: Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 18, color: AppColors.red),
              const SizedBox(width: 8),
              Expanded(
                child: Text(ticket.location, style: Theme.of(context).textTheme.bodyMedium),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const SectionHeader(title: _kTimelineHeader),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: VgTimeline(steps: ticket.timeline),
          ),
        ),
        if (ticket.status == TicketStatus.resolved) ...[
          const SizedBox(height: 20),
          const SectionHeader(title: _kRatingHeader),
          ticket.rating > 0
              ? _RatingDone(ticket: ticket)
              : _RatingForm(code: ticket.code, onRated: onRated),
        ],
        if (ticket.status == TicketStatus.processing) ...[
          const SizedBox(height: AppDimens.gap),
          const _ProcessingNote(),
        ],
        const SizedBox(height: AppDimens.pagePadding),
      ],
    );
  }
}

/// Header: chip danh mục + trạng thái, mã phiếu, tiêu đề lớn, thời điểm gửi.
class _Header extends StatelessWidget {
  const _Header({required this.ticket});

  final FeedbackTicket ticket;

  @override
  Widget build(BuildContext context) {
    final category = categoryOf(ticket.categoryKey);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                StatusChip(label: category.label, color: category.color, icon: category.icon),
                const SizedBox(width: 8),
                StatusChip(
                  label: ticket.status.label,
                  color: ticketStatusColor(ticket.status),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(ticket.code,
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(ticket.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text('Gửi lúc ${ticket.sentAt}',
                style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
          ],
        ),
      ),
    );
  }
}

/// Khối nội dung có tiêu đề nhỏ trong card.
class _Block extends StatelessWidget {
  const _Block({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            child,
          ],
        ),
      ),
    );
  }
}

/// Ảnh hiện trường mock — Phase 1 dùng Container màu placeholder.
class _MockImageRow extends StatelessWidget {
  const _MockImageRow({required this.colors});

  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < colors.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Container(
              width: _kImageSize,
              height: _kImageSize,
              decoration: BoxDecoration(
                color: colors[i],
                borderRadius: BorderRadius.circular(AppDimens.radiusSm),
              ),
              child: Icon(Icons.image_outlined,
                  size: 26, color: Colors.white.withValues(alpha: .65)),
            ),
          ],
        ],
      ),
    );
  }
}

/// Phiếu đã được công dân đánh giá — hiển thị sao + nhận xét.
class _RatingDone extends StatelessWidget {
  const _RatingDone({required this.ticket});

  final FeedbackTicket ticket;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StarRow(value: ticket.rating, size: 22),
            if (ticket.ratingComment != null) ...[
              const SizedBox(height: 8),
              Text(ticket.ratingComment!, style: Theme.of(context).textTheme.bodyMedium),
            ],
            const SizedBox(height: 8),
            Row(
              children: const [
                Icon(Icons.check_circle_outline, size: 15, color: AppColors.green),
                SizedBox(width: 5),
                Text(_kRatingThanks,
                    style: TextStyle(
                        color: AppColors.green, fontSize: 12.5, fontWeight: FontWeight.w600)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Form đánh giá cho phiếu đã xử lý nhưng chưa được chấm sao.
class _RatingForm extends StatefulWidget {
  const _RatingForm({required this.code, required this.onRated});

  final String code;
  final ValueChanged<FeedbackTicket> onRated;

  @override
  State<_RatingForm> createState() => _RatingFormState();
}

class _RatingFormState extends State<_RatingForm> {
  int _stars = 0;
  bool _sending = false;
  final _commentCtrl = TextEditingController();

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_stars == 0) {
      showAppSnack(context, _kRatingNeedStar);
      return;
    }
    setState(() => _sending = true);

    final FeedbackTicket rated;
    try {
      rated = await context.read<FeedbackStore>().rate(
            widget.code,
            _stars,
            _commentCtrl.text.trim(),
          );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      // Ví dụ: phiếu chưa xử lý xong → backend trả 409 kèm thông báo tiếng Việt
      showAppSnack(context, e.message);
      return;
    }
    if (!mounted) return;
    setState(() => _sending = false);
    showAppSnack(context, _kRatingSent);
    widget.onRated(rated);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(_kRatingPrompt,
                style: TextStyle(color: AppColors.text, fontSize: 13.5)),
            const SizedBox(height: 10),
            Center(
              child: StarRow(
                value: _stars,
                size: 34,
                onChanged: (v) => setState(() => _stars = v),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _commentCtrl,
              maxLines: 3,
              decoration: const InputDecoration(hintText: _kRatingHint),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _sending ? null : _submit,
              child: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    )
                  : const Text(_kRatingSubmit),
            ),
          ],
        ),
      ),
    );
  }
}

/// Ghi chú cho phiếu đang xử lý — P3 (WBS #23) thay bằng push FCM thật.
class _ProcessingNote extends StatelessWidget {
  const _ProcessingNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.tint(AppColors.blue, .08),
        borderRadius: BorderRadius.circular(AppDimens.radiusSm),
      ),
      child: Row(
        children: const [
          Icon(Icons.notifications_active_outlined, size: 17, color: AppColors.blue),
          SizedBox(width: 8),
          Expanded(
            child: Text(_kProcessingNote,
                style: TextStyle(color: AppColors.blue, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}
