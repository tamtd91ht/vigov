import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/models.dart';
import '../services/api_client.dart';

/// Tiêu đề khối nội dung + hành động "Xem tất cả"
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.onSeeAll});

  final String title;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
          if (onSeeAll != null)
            GestureDetector(
              onTap: onSeeAll,
              child: const Text('Xem tất cả',
                  style: TextStyle(color: AppColors.blue, fontSize: 13, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}

/// Chip trạng thái/nhãn màu
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
      decoration: BoxDecoration(color: AppColors.tint(color, .12), borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 13, color: color), const SizedBox(width: 4)],
          Text(label, style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

Color ticketStatusColor(TicketStatus status) => switch (status) {
      TicketStatus.received => AppColors.muted,
      TicketStatus.processing => AppColors.blue,
      TicketStatus.resolved => AppColors.green,
    };

/// Timeline dọc (dùng chung Phản ánh của tôi + Tra cứu hồ sơ — WBS #14/#15)
class VgTimeline extends StatelessWidget {
  const VgTimeline({super.key, required this.steps});

  final List<TimelineStep> steps;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < steps.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 22,
                  child: Column(
                    children: [
                      Container(
                        width: 11,
                        height: 11,
                        margin: const EdgeInsets.only(top: 4),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                          border: Border.all(
                            color: steps[i].current ? AppColors.orange : AppColors.green,
                            width: 2.5,
                          ),
                          boxShadow: steps[i].current
                              ? [BoxShadow(color: AppColors.tint(AppColors.orange, .25), spreadRadius: 3)]
                              : null,
                        ),
                      ),
                      if (i < steps.length - 1)
                        const Expanded(child: VerticalDivider(width: 2, thickness: 2, color: AppColors.border)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: i < steps.length - 1 ? 16 : 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(steps[i].title,
                            style: const TextStyle(
                                color: AppColors.navy, fontWeight: FontWeight.w600, fontSize: 13.5)),
                        const SizedBox(height: 2),
                        Text(steps[i].meta, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Trạng thái rỗng
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: AppColors.muted),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, fontSize: 13.5)),
          ],
        ),
      ),
    );
  }
}

/// Trạng thái lỗi kèm nút thử lại — dùng chung cho mọi màn đọc dữ liệu từ API
class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 44, color: AppColors.muted),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.text, fontSize: 13.5, height: 1.5),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: 160,
              child: OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Thử lại'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Vòng quay chờ căn giữa — dùng khi màn đang tải dữ liệu lần đầu
class LoadingState extends StatelessWidget {
  const LoadingState({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(36),
        child: CircularProgressIndicator(color: AppColors.navy),
      ),
    );
  }
}

/// Bọc một [Future] thành 3 trạng thái chuẩn: đang tải → lỗi (kèm "Thử lại") → nội dung.
/// Giữ nội dung cũ khi tải lại để danh sách không nháy trắng.
class AsyncBuilder<T> extends StatelessWidget {
  const AsyncBuilder({
    super.key,
    required this.future,
    required this.onRetry,
    required this.builder,
  });

  final Future<T>? future;
  final VoidCallback onRetry;
  final Widget Function(BuildContext context, T data) builder;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
          return const LoadingState();
        }
        if (snapshot.hasError && !snapshot.hasData) {
          return ErrorState(message: describeError(snapshot.error), onRetry: onRetry);
        }
        final data = snapshot.data;
        if (data == null) return const LoadingState();
        return builder(context, data);
      },
    );
  }
}

/// Thông báo tiếng Việt cho một lỗi bất kỳ — ApiException đã mang sẵn thông báo.
String describeError(Object? error) {
  if (error is ApiException) return error.message;
  return kDefaultErrorMessage;
}

/// Hiển thị sao đánh giá
class StarRow extends StatelessWidget {
  const StarRow({super.key, required this.value, this.size = 16, this.onChanged});

  final int value;
  final double size;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 1; i <= 5; i++)
          GestureDetector(
            onTap: onChanged == null ? null : () => onChanged!(i),
            child: Icon(
              i <= value ? Icons.star_rounded : Icons.star_outline_rounded,
              size: size,
              color: i <= value ? AppColors.orange : AppColors.border,
            ),
          ),
      ],
    );
  }
}

/// SnackBar chuẩn toàn app
void showAppSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
