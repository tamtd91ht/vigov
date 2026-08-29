import 'package:flutter/material.dart';
import '../../config/categories.dart';
import '../../config/theme.dart';

/// BƯỚC 1 — chọn 1/12 danh mục phản ánh (lưới 3 cột), kèm note SLA của danh mục đã chọn.
class CategoryStep extends StatelessWidget {
  const CategoryStep({super.key, required this.selected, required this.onSelect});

  final FeedbackCategory? selected;
  final ValueChanged<FeedbackCategory> onSelect;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppDimens.pagePadding),
      children: [
        Text('Sự việc thuộc lĩnh vực nào?', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          'Chọn đúng danh mục giúp phản ánh được phân loại và xử lý nhanh hơn.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 14),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: .92,
          ),
          itemCount: feedbackCategories.length,
          itemBuilder: (context, i) {
            final cat = feedbackCategories[i];
            return _CategoryCell(
              category: cat,
              selected: cat.key == selected?.key,
              onTap: () => onSelect(cat),
            );
          },
        ),
        if (selected != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.tint(selected!.color, .08),
              borderRadius: BorderRadius.circular(AppDimens.radiusSm),
              border: Border.all(color: AppColors.tint(selected!.color, .30)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.schedule, size: 17, color: selected!.color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Cam kết SLA · ${selected!.label}: ${selected!.slaText}',
                    style: TextStyle(color: selected!.color, fontSize: 12.5, fontWeight: FontWeight.w600, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _CategoryCell extends StatelessWidget {
  const _CategoryCell({required this.category, required this.selected, required this.onTap});

  final FeedbackCategory category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppDimens.radius),
      child: Stack(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.bg,
              borderRadius: BorderRadius.circular(AppDimens.radius),
              border: Border.all(
                color: selected ? category.color : AppColors.border,
                width: selected ? 1.6 : 1,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(color: AppColors.tint(category.color, .12), shape: BoxShape.circle),
                  child: Icon(category.icon, size: 21, color: category.color),
                ),
                const SizedBox(height: 8),
                Text(
                  category.label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11.5,
                    height: 1.25,
                    fontWeight: FontWeight.w600,
                    color: AppColors.navy,
                  ),
                ),
              ],
            ),
          ),
          if (selected)
            Positioned(
              top: 6,
              right: 6,
              child: Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(color: category.color, shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded, size: 11, color: Colors.white),
              ),
            ),
        ],
      ),
    );
  }
}
