import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../state/radio_player_controller.dart';

/// Bo góc card player lớn
const double _playerRadius = 16;

/// Đường kính nút play/pause trung tâm
const double _playButtonSize = 62;

/// Nhãn tốc độ "1x" / "1.5x" / "2x" — bỏ ".0" khi là số nguyên
String radioSpeedLabel(double speed) =>
    speed == speed.roundToDouble() ? '${speed.toInt()}x' : '${speed}x';

/// Khối player lớn đầu màn Truyền thanh (WBS #17).
/// Active → card navy đầy đủ điều khiển; chưa active → card gợi ý.
class RadioPlayerCard extends StatelessWidget {
  const RadioPlayerCard({super.key});

  @override
  Widget build(BuildContext context) {
    final player = context.watch<RadioPlayerController>();
    if (!player.active) return const _IdleHintCard();

    final bulletin = player.bulletin!;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      decoration: BoxDecoration(
        color: AppColors.navy,
        borderRadius: BorderRadius.circular(_playerRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Chuyên mục
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .14),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              bulletin.category,
              style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 10),
          // Tiêu đề bản tin
          Text(
            bulletin.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                color: Colors.white, fontSize: 15.5, fontWeight: FontWeight.w700, height: 1.35),
          ),
          const SizedBox(height: 6),
          // Slider tua theo thời gian
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 3.5,
              activeTrackColor: AppColors.pink,
              inactiveTrackColor: Colors.white.withValues(alpha: .22),
              thumbColor: AppColors.pink,
              overlayColor: AppColors.tint(AppColors.pink, .2),
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
            ),
            child: Slider(
              value: player.position.clamp(0, player.duration),
              max: player.duration,
              onChanged: player.seek,
            ),
          ),
          // Hàng thời gian
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _TimeText(formatRadioTime(player.position)),
                _TimeText(formatRadioTime(player.duration)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Hàng điều khiển
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _SkipButton(
                forward: false,
                onPressed: () => player.skip(-radioSkipSeconds),
              ),
              const SizedBox(width: 14),
              // Play/pause tròn lớn trắng
              GestureDetector(
                onTap: player.toggle,
                child: Container(
                  width: _playButtonSize,
                  height: _playButtonSize,
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                  child: Icon(
                    player.playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    color: AppColors.navy,
                    size: 36,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              _SkipButton(
                forward: true,
                onPressed: () => player.skip(radioSkipSeconds),
              ),
              const SizedBox(width: 10),
              // Tốc độ phát — chip trắng mờ
              GestureDetector(
                onTap: player.cycleSpeed,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    radioSpeedLabel(player.speed),
                    style: const TextStyle(
                        color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TimeText extends StatelessWidget {
  const _TimeText(this.value);

  final String value;

  @override
  Widget build(BuildContext context) {
    return Text(
      value,
      style: TextStyle(color: Colors.white.withValues(alpha: .75), fontSize: 12, fontWeight: FontWeight.w600),
    );
  }
}

/// Card gợi ý khi chưa chọn bản tin
class _IdleHintCard extends StatelessWidget {
  const _IdleHintCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.tint(AppColors.navy, .06),
        borderRadius: BorderRadius.circular(_playerRadius),
        border: Border.all(color: AppColors.border),
      ),
      child: const Row(
        children: [
          Icon(Icons.radio_outlined, color: AppColors.navy, size: 32),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Chọn một bản tin để nghe',
              style: TextStyle(color: AppColors.navy, fontSize: 14, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Nút tua ±15 giây — Material không có sẵn icon replay_15/forward_15
/// nên ghép icon mũi tên vòng với số giây từ [radioSkipSeconds].
class _SkipButton extends StatelessWidget {
  const _SkipButton({required this.forward, required this.onPressed});

  final bool forward;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      tooltip: '${forward ? 'Tiến' : 'Lùi'} $radioSkipSeconds giây',
      icon: SizedBox(
        width: 32,
        height: 32,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Transform.scale(
              scaleX: forward ? -1 : 1,
              child: const Icon(Icons.refresh_rounded, color: Colors.white, size: 31),
            ),
            Text(
              '$radioSkipSeconds',
              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}
