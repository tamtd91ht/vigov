import '../models/models.dart';

/// 4 bước chuẩn của quy trình một cửa cấp xã — dùng chung cho mọi hồ sơ mẫu.
const List<String> kDossierSteps = [
  'Tiếp nhận hồ sơ',
  'Thẩm định, xử lý',
  'Trình ký kết quả',
  'Trả kết quả',
];

/// Hồ sơ một cửa mẫu — ngữ cảnh Xã Đại Thắng.
/// Nguồn dữ liệu hồ sơ một cửa thật chờ khách xác nhận — câu hỏi mở #18.
final List<DossierResult> dossierResults = [
  const DossierResult(
    code: 'HS-2026-04182',
    procedure: 'Cấp bản sao trích lục khai sinh',
    applicant: 'Nguyễn Văn Hùng',
    statusLabel: 'Đang xử lý',
    officer: 'Trần Thị Lan — Tư pháp, Hộ tịch',
    currentStep: 2,
    steps: kDossierSteps,
    submittedAt: '24/08/2026 09:15',
    expectedAt: '27/08/2026',
  ),
  const DossierResult(
    code: 'HS-2026-03957',
    procedure: 'Xác nhận tình trạng hôn nhân',
    applicant: 'Phạm Thị Mai',
    statusLabel: 'Đã có kết quả — mời nhận tại bộ phận một cửa',
    officer: 'Trần Thị Lan — Tư pháp, Hộ tịch',
    currentStep: 4,
    steps: kDossierSteps,
    submittedAt: '15/08/2026 14:20',
    expectedAt: '20/08/2026',
  ),
  const DossierResult(
    code: 'HS-2026-04101',
    procedure: 'Đăng ký biến động đất đai',
    applicant: 'Lê Đình Quang',
    statusLabel: 'Đang xử lý',
    officer: 'Vũ Minh Đức — Địa chính, Xây dựng',
    currentStep: 3,
    steps: kDossierSteps,
    submittedAt: '19/08/2026 10:40',
    expectedAt: '02/09/2026',
  ),
];

/// Tra cứu hồ sơ theo mã trong dữ liệu MẪU — so khớp không phân biệt hoa thường.
///
/// Chỉ dùng cho nhánh demo offline; nguồn thật là `GET /dossiers/lookup/:code`,
/// xem `services/dossier_service.dart`. Hàm này KHÔNG tự trễ nữa — độ trễ giả
/// lập do service quyết định, giống mọi mock khác trong dự án.
DossierResult? lookupMockDossier(String code) {
  final normalized = code.trim().toLowerCase();
  for (final d in dossierResults) {
    if (d.code.toLowerCase() == normalized) return d;
  }
  return null;
}
