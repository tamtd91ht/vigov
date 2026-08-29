import 'package:flutter/material.dart';
import '../../config/theme.dart';

/// Thanh tiến trình 3 bước tự dựng (WBS #13) — chấm tròn + nhãn,
/// màu pink cho bước hiện tại, check cho bước đã xong.
class StepProgress extends StatelessWidget {
  const StepProgress({super.key, required this.current, required this.labels});

  /// 0-based, 0..labels.length-1
  final int current;
  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Container(
                  height: 2,
                  color: i <= current ? AppColors.pink : AppColors.border,
                ),
              ),
            ),
          _StepDot(index: i, label: labels[i], current: current),
        ],
      ],
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.index, required this.label, required this.current});

  final int index;
  final String label;
  final int current;

  @override
  Widget build(BuildContext context) {
    final done = index < current;
    final active = index == current;
    final Color fill = done || active ? AppColors.pink : AppColors.bg;
    final Color border = done || active ? AppColors.pink : AppColors.border;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: fill,
            border: Border.all(color: border, width: 1.6),
            boxShadow: active ? [BoxShadow(color: AppColors.tint(AppColors.pink, .25), spreadRadius: 3)] : null,
          ),
          alignment: Alignment.center,
          child: done
              ? const Icon(Icons.check_rounded, size: 15, color: Colors.white)
              : Text(
                  '${index + 1}',
                  style: TextStyle(
                    color: active ? Colors.white : AppColors.muted,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: active ? AppColors.pink : (done ? AppColors.navy : AppColors.muted),
          ),
        ),
      ],
    );
  }
}
