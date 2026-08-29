import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vigov_mobile/models/models.dart';
import 'package:vigov_mobile/state/radio_player_controller.dart';

RadioBulletin _bulletin({String id = 'b1', int seconds = 180}) => RadioBulletin(
      id: id,
      title: 'Bản tin sáng $id',
      category: 'Thời sự',
      date: '20/08/2026',
      durationSeconds: seconds,
      plays: 10,
    );

void main() {
  late RadioPlayerController c;

  setUp(() => c = RadioPlayerController());
  tearDown(() => c.dispose());

  group('trạng thái ban đầu', () {
    test('chưa có bản tin nào', () {
      expect(c.bulletin, isNull);
      expect(c.active, isFalse);
      expect(c.playing, isFalse);
      expect(c.position, 0);
      expect(c.speed, 1.0);
      expect(c.duration, 0);
      expect(c.progress, 0, reason: 'duration == 0 phải tránh chia cho 0');
    });
  });

  group('play', () {
    test('nạp bản tin, bật phát và báo cho listener', () {
      var notified = 0;
      c.addListener(() => notified++);

      c.play(_bulletin());

      expect(c.active, isTrue);
      expect(c.bulletin!.id, 'b1');
      expect(c.playing, isTrue);
      expect(c.position, 0);
      expect(c.duration, 180);
      expect(notified, 1);

      c.stop();
    });

    test('play lại cùng bản tin giữ nguyên vị trí đang nghe', () {
      c.play(_bulletin());
      c.seek(45);
      c.toggle(); // tạm dừng
      expect(c.playing, isFalse);

      c.play(_bulletin());
      expect(c.position, 45, reason: 'cùng id thì không tua về đầu');
      expect(c.playing, isTrue);

      c.stop();
    });

    test('play bản tin khác đặt lại vị trí về 0', () {
      c.play(_bulletin(id: 'b1'));
      c.seek(45);

      c.play(_bulletin(id: 'b2', seconds: 60));
      expect(c.bulletin!.id, 'b2');
      expect(c.position, 0);
      expect(c.duration, 60);

      c.stop();
    });
  });

  group('toggle', () {
    test('không làm gì khi chưa chọn bản tin', () {
      var notified = 0;
      c.addListener(() => notified++);

      c.toggle();

      expect(c.playing, isFalse);
      expect(notified, 0, reason: 'toggle rỗng không được báo thay đổi');
    });

    test('đảo trạng thái phát/dừng và giữ nguyên vị trí', () {
      c.play(_bulletin());
      c.seek(30);

      c.toggle();
      expect(c.playing, isFalse);
      expect(c.position, 30);

      c.toggle();
      expect(c.playing, isTrue);
      expect(c.position, 30);

      c.stop();
    });
  });

  group('seek', () {
    test('không làm gì khi chưa chọn bản tin', () {
      c.seek(30);
      expect(c.position, 0);
    });

    test('đặt vị trí và kẹp trong [0, duration]', () {
      c.play(_bulletin(seconds: 180));
      c.toggle(); // dừng ticker cho phép đo chính xác

      c.seek(42.5);
      expect(c.position, 42.5);

      c.seek(-100);
      expect(c.position, 0);

      c.seek(9999);
      expect(c.position, 180);

      c.seek(180);
      expect(c.position, 180);
    });

    test('progress = position / duration, kẹp trong [0, 1]', () {
      c.play(_bulletin(seconds: 200));
      c.toggle();

      c.seek(50);
      expect(c.progress, 0.25);

      c.seek(200);
      expect(c.progress, 1);
    });
  });

  group('skip', () {
    test('tua tiến/lùi đúng bước và kẹp ở cả hai đầu', () {
      c.play(_bulletin(seconds: 100));
      c.toggle();

      c.seek(50);
      c.skip(radioSkipSeconds);
      expect(c.position, 65);

      c.skip(-radioSkipSeconds);
      expect(c.position, 50);

      // Kẹp đầu dưới
      c.seek(5);
      c.skip(-radioSkipSeconds);
      expect(c.position, 0);

      // Kẹp đầu trên
      c.seek(95);
      c.skip(radioSkipSeconds);
      expect(c.position, 100);
    });

    test('bước tua chuẩn là 15 giây', () {
      expect(radioSkipSeconds, 15);
    });
  });

  group('cycleSpeed', () {
    test('xoay vòng 1 → 1.5 → 2 → 1', () {
      expect(c.speed, 1.0);
      c.cycleSpeed();
      expect(c.speed, 1.5);
      c.cycleSpeed();
      expect(c.speed, 2.0);
      c.cycleSpeed();
      expect(c.speed, 1.0);
    });

    test('bảng tốc độ khả dụng đúng cấu hình WBS #17', () {
      expect(radioPlaybackSpeeds, [1.0, 1.5, 2.0]);
    });

    test('đổi tốc độ được khi chưa chọn bản tin và có báo listener', () {
      var notified = 0;
      c.addListener(() => notified++);
      c.cycleSpeed();
      expect(c.speed, 1.5);
      expect(notified, 1);
    });
  });

  group('stop', () {
    test('xoá bản tin và đưa mọi thứ về mặc định (trừ tốc độ)', () {
      c.play(_bulletin());
      c.seek(30);
      c.cycleSpeed();

      c.stop();

      expect(c.bulletin, isNull);
      expect(c.active, isFalse);
      expect(c.playing, isFalse);
      expect(c.position, 0);
      expect(c.speed, 1.5, reason: 'stop không đặt lại tốc độ đã chọn');
    });
  });

  group('ticker giả lập', () {
    testWidgets('vị trí tăng theo tốc độ phát', (tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      final ctrl = RadioPlayerController();
      addTearDown(ctrl.dispose);

      ctrl.play(_bulletin(seconds: 180));
      await tester.pump(const Duration(seconds: 1));
      expect(ctrl.position, closeTo(1.0, 0.001));

      ctrl.cycleSpeed(); // 1.5x
      await tester.pump(const Duration(seconds: 1));
      expect(ctrl.position, closeTo(2.5, 0.001));

      ctrl.stop();
      await tester.pump();
    });

    testWidgets('tự dừng khi chạy hết bản tin', (tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      final ctrl = RadioPlayerController();
      addTearDown(ctrl.dispose);

      ctrl.play(_bulletin(seconds: 2));
      await tester.pump(const Duration(seconds: 3));

      expect(ctrl.position, 2);
      expect(ctrl.playing, isFalse);
      expect(ctrl.progress, 1);
    });
  });

  group('formatRadioTime', () {
    test('định dạng mm:ss có đệm số 0', () {
      expect(formatRadioTime(0), '00:00');
      expect(formatRadioTime(5), '00:05');
      expect(formatRadioTime(59), '00:59');
      expect(formatRadioTime(60), '01:00');
      expect(formatRadioTime(65), '01:05');
      expect(formatRadioTime(605), '10:05');
    });

    test('làm tròn phần giây lẻ', () {
      expect(formatRadioTime(59.6), '01:00');
      expect(formatRadioTime(59.4), '00:59');
      expect(formatRadioTime(0.5), '00:01');
    });

    test('quá 60 phút vẫn hiển thị theo phút (không có giờ)', () {
      expect(formatRadioTime(3600), '60:00');
      expect(formatRadioTime(3661), '61:01');
    });
  });
}
