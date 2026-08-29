import 'package:flutter/material.dart';

import '../../config/theme.dart';

const double _kDotSize = 26;
const double _kLineThickness = 2.5;

/// Tracker ngang 4 bước xử lý hồ sơ một cửa (WBS #15).
/// Bước đã qua = xanh check, bước hiện tại = cam (vòng pulse bằng boxShadow),
/// bước chưa tới = xám.
class DossierStepTracker extends StatelessWidget {
  const DossierStepTracker({super.key, required this.steps, required this.currentStep});

  final List<String> steps;

  /// 1-based, 1..steps.length
  final int currentStep;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++)
          Expanded(child: _StepItem(
            label: steps[i],
            index: i,
            total: steps.length,
            currentStep: currentStep,
          )),
      ],
    );
  }
}

class _StepItem extends StatelessWidget {
  const _StepItem({
    required this.label,
    required this.index,
    required this.total,
    required this.currentStep,
  });

  final String label;
  final int index;
  final int total;
  final int currentStep;

  @override
  Widget build(BuildContext context) {
    final stepNo = index + 1; // 1-based
    final done = stepNo < currentStep;
    final current = stepNo == currentStep;

    // Vạch nối bên trái/phải chấm: xanh khi đoạn đường đã đi qua.
    final leftDone = stepNo <= currentStep;
    final rightDone = stepNo < currentStep;

    return Column(
      children: [
        SizedBox(
          height: _kDotSize + 8,
          child: Row(
            children: [
              Expanded(
                child: index == 0
                    ? const SizedBox.shrink()
                    : Container(
                        height: _kLineThickness,
                        color: leftDone ? AppColors.green : AppColors.border,
                      ),
              ),
              _StepDot(done: done, current: current, stepNo: stepNo),
              Expanded(
                child: index == total - 1
                    ? const SizedBox.shrink()
                    : Container(
                        height: _kLineThickness,
                        color: rightDone ? AppColors.green : AppColors.border,
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10.5,
              height: 1.25,
              fontWeight: current ? FontWeight.w700 : FontWeight.w500,
              color: current
                  ? AppColors.orange
                  : done
                      ? AppColors.navy
                      : AppColors.muted,
            ),
          ),
        ),
      ],
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.done, required this.current, required this.stepNo});

  final bool done;
  final bool current;
  final int stepNo;

  @override
  Widget build(BuildContext context) {
    final Color fill;
    final Color border;
    if (done) {
      fill = AppColors.green;
      border = AppColors.green;
    } else if (current) {
      fill = AppColors.orange;
      border = AppColors.orange;
    } else {
      fill = AppColors.bg;
      border = AppColors.border;
    }

    return Container(
      width: _kDotSize,
      height: _kDotSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: fill,
        border: Border.all(color: border, width: 2),
        // Vòng "pulse" quanh bước đang xử lý
        boxShadow: current
            ? [
                BoxShadow(color: AppColors.tint(AppColors.orange, .30), spreadRadius: 4),
                BoxShadow(color: AppColors.tint(AppColors.orange, .15), spreadRadius: 8),
              ]
            : null,
      ),
      child: done
          ? const Icon(Icons.check_rounded, size: 15, color: Colors.white)
          : Text(
              '$stepNo',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: current ? Colors.white : AppColors.muted,
              ),
            ),
    );
  }
}
