import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

import 'package:vigov_mobile/config/categories.dart';
import 'package:vigov_mobile/config/theme.dart';
import 'package:vigov_mobile/features/send_feedback/category_step.dart';
import 'package:vigov_mobile/features/send_feedback/detail_step.dart';
import 'package:vigov_mobile/features/send_feedback/send_feedback_screen.dart';
import 'package:vigov_mobile/models/models.dart';
import 'package:vigov_mobile/services/api_client.dart';
import 'package:vigov_mobile/services/device/location_service.dart';
import 'package:vigov_mobile/state/feedback_store.dart';

/// Kho phiếu giả — không chạm mạng. `create` trả phiếu dựng sẵn và ghi lại
/// tham số để bài kiểm thử khẳng định luồng, thay vì gọi `/feedback/citizen`.
class _FakeFeedbackStore extends FeedbackStore {
  _FakeFeedbackStore()
      : super(
          // Mọi lời gọi HTTP đều là lỗi trong bài kiểm thử widget này.
          api: ApiClient(
            httpClient: MockClient((req) async {
              fail('Không được gọi mạng trong widget test: ${req.method} ${req.url}');
            }),
          ),
        );

  int createCalls = 0;

  @override
  Future<FeedbackTicket> create({
    required FeedbackCategory category,
    required String title,
    required String description,
    required String location,
    required int imageCount,
    double? lat,
    double? lng,
  }) async {
    createCalls++;
    return FeedbackTicket(
      code: '#PA-2026-9999',
      categoryKey: category.key,
      title: title,
      description: description,
      location: location,
      sentAt: '20/08/2026 08:30',
      status: TicketStatus.received,
      slaHoursLeft: category.resolveDays * 24,
      imageColors: const [],
      timeline: const [],
    );
  }
}

Widget _wrap(FeedbackStore store) => ChangeNotifierProvider<FeedbackStore>.value(
      value: store,
      child: MaterialApp(
        theme: buildAppTheme(),
        home: const SendFeedbackScreen(),
      ),
    );

/// Dựng màn hình trên khung nhìn đủ cao để lưới 12 danh mục và ghi chú SLA
/// cùng hiển thị — tránh phải cuộn trong từng phép kiểm tra.
Future<void> _pumpScreen(WidgetTester tester, FeedbackStore store) async {
  tester.view.physicalSize = const Size(1000, 2200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(_wrap(store));
}

/// Nút hành động chính ở thanh đáy (bước 1–2 là "Tiếp tục")
FilledButton _continueButton(WidgetTester tester) =>
    tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Tiếp tục'));

Future<void> _pickCategory(WidgetTester tester, String label) async {
  await tester.tap(find.text(label));
  await tester.pump();
}

void main() {
  late _FakeFeedbackStore store;

  setUp(() {
    store = _FakeFeedbackStore();
    // Luồng định vị là adapter mock (Phase 1) — đảm bảo nhánh "được cấp quyền".
    LocationService.simulateDenied = false;
  });

  testWidgets('mở màn ở bước 1 — nút "Tiếp tục" bị vô hiệu khi chưa chọn danh mục',
      (tester) async {
    await _pumpScreen(tester, store);

    expect(find.byType(CategoryStep), findsOneWidget);
    expect(find.text('Sự việc thuộc lĩnh vực nào?'), findsOneWidget);
    expect(find.byType(DetailStep), findsNothing);

    expect(find.widgetWithText(FilledButton, 'Tiếp tục'), findsOneWidget);
    expect(_continueButton(tester).onPressed, isNull,
        reason: 'chưa chọn danh mục thì không được đi tiếp');

    // Nút "Quay lại" chỉ xuất hiện từ bước 2
    expect(find.widgetWithText(OutlinedButton, 'Quay lại'), findsNothing);
  });

  testWidgets('bấm "Tiếp tục" khi chưa chọn danh mục không chuyển bước', (tester) async {
    await _pumpScreen(tester, store);

    await tester.tap(find.widgetWithText(FilledButton, 'Tiếp tục'));
    await tester.pumpAndSettle();

    expect(find.byType(CategoryStep), findsOneWidget);
    expect(find.byType(DetailStep), findsNothing);
  });

  testWidgets('chọn danh mục → nút được bật và hiện cam kết SLA', (tester) async {
    await _pumpScreen(tester, store);

    final giaoThong = feedbackCategories.firstWhere((c) => c.key == 'giao-thong');

    await _pickCategory(tester, giaoThong.label);

    expect(_continueButton(tester).onPressed, isNotNull,
        reason: 'đã chọn danh mục thì nút phải bật');

    expect(
      find.text('Cam kết SLA · ${giaoThong.label}: ${giaoThong.slaText}'),
      findsOneWidget,
    );

    // Vẫn đang ở bước 1
    expect(find.byType(CategoryStep), findsOneWidget);
  });

  testWidgets('chọn danh mục rồi bấm "Tiếp tục" → sang bước 2 (nội dung)', (tester) async {
    await _pumpScreen(tester, store);

    await _pickCategory(tester, 'Rác thải');

    await tester.tap(find.widgetWithText(FilledButton, 'Tiếp tục'));
    await tester.pumpAndSettle();

    // Bước 1 đã rời đi, bước 2 hiện lên
    expect(find.byType(CategoryStep), findsNothing);
    expect(find.byType(DetailStep), findsOneWidget);
    expect(find.text('Tiêu đề *'), findsOneWidget);
    expect(find.text('Mô tả chi tiết *'), findsOneWidget);

    // Bước 2 có nút quay lại, nút chính vẫn là "Tiếp tục" (chưa phải bước cuối)
    expect(find.widgetWithText(OutlinedButton, 'Quay lại'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Tiếp tục'), findsOneWidget);
    expect(_continueButton(tester).onPressed, isNotNull);

    // Không có lời gọi tạo phiếu nào ở bước này
    expect(store.createCalls, 0);
  });

  testWidgets('bước 2 → "Quay lại" giữ nguyên danh mục đã chọn', (tester) async {
    await _pumpScreen(tester, store);

    final anNinh = feedbackCategories.firstWhere((c) => c.key == 'an-ninh');

    await _pickCategory(tester, anNinh.label);
    await tester.tap(find.widgetWithText(FilledButton, 'Tiếp tục'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(OutlinedButton, 'Quay lại'));
    await tester.pumpAndSettle();

    expect(find.byType(CategoryStep), findsOneWidget);
    expect(_continueButton(tester).onPressed, isNotNull,
        reason: 'danh mục đã chọn phải được giữ lại khi quay về bước 1');

    expect(
      find.text('Cam kết SLA · ${anNinh.label}: ${anNinh.slaText}'),
      findsOneWidget,
    );
  });

  testWidgets('bước 2 chặn đi tiếp khi thiếu tiêu đề / mô tả', (tester) async {
    await _pumpScreen(tester, store);

    await _pickCategory(tester, 'Rác thải');
    await tester.tap(find.widgetWithText(FilledButton, 'Tiếp tục'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Tiếp tục'));
    await tester.pumpAndSettle();

    expect(find.byType(DetailStep), findsOneWidget, reason: 'không được sang bước xác nhận');
    expect(find.text('Vui lòng nhập tiêu đề phản ánh'), findsOneWidget);
    expect(find.text('Vui lòng mô tả chi tiết nội dung phản ánh'), findsOneWidget);
  });
}
