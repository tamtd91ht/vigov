import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import 'dossier_step_tracker.dart';

/// Card kết quả tra cứu: thông tin hồ sơ + tracker 4 bước (WBS #15).
class DossierResultCard extends StatelessWidget {
  const DossierResultCard({super.key, required this.result});

  final DossierResult result;

  @override
  Widget build(BuildContext context) {
    final finished = result.currentStep >= result.steps.length;
    final statusColor = finished ? AppColors.green : AppColors.blue;
    final statusLabel = finished ? result.statusLabel : 'Đang xử lý';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppDimens.pagePadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    result.code,
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: .2,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                StatusChip(
                  label: statusLabel,
                  color: statusColor,
                  icon: finished ? Icons.check_circle_rounded : Icons.autorenew_rounded,
                ),
              ],
            ),
            const SizedBox(height: AppDimens.gap),
            _InfoRow(label: 'Thủ tục', value: result.procedure),
            _InfoRow(label: 'Người nộp', value: result.applicant),
            _InfoRow(label: 'Cán bộ phụ trách', value: result.officer),
            _InfoRow(label: 'Ngày nộp', value: result.submittedAt),
            _InfoRow(label: 'Hẹn trả', value: result.expectedAt),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppDimens.gap),
              child: Divider(),
            ),
            const Text(
              'Tiến độ xử lý',
              style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: 13.5),
            ),
            const SizedBox(height: 14),
            DossierStepTracker(steps: result.steps, currentStep: result.currentStep),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(color: AppColors.text, fontSize: 13.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
