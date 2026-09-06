import '../config/app_config.dart';
import '../mocks/dossier_mock.dart';
import '../models/models.dart';
import 'api_client.dart';

/// Tổng số bước của quy trình một cửa — khớp DOSSIER_STEP_KEYS của backend.
const int kDossierTotalSteps = 4;

/// Nhãn trạng thái hiển thị trên card kết quả.
///
/// Giữ nguyên câu chữ của bản demo trước khi nối API để người dùng thử không
/// thấy nội dung đổi khác.
const Map<String, String> kDossierStatusLabels = {
  'received': 'Đã tiếp nhận',
  'appraising': 'Đang xử lý',
  'awaiting_signature': 'Chờ ký duyệt',
  'returned': 'Đã có kết quả — mời nhận tại bộ phận một cửa',
};

/// Tra cứu hồ sơ một cửa (WBS #15) — `GET /dossiers/lookup/:code`.
///
/// Endpoint của backend là CÔNG KHAI (công dân tra bằng mã trên giấy tiếp nhận),
/// nên gọi với `auth: false` và dùng được cả khi chưa định danh SĐT.
///
/// Cờ [AppConfig.useMocks] rẽ nhánh NGAY TẠI ĐÂY, đúng khuôn của
/// `IdentityService` / `ContentService` — màn hình chỉ gọi service. Trước đây
/// `lookup_screen.dart` import thẳng `mocks/dossier_mock.dart` vô điều kiện,
/// nên bản chạy thật vẫn đọc dữ liệu mẫu bất kể cấu hình build.
class DossierService {
  DossierService({ApiClient? api}) : _api = api ?? ApiClient.instance;

  final ApiClient _api;

  /// Tra cứu hồ sơ theo mã.
  ///
  /// Trả `null` khi KHÔNG có hồ sơ nào khớp — màn hình phân biệt "không tìm
  /// thấy" với sự cố bằng chính giá trị này; lỗi thật (mất mạng, quá hạn mức)
  /// vẫn ném [ApiException] để hiển thị thông báo của máy chủ.
  Future<DossierResult?> lookup(String code) async {
    final trimmed = code.trim();
    if (trimmed.isEmpty) return null;

    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      return lookupMockDossier(trimmed);
    }

    try {
      final res = await _api.getJson(
        '/dossiers/lookup/${Uri.encodeComponent(trimmed)}',
        auth: false,
      );
      return dossierFromJson(res);
    } on ApiException catch (e) {
      // 404 là câu trả lời nghiệp vụ hợp lệ ("không có hồ sơ mã này"),
      // không phải sự cố — mọi mã lỗi khác vẫn ném lên cho màn hình xử lý.
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }
}

/// Dựng [DossierResult] từ phản hồi của backend.
///
/// Đặt ở tầng service chứ không ở `models.dart` vì phép quy đổi này chỉ đúng
/// cho hợp đồng của endpoint tra cứu: gộp `assignee` + `department` thành một
/// dòng hiển thị, và suy `currentStep` từ cờ `done` của từng bước.
DossierResult dossierFromJson(Map<String, dynamic> json) {
  final steps = (json['steps'] is List ? json['steps'] as List : const [])
      .whereType<Map<String, dynamic>>()
      .toList();

  final officer = [asString(json['assignee']), asString(json['department'])]
      .where((part) => part.isNotEmpty)
      .join(' — ');

  return DossierResult(
    code: asString(json['code']),
    procedure: asString(json['procedure']),
    applicant: asString(json['applicantName']),
    statusLabel: kDossierStatusLabels[asString(json['status'])] ?? 'Đang xử lý',
    officer: officer,
    currentStep: _currentStepOf(steps),
    steps: steps.map((step) => asString(step['label'])).toList(),
    submittedAt: _dateTimeLabel(json['submittedAt']),
    expectedAt: _dateLabel(json['dueAt']),
  );
}

/// Bước hiện tại theo cách đếm 1-based của `DossierStepTracker`.
///
/// Backend trả cờ `done` cho từng bước chứ không trả chỉ số — suy ở đây để hợp
/// đồng API không phải mang thêm một trường có thể tự mâu thuẫn với `done`.
/// Bước hiện tại = bước ĐẦU TIÊN chưa xong; xong hết thì là bước cuối.
int _currentStepOf(List<Map<String, dynamic>> steps) {
  for (var i = 0; i < steps.length; i++) {
    if (steps[i]['done'] != true) return i + 1;
  }
  return steps.isEmpty ? kDossierTotalSteps : steps.length;
}

/// ISO 8601 → "dd/MM/yyyy HH:mm" theo giờ máy; thiếu mốc thì trả chuỗi rỗng
String _dateTimeLabel(Object? iso) {
  final parsed = DateTime.tryParse(asString(iso));
  if (parsed == null) return '';
  final local = parsed.toLocal();
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(local.day)}/${p(local.month)}/${local.year} ${p(local.hour)}:${p(local.minute)}';
}

/// ISO 8601 → "dd/MM/yyyy" — hạn trả kết quả trên giấy hẹn chỉ tính theo ngày
String _dateLabel(Object? iso) {
  final label = _dateTimeLabel(iso);
  return label.isEmpty ? '' : label.substring(0, 10);
}
