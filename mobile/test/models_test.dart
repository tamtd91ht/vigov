import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vigov_mobile/config/theme.dart';
import 'package:vigov_mobile/models/models.dart';

void main() {
  group('asInt', () {
    test('trả nguyên vẹn giá trị int', () {
      expect(asInt(42), 42);
      expect(asInt(0), 0);
      expect(asInt(-7), -7);
    });

    test('làm tròn double — slaHoursLeft 71.5 → 72', () {
      // Backend tính SLA theo giờ thực nên có thể trả 71.5; num.round() làm tròn
      // nửa ra xa số 0.
      expect(asInt(71.5), 72);
      expect(asInt(71.4), 71);
      expect(asInt(71.6), 72);
      expect(asInt(-0.5), -1);
      expect(asInt(2.5), 3);
    });

    test('phân tích chuỗi số, ngược lại dùng fallback', () {
      expect(asInt('12'), 12);
      expect(asInt('-3'), -3);
      expect(asInt('abc'), 0);
      expect(asInt('abc', 9), 9);
      // '12.5' không phải int hợp lệ → int.tryParse trả null
      expect(asInt('12.5'), 0);
    });

    test('null / kiểu lạ → fallback', () {
      expect(asInt(null), 0);
      expect(asInt(null, 5), 5);
      expect(asInt(true), 0);
      expect(asInt(<int>[1], 8), 8);
    });
  });

  group('asString', () {
    test('null → fallback, ngược lại nội suy chuỗi', () {
      expect(asString(null), '');
      expect(asString(null, 'x'), 'x');
      expect(asString('abc'), 'abc');
      expect(asString(7), '7');
    });
  });

  group('colorFromToken', () {
    test('biến CSS var(--blue) → AppColors.blue', () {
      expect(colorFromToken('var(--blue)'), AppColors.blue);
    });

    test('ánh xạ đủ 9 token trong bảng màu ViGov', () {
      expect(colorFromToken('var(--navy)'), AppColors.navy);
      expect(colorFromToken('var(--blue)'), AppColors.blue);
      expect(colorFromToken('var(--pink)'), AppColors.pink);
      expect(colorFromToken('var(--green)'), AppColors.green);
      expect(colorFromToken('var(--orange)'), AppColors.orange);
      expect(colorFromToken('var(--purple)'), AppColors.purple);
      expect(colorFromToken('var(--red)'), AppColors.red);
      expect(colorFromToken('var(--teal)'), AppColors.teal);
      expect(colorFromToken('var(--slate)'), AppColors.slate);
    });

    test('chấp nhận token trần và có khoảng trắng thừa', () {
      expect(colorFromToken('--green'), AppColors.green);
      expect(colorFromToken('  var(--teal)  '), AppColors.teal);
      expect(colorFromToken('teal'), AppColors.teal);
    });

    test('mã hex #RRGGBB được gán alpha đầy đủ', () {
      expect(colorFromToken('#E91E8C'), const Color(0xFFE91E8C));
      expect(colorFromToken('#000000'), const Color(0xFF000000));
    });

    test('mã hex 8 ký tự giữ nguyên alpha', () {
      expect(colorFromToken('#80FF0000'), const Color(0x80FF0000));
    });

    test('rỗng / null / token lạ → fallback (mặc định blue)', () {
      expect(colorFromToken(null), AppColors.blue);
      expect(colorFromToken(''), AppColors.blue);
      expect(colorFromToken('   '), AppColors.blue);
      expect(colorFromToken('var(--khong-co)'), AppColors.blue);
      expect(colorFromToken('#zzzzzz'), AppColors.blue);
    });

    test('fallback tuỳ biến được tôn trọng', () {
      expect(colorFromToken(null, AppColors.red), AppColors.red);
      expect(colorFromToken('var(--khong-co)', AppColors.navy), AppColors.navy);
      // Regex chỉ nhận chữ thường → token viết hoa rơi về fallback
      expect(colorFromToken('var(--BLUE)', AppColors.navy), AppColors.navy);
    });
  });

  group('ticketStatusFromApi', () {
    test('ánh xạ đủ các chuỗi backend trả về', () {
      expect(ticketStatusFromApi('received'), TicketStatus.received);
      expect(ticketStatusFromApi('processing'), TicketStatus.processing);
      expect(ticketStatusFromApi('resolved'), TicketStatus.resolved);
    });

    test('chuỗi lạ / null / rỗng → received', () {
      expect(ticketStatusFromApi(null), TicketStatus.received);
      expect(ticketStatusFromApi(''), TicketStatus.received);
      expect(ticketStatusFromApi('RESOLVED'), TicketStatus.received);
      expect(ticketStatusFromApi('closed'), TicketStatus.received);
      expect(ticketStatusFromApi(123), TicketStatus.received);
    });

    test('nhãn tiếng Việt của từng trạng thái', () {
      expect(TicketStatus.received.label, 'Mới tiếp nhận');
      expect(TicketStatus.processing.label, 'Đang xử lý');
      expect(TicketStatus.resolved.label, 'Đã xử lý');
    });
  });

  group('asItems', () {
    test('bóc mảng items của phản hồi phân trang', () {
      final items = asItems(<String, dynamic>{
        'items': [
          <String, dynamic>{'a': 1},
          'rác',
          <String, dynamic>{'b': 2},
        ],
        'total': 2,
      });
      expect(items, hasLength(2));
      expect(items.first['a'], 1);
    });

    test('thiếu items hoặc items không phải List → rỗng', () {
      expect(asItems(<String, dynamic>{}), isEmpty);
      expect(asItems(<String, dynamic>{'items': null}), isEmpty);
      expect(asItems(<String, dynamic>{'items': 'x'}), isEmpty);
    });
  });

  group('TimelineStep.fromJson', () {
    test("state == 'cur' đánh dấu bước hiện tại", () {
      final step = TimelineStep.fromJson(<String, dynamic>{
        'title': 'Đang xử lý',
        'meta': '10/08/2026',
        'state': 'cur',
      });
      expect(step.title, 'Đang xử lý');
      expect(step.meta, '10/08/2026');
      expect(step.current, isTrue);
    });

    test("state khác 'cur' (hoặc thiếu) → không phải bước hiện tại", () {
      expect(TimelineStep.fromJson(<String, dynamic>{'state': 'ok'}).current, isFalse);
      expect(TimelineStep.fromJson(<String, dynamic>{}).current, isFalse);
      expect(TimelineStep.fromJson(<String, dynamic>{}).title, '');
    });
  });

  group('FeedbackTicket.fromJson', () {
    test('phân tích đầy đủ một phiếu từ /feedback/citizen/mine', () {
      final ticket = FeedbackTicket.fromJson(<String, dynamic>{
        'code': '#PA-2026-0142',
        'categoryKey': 'rac-thai',
        'title': 'Rác ứ đọng đầu ngõ 12',
        'description': 'Rác chất đống nhiều ngày, bốc mùi.',
        'location': 'Thôn Đông, Xã Đại Thắng',
        'sentAt': '20/08/2026 08:30',
        'status': 'processing',
        'slaHoursLeft': 71.5,
        'imageFileIds': ['f1', 'f2'],
        'timeline': [
          <String, dynamic>{'title': 'Gửi phản ánh', 'meta': '20/08/2026 08:30', 'state': 'ok'},
          <String, dynamic>{'title': 'Đang xử lý', 'meta': 'Tổ môi trường', 'state': 'cur'},
        ],
        'rating': 4,
        'ratingComment': 'Xử lý nhanh',
      });

      expect(ticket.code, '#PA-2026-0142');
      expect(ticket.categoryKey, 'rac-thai');
      expect(ticket.title, 'Rác ứ đọng đầu ngõ 12');
      expect(ticket.description, 'Rác chất đống nhiều ngày, bốc mùi.');
      expect(ticket.location, 'Thôn Đông, Xã Đại Thắng');
      expect(ticket.sentAt, '20/08/2026 08:30');
      expect(ticket.status, TicketStatus.processing);
      expect(ticket.slaHoursLeft, 72, reason: 'double 71.5 phải được làm tròn lên 72');
      expect(ticket.rating, 4);
      expect(ticket.ratingComment, 'Xử lý nhanh');

      expect(ticket.imageColors, hasLength(2));
      expect(ticket.imageColors, [
        kImagePlaceholderColors[0],
        kImagePlaceholderColors[1],
      ]);

      expect(ticket.timeline, hasLength(2));
      expect(ticket.timeline[0].title, 'Gửi phản ánh');
      expect(ticket.timeline[0].current, isFalse);
      expect(ticket.timeline[1].title, 'Đang xử lý');
      expect(ticket.timeline[1].current, isTrue);
    });

    test('JSON rỗng → giá trị mặc định an toàn, không ném lỗi', () {
      final ticket = FeedbackTicket.fromJson(<String, dynamic>{});

      expect(ticket.code, '');
      expect(ticket.categoryKey, '');
      expect(ticket.title, '');
      expect(ticket.description, '');
      expect(ticket.location, '');
      expect(ticket.sentAt, '');
      expect(ticket.status, TicketStatus.received);
      expect(ticket.slaHoursLeft, 0);
      expect(ticket.imageColors, isEmpty);
      expect(ticket.timeline, isEmpty);
      expect(ticket.rating, 0);
      expect(ticket.ratingComment, isNull);
    });

    test('trường null được xử lý như thiếu khoá', () {
      final ticket = FeedbackTicket.fromJson(<String, dynamic>{
        'code': null,
        'status': null,
        'slaHoursLeft': null,
        'imageFileIds': null,
        'timeline': null,
        'rating': null,
        'ratingComment': null,
      });

      expect(ticket.code, '');
      expect(ticket.status, TicketStatus.received);
      expect(ticket.slaHoursLeft, 0);
      expect(ticket.imageColors, isEmpty);
      expect(ticket.timeline, isEmpty);
      expect(ticket.rating, 0);
      expect(ticket.ratingComment, isNull);
    });

    test('ratingComment rỗng → null (màn chi tiết ẩn khối nhận xét)', () {
      final ticket = FeedbackTicket.fromJson(<String, dynamic>{'ratingComment': ''});
      expect(ticket.ratingComment, isNull);
    });

    test('màu ảnh placeholder xoay vòng khi số ảnh vượt bảng màu', () {
      final ticket = FeedbackTicket.fromJson(<String, dynamic>{
        'imageFileIds': ['a', 'b', 'c', 'd'],
      });
      expect(ticket.imageColors, hasLength(4));
      expect(ticket.imageColors[3], kImagePlaceholderColors[0]);
    });

    test('imageFileIds sai kiểu → không có ảnh', () {
      final ticket = FeedbackTicket.fromJson(<String, dynamic>{'imageFileIds': 'f1,f2'});
      expect(ticket.imageColors, isEmpty);
    });

    test('timeline lọc bỏ phần tử không phải object', () {
      final ticket = FeedbackTicket.fromJson(<String, dynamic>{
        'timeline': [
          <String, dynamic>{'title': 'Hợp lệ', 'state': 'ok'},
          'rác',
          42,
          null,
          <String, dynamic>{'title': 'Hợp lệ 2', 'state': 'cur'},
        ],
      });
      expect(ticket.timeline, hasLength(2));
      expect(ticket.timeline.map((s) => s.title), ['Hợp lệ', 'Hợp lệ 2']);
      expect(ticket.timeline.last.current, isTrue);
    });

    test('slaHoursLeft âm (quá hạn) được giữ nguyên dấu', () {
      final ticket = FeedbackTicket.fromJson(<String, dynamic>{'slaHoursLeft': -12.4});
      expect(ticket.slaHoursLeft, -12);
    });
  });

  group('articleTypeFromApi / Article.fromJson', () {
    test('ánh xạ loại bài viết, mặc định về news', () {
      expect(articleTypeFromApi('news'), ArticleType.news);
      expect(articleTypeFromApi('event'), ArticleType.event);
      expect(articleTypeFromApi('notice'), ArticleType.notice);
      expect(articleTypeFromApi(null), ArticleType.news);
      expect(articleTypeFromApi('other'), ArticleType.news);
    });

    test('_id ưu tiên hơn id và coverColor đi qua colorFromToken', () {
      final a = Article.fromJson(<String, dynamic>{
        '_id': 'abc',
        'id': 'xyz',
        'type': 'notice',
        'title': 'Thông báo lịch tiếp công dân',
        'coverColor': 'var(--purple)',
        'views': 12.6,
      });
      expect(a.id, 'abc');
      expect(a.type, ArticleType.notice);
      expect(a.coverColor, AppColors.purple);
      expect(a.views, 13);
      expect(a.content, '', reason: 'danh sách dùng projection -content');
    });
  });
}
