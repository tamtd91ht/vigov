import 'package:flutter/material.dart';

import '../../config/categories.dart';
import '../../config/theme.dart';
import '../../widgets/common.dart';

/// BƯỚC 3 — xác nhận nội dung trước khi gửi (WBS #13).
class ConfirmStep extends StatelessWidget {
  const ConfirmStep({
    super.key,
    required this.category,
    required this.title,
    required this.description,
    required this.imageColors,
    required this.address,
  });

  final FeedbackCategory category;
  final String title;
  final String description;
  final List<Color> imageColors;
  final String address;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Kiểm tra lại thông tin', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        const Text(
          'Phản ánh sau khi gửi sẽ được chuyển tới bộ phận chuyên môn xử lý.',
          style: TextStyle(color: AppColors.muted, fontSize: 13),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StatusChip(label: category.label, color: category.color, icon: category.icon),
                const SizedBox(height: 12),
                _Row(label: 'Tiêu đề', value: title),
                _Row(label: 'Nội dung', value: description, maxLines: 4),
                _Row(label: 'Địa chỉ', value: address),
                _Row(
                  label: 'Ảnh đính kèm',
                  value: imageColors.isEmpty ? 'Không có ảnh' : '${imageColors.length} ảnh',
                ),
                if (imageColors.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      for (final c in imageColors) ...[
                        Container(
                          width: 52,
                          height: 52,
                          margin: const EdgeInsets.only(right: 8),
                          decoration: BoxDecoration(
                            color: c,
                            borderRadius: BorderRadius.circular(AppDimens.radiusSm),
                          ),
                          child: Icon(Icons.image_outlined,
                              size: 20, color: Colors.white.withValues(alpha: .7)),
                        ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: AppDimens.gap),
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: AppColors.tint(AppColors.green, .08),
            borderRadius: BorderRadius.circular(AppDimens.radius),
            border: Border.all(color: AppColors.tint(AppColors.green, .28)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.schedule, size: 18, color: AppColors.green),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Cam kết thời hạn xử lý',
                        style: TextStyle(
                            color: AppColors.green, fontSize: 12.5, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 3),
                    Text(category.slaText,
                        style: const TextStyle(color: AppColors.text, fontSize: 12.5, height: 1.45)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.maxLines = 2});

  final String label;
  final String value;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: const TextStyle(
                  color: AppColors.muted, fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: .4)),
          const SizedBox(height: 3),
          Text(value,
              maxLines: maxLines,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.text, fontSize: 13.5, height: 1.45)),
        ],
      ),
    );
  }
}
