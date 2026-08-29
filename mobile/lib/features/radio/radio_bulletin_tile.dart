import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../models/models.dart';
import '../../state/radio_player_controller.dart';
import '../../widgets/common.dart';

/// Đường kính nút play tròn ở mỗi dòng bản tin
const double _tilePlaySize = 44;

/// Một dòng bản tin trong danh sách Truyền thanh (WBS #17).
class RadioBulletinTile extends StatelessWidget {
  const RadioBulletinTile({
    super.key,
    required this.bulletin,
    required this.isCurrent,
    required this.isPlaying,
    required this.onTap,
  });

  final RadioBulletin bulletin;

  /// Bản tin này đang được nạp trong player
  final bool isCurrent;

  /// Bản tin này đang phát (isCurrent + playing)
  final bool isPlaying;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bg,
      borderRadius: BorderRadius.circular(AppDimens.radius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppDimens.radius),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppDimens.radius),
            border: Border.all(color: isCurrent ? AppColors.pink : AppColors.border),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Nút play tròn
              Container(
                width: _tilePlaySize,
                height: _tilePlaySize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isCurrent ? AppColors.tint(AppColors.pink, .12) : AppColors.tint(AppColors.navy, .08),
                  border: Border.all(color: isCurrent ? AppColors.pink : Colors.transparent, width: 1.5),
                ),
                child: Icon(
                  isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: isCurrent ? AppColors.pink : AppColors.navy,
                  size: 26,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bulletin.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.navy, fontSize: 13.5, fontWeight: FontWeight.w600, height: 1.4),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${bulletin.category} · ${formatRadioTime(bulletin.durationSeconds.toDouble())}'
                            ' · ${bulletin.plays} lượt nghe',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: AppColors.muted, fontSize: 12),
                          ),
                        ),
                        if (isPlaying) ...[
                          const SizedBox(width: 8),
                          const StatusChip(label: 'Đang phát', color: AppColors.pink, icon: Icons.graphic_eq),
                        ],
                      ],
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
