import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/models.dart';

/// Tốc độ phát khả dụng (WBS #17) — cấu hình tập trung.
const List<double> radioPlaybackSpeeds = [1.0, 1.5, 2.0];

/// Bước tua nhanh/lùi (giây)
const int radioSkipSeconds = 15;

/// Trình phát truyền thanh toàn app — GIẢ LẬP bằng ticker (Phase 1).
/// Tích hợp ngoài (15%): thay ticker bằng just_audio, giữ nguyên API controller.
class RadioPlayerController extends ChangeNotifier {
  RadioBulletin? _bulletin;
  bool _playing = false;
  double _position = 0; // giây
  double _speed = 1.0;
  Timer? _ticker;

  RadioBulletin? get bulletin => _bulletin;
  bool get playing => _playing;
  double get position => _position;
  double get speed => _speed;
  bool get active => _bulletin != null;
  double get duration => (_bulletin?.durationSeconds ?? 0).toDouble();
  double get progress => duration == 0 ? 0 : (_position / duration).clamp(0, 1);

  void play(RadioBulletin bulletin) {
    if (_bulletin?.id != bulletin.id) {
      _bulletin = bulletin;
      _position = 0;
    }
    _playing = true;
    _startTicker();
    notifyListeners();
  }

  void toggle() {
    if (_bulletin == null) return;
    _playing = !_playing;
    _playing ? _startTicker() : _stopTicker();
    notifyListeners();
  }

  void seek(double seconds) {
    if (_bulletin == null) return;
    _position = seconds.clamp(0, duration);
    notifyListeners();
  }

  void skip(int seconds) => seek(_position + seconds);

  void cycleSpeed() {
    final i = radioPlaybackSpeeds.indexOf(_speed);
    _speed = radioPlaybackSpeeds[(i + 1) % radioPlaybackSpeeds.length];
    notifyListeners();
  }

  void stop() {
    _stopTicker();
    _bulletin = null;
    _playing = false;
    _position = 0;
    notifyListeners();
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 500), (_) {
      _position += 0.5 * _speed;
      if (_position >= duration) {
        _position = duration;
        _playing = false;
        _stopTicker();
      }
      notifyListeners();
    });
  }

  void _stopTicker() {
    _ticker?.cancel();
    _ticker = null;
  }

  @override
  void dispose() {
    _stopTicker();
    super.dispose();
  }
}

/// "mm:ss" từ số giây
String formatRadioTime(double seconds) {
  final s = seconds.round();
  final m = (s ~/ 60).toString().padLeft(2, '0');
  final r = (s % 60).toString().padLeft(2, '0');
  return '$m:$r';
}
