import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/categories.dart';
import '../../config/theme.dart';
import '../../models/models.dart';
import '../../state/feedback_store.dart';
import '../../widgets/common.dart';

// ===== Hằng số màn "Phản ánh của tôi" (task P2-14, WBS #14) =====
const String _kTitle = 'Phản ánh của tôi';
const String _kFilterAll = 'Tất cả';
const String _kEmptyMessage = 'Không có phiếu phản ánh nào\ntrong mục này';
const String _kDetailRoutePrefix = '/my-feedback/';
const double _kCategoryIconBox = 42;

/// Màn tab "Phản ánh của tôi" — danh sách phiếu + lọc theo trạng thái.
class MyFeedbackScreen extends StatefulWidget {
  const MyFeedbackScreen({super.key});

  @override
  State<MyFeedbackScreen> createState() => _MyFeedbackScreenState();
}

class _MyFeedbackScreenState extends State<MyFeedbackScreen> {
  /// null = Tất cả
  TicketStatus? _filter;

  @override
  void initState() {
    super.initState();
    // Tải sau khung hình đầu để không notifyListeners giữa lúc build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<FeedbackStore>().ensureLoaded();
    });
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<FeedbackStore>();
    final tickets = store.tickets;
    final filtered =
        _filter == null ? tickets : tickets.where((t) => t.status == _filter).toList();

    return Scaffold(
      appBar: AppBar(title: const Text(_kTitle)),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _FilterBar(
            tickets: tickets,
            selected: _filter,
            onChanged: (v) => setState(() => _filter = v),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: store.load,
              color: AppColors.navy,
              child: _body(store, filtered),
            ),
          ),
        ],
      ),
    );
  }

  /// Đang tải lần đầu → vòng quay; lỗi → thông báo + "Thử lại"; rỗng → EmptyState.
  /// Ba trạng thái đều bọc trong ListView để kéo-để-tải-lại vẫn dùng được.
  Widget _body(FeedbackStore store, List<FeedbackTicket> filtered) {
    if (store.loading && store.tickets.isEmpty) return const LoadingState();

    if (store.error != null && store.tickets.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * .18),
          ErrorState(message: store.error!, onRetry: store.load),
        ],
      );
    }

    if (filtered.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * .18),
          const EmptyState(icon: Icons.inbox_outlined, message: _kEmptyMessage),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
          AppDimens.pagePadding, 4, AppDimens.pagePadding, AppDimens.pagePadding),
      itemCount: filtered.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppDimens.gap),
      itemBuilder: (context, i) => _TicketCard(ticket: filtered[i]),
    );
  }
}

/// Hàng chip lọc trạng thái ngang, kèm số lượng phiếu từng nhóm.
class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.tickets, required this.selected, required this.onChanged});

  final List<FeedbackTicket> tickets;
  final TicketStatus? selected;
  final ValueChanged<TicketStatus?> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(AppDimens.pagePadding, 12, AppDimens.pagePadding, 12),
      child: Row(
        children: [
          _chip(label: _kFilterAll, count: tickets.length, value: null),
          for (final status in TicketStatus.values) ...[
            const SizedBox(width: 8),
            _chip(
              label: status.label,
              count: tickets.where((t) => t.status == status).length,
              value: status,
            ),
          ],
        ],
      ),
    );
  }

  Widget _chip({required String label, required int count, required TicketStatus? value}) {
    final active = selected == value;
    return ChoiceChip(
      label: Text('$label ($count)'),
      selected: active,
      showCheckmark: false,
      labelStyle: TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
        color: active ? Colors.white : AppColors.text,
      ),
      onSelected: (_) => onChanged(value),
    );
  }
}

/// Card một phiếu phản ánh trong danh sách.
class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});

  final FeedbackTicket ticket;

  @override
  Widget build(BuildContext context) {
    final category = categoryOf(ticket.categoryKey);

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppDimens.radius),
        onTap: () =>
            context.push('$_kDetailRoutePrefix${Uri.encodeComponent(ticket.code)}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: _kCategoryIconBox,
                height: _kCategoryIconBox,
                decoration: BoxDecoration(
                  color: AppColors.tint(category.color),
                  shape: BoxShape.circle,
                ),
                child: Icon(category.icon, size: 21, color: category.color),
              ),
              const SizedBox(width: AppDimens.gap),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            ticket.code,
                            style: const TextStyle(
                                color: AppColors.muted, fontSize: 11.5, fontWeight: FontWeight.w700),
                          ),
                        ),
                        StatusChip(
                          label: ticket.status.label,
                          color: ticketStatusColor(ticket.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      ticket.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.navy, fontWeight: FontWeight.w600, fontSize: 14, height: 1.35),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${ticket.sentAt} · ${ticket.location}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                    if (ticket.status == TicketStatus.processing) ...[
                      const SizedBox(height: 8),
                      _SlaLabel(hoursLeft: ticket.slaHoursLeft),
                    ],
                    if (ticket.status == TicketStatus.resolved && ticket.rating > 0) ...[
                      const SizedBox(height: 8),
                      StarRow(value: ticket.rating, size: 15),
                    ],
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

/// Nhãn SLA cho phiếu đang xử lý: quá hạn (đỏ) / còn hạn (cam).
class _SlaLabel extends StatelessWidget {
  const _SlaLabel({required this.hoursLeft});

  final int hoursLeft;

  @override
  Widget build(BuildContext context) {
    final overdue = hoursLeft < 0;
    final color = overdue ? AppColors.red : AppColors.orange;
    final label = overdue ? 'Quá hạn ${-hoursLeft}h' : 'Còn ${hoursLeft}h';

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(overdue ? Icons.warning_amber_rounded : Icons.schedule, size: 14, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
      ],
    );
  }
}
