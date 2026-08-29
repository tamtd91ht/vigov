import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../models/models.dart';
import '../../services/content_service.dart';
import '../../state/radio_player_controller.dart';
import '../../widgets/common.dart';
import 'radio_bulletin_tile.dart';
import 'radio_player_card.dart';

/// Nhãn chip lọc "tất cả chuyên mục"
const String kAllCategories = 'Tất cả';

/// Màn Truyền thanh phường (WBS #17) — player giữ phát khi chuyển màn
/// nhờ RadioPlayerController toàn app + thanh phát thu nhỏ ở khung ứng dụng.
class RadioScreen extends StatefulWidget {
  const RadioScreen({super.key});

  @override
  State<RadioScreen> createState() => _RadioScreenState();
}

class _RadioScreenState extends State<RadioScreen> {
  String _category = kAllCategories;
  Future<List<RadioBulletin>>? _future;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<List<RadioBulletin>> _fetch({bool refresh = false}) =>
      context.read<ContentService>().radio(refresh: refresh);

  void _load({bool refresh = false}) => setState(() => _future = _fetch(refresh: refresh));

  /// Nhóm bản tin theo ngày, giữ nguyên thứ tự backend trả về (mới nhất trước)
  Map<String, List<RadioBulletin>> _groupByDate(List<RadioBulletin> items) {
    final map = <String, List<RadioBulletin>>{};
    for (final b in items) {
      map.putIfAbsent(b.date, () => []).add(b);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Truyền thanh phường')),
      body: AsyncBuilder<List<RadioBulletin>>(
        future: _future,
        onRetry: _load,
        builder: (context, all) => RefreshIndicator(
          onRefresh: () async => _load(refresh: true),
          color: AppColors.navy,
          child: _list(context, all),
        ),
      ),
    );
  }

  Widget _list(BuildContext context, List<RadioBulletin> all) {
    final player = context.watch<RadioPlayerController>();
    // Chuyên mục lọc rút ra từ chính dữ liệu backend đang phát hành
    final categories = distinctLabels(all.map((b) => b.category));
    final category = categories.contains(_category) ? _category : kAllCategories;
    final filtered =
        category == kAllCategories ? all : all.where((b) => b.category == category).toList();
    final grouped = _groupByDate(filtered);
    final latestDate = all.isEmpty ? '' : all.first.date;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
          AppDimens.pagePadding, AppDimens.pagePadding, AppDimens.pagePadding, 28),
      children: [
        const RadioPlayerCard(),
        const SizedBox(height: 18),
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final c in [kAllCategories, ...categories])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(c),
                    selected: category == c,
                    onSelected: (_) => setState(() => _category = c),
                    labelStyle: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: category == c ? Colors.white : AppColors.text,
                    ),
                    showCheckmark: false,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (grouped.isEmpty)
          const EmptyState(
              icon: Icons.radio_outlined, message: 'Chưa có bản tin trong chuyên mục này')
        else
          for (final entry in grouped.entries) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                entry.key == latestDate ? 'Hôm nay · ${entry.key}' : entry.key,
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            for (final b in entry.value)
              Padding(
                padding: const EdgeInsets.only(bottom: AppDimens.gap),
                child: RadioBulletinTile(
                  bulletin: b,
                  isCurrent: player.bulletin?.id == b.id,
                  isPlaying: player.bulletin?.id == b.id && player.playing,
                  onTap: () {
                    if (player.bulletin?.id == b.id) {
                      player.toggle();
                    } else {
                      player.play(b);
                    }
                  },
                ),
              ),
            const SizedBox(height: 8),
          ],
        const SizedBox(height: 6),
        const Row(
          children: [
            Icon(Icons.info_outline, size: 15, color: AppColors.muted),
            SizedBox(width: 7),
            Expanded(
              child: Text(
                'Giữ phát khi chuyển màn — bản tin tiếp tục ở thanh phát thu nhỏ.',
                style: TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
