import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../config/categories.dart';
import '../../config/theme.dart';
import '../../models/models.dart';
import '../../services/api_client.dart';
import '../../services/device/location_service.dart';
import '../../state/feedback_store.dart';
import '../../widgets/common.dart';
import 'category_step.dart';
import 'confirm_step.dart';
import 'detail_step.dart';
import 'step_progress.dart';

/// Nhãn 3 bước gửi phản ánh
const List<String> kStepLabels = ['Danh mục', 'Nội dung', 'Xác nhận'];

/// Luồng gửi phản ánh 3 bước (WBS #13).
class SendFeedbackScreen extends StatefulWidget {
  const SendFeedbackScreen({super.key});

  @override
  State<SendFeedbackScreen> createState() => _SendFeedbackScreenState();
}

class _SendFeedbackScreenState extends State<SendFeedbackScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _locationService = LocationService();

  int _step = 0;
  FeedbackCategory? _category;
  final List<Color> _images = [];

  bool _locationLoading = false;
  bool _locationRequested = false;
  LocationResult? _location;
  bool _editingAddress = false;

  String? _titleError;
  String? _descError;
  String? _addressError;

  bool _submitting = false;

  /// Phiếu đã gửi thành công — khác null thì hiển thị màn kết quả
  FeedbackTicket? _created;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  bool get _hasInput =>
      _category != null || _titleCtrl.text.isNotEmpty || _descCtrl.text.isNotEmpty || _images.isNotEmpty;

  /// Địa chỉ dùng để gửi: ưu tiên ô nhập tay, ngược lại lấy từ định vị
  String get _address =>
      _addressCtrl.text.trim().isNotEmpty ? _addressCtrl.text.trim() : (_location?.address ?? '');

  Future<void> _requestLocation() async {
    setState(() => _locationLoading = true);
    final result = await _locationService.currentLocation();
    if (!mounted) return;
    setState(() {
      _location = result;
      _locationLoading = false;
      // Từ chối quyền GPS → buộc nhập tay (câu hỏi mở #16)
      _editingAddress = !result.granted;
      if (result.granted && _addressCtrl.text.isEmpty) {
        _addressCtrl.text = result.address ?? '';
      }
    });
  }

  void _goNext() {
    if (_step == 0) {
      if (_category == null) return;
      setState(() => _step = 1);
      if (!_locationRequested) {
        _locationRequested = true;
        _requestLocation();
      }
      return;
    }
    if (_step == 1) {
      final title = _titleCtrl.text.trim();
      final desc = _descCtrl.text.trim();
      setState(() {
        // Backend yêu cầu tiêu đề tối thiểu kFeedbackTitleMin ký tự — chặn tại chỗ
        // để công dân không phải chờ một vòng gọi mạng mới thấy lỗi.
        _titleError = switch (title.length) {
          0 => 'Vui lòng nhập tiêu đề phản ánh',
          < kFeedbackTitleMin => 'Tiêu đề phải có ít nhất $kFeedbackTitleMin ký tự',
          _ => null,
        };
        _descError = desc.isEmpty ? 'Vui lòng mô tả chi tiết nội dung phản ánh' : null;
        _addressError = _address.isEmpty ? 'Vui lòng nhập địa chỉ nơi xảy ra sự việc' : null;
      });
      if (_titleError != null || _descError != null || _addressError != null) return;
      setState(() => _step = 2);
    }
  }

  void _goBack() {
    if (_step > 0) setState(() => _step -= 1);
  }

  Future<void> _submit() async {
    if (_category == null) return;
    setState(() => _submitting = true);

    final FeedbackTicket ticket;
    try {
      ticket = await context.read<FeedbackStore>().create(
            category: _category!,
            title: _titleCtrl.text.trim(),
            description: _descCtrl.text.trim(),
            location: _address,
            imageCount: _images.length,
            // Toạ độ chỉ gửi khi công dân cho phép định vị
            lat: _location?.granted == true ? _location?.lat : null,
            lng: _location?.granted == true ? _location?.lng : null,
          );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      // Thông báo của backend: thiếu trường, vượt hạn mức chống spam (429), mất mạng…
      showAppSnack(context, e.message);
      return;
    }

    if (!mounted) return;
    setState(() {
      _submitting = false;
      _created = ticket;
    });
  }

  Future<void> _confirmDiscard() async {
    if (!_hasInput) {
      if (mounted) context.pop();
      return;
    }
    final leave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Huỷ gửi phản ánh?'),
        content: const Text('Nội dung bạn đã nhập sẽ không được lưu lại.'),
        actions: [
          TextButton(onPressed: () => ctx.pop(false), child: const Text('Tiếp tục nhập')),
          TextButton(
            onPressed: () => ctx.pop(true),
            child: const Text('Huỷ gửi', style: TextStyle(color: AppColors.red)),
          ),
        ],
      ),
    );
    if (leave == true && mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    if (_created != null) return _ResultView(ticket: _created!, category: _category!);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmDiscard();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Gửi phản ánh'),
          leading: IconButton(icon: const Icon(Icons.close), onPressed: _confirmDiscard),
        ),
        body: Column(
          children: [
            Container(
              color: AppColors.bg,
              padding: const EdgeInsets.fromLTRB(AppDimens.pagePadding, 6, AppDimens.pagePadding, 16),
              child: StepProgress(current: _step, labels: kStepLabels),
            ),
            const Divider(height: 1),
            // CategoryStep/DetailStep tự cuộn (ListView) nên KHÔNG bọc thêm
            // SingleChildScrollView — viewport lồng nhau cùng trục sẽ ném
            // "Vertical viewport was given unbounded height". Chỉ ConfirmStep
            // (Column) mới cần khối cuộn riêng.
            Expanded(
              child: switch (_step) {
                0 => CategoryStep(
                    selected: _category,
                    onSelect: (c) => setState(() => _category = c),
                  ),
                1 => DetailStep(
                    titleCtrl: _titleCtrl,
                    descCtrl: _descCtrl,
                    addressCtrl: _addressCtrl,
                    titleError: _titleError,
                    descError: _descError,
                    addressError: _addressError,
                    images: _images,
                    onAddImage: () {
                      if (_images.length >= AppConfig.maxFeedbackImages) return;
                      setState(() => _images.add(kMockImageColors[_images.length % kMockImageColors.length]));
                    },
                    onRemoveImage: (i) => setState(() => _images.removeAt(i)),
                    locationLoading: _locationLoading,
                    location: _location,
                    editingAddress: _editingAddress,
                    onEditAddress: () => setState(() => _editingAddress = true),
                  ),
                _ => SingleChildScrollView(
                    padding: const EdgeInsets.all(AppDimens.pagePadding),
                    child: ConfirmStep(
                      category: _category!,
                      title: _titleCtrl.text.trim(),
                      description: _descCtrl.text.trim(),
                      imageColors: _images,
                      address: _address,
                    ),
                  ),
              },
            ),
            _BottomBar(
              step: _step,
              canContinue: _step != 0 || _category != null,
              submitting: _submitting,
              onBack: _goBack,
              onNext: _goNext,
              onSubmit: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

/// Thanh nút cố định đáy
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.step,
    required this.canContinue,
    required this.submitting,
    required this.onBack,
    required this.onNext,
    required this.onSubmit,
  });

  final int step;
  final bool canContinue;
  final bool submitting;
  final VoidCallback onBack;
  final VoidCallback onNext;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final last = step == kStepLabels.length - 1;
    return Container(
      padding: const EdgeInsets.fromLTRB(AppDimens.pagePadding, 12, AppDimens.pagePadding, 16),
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (step > 0) ...[
              Expanded(
                child: OutlinedButton(
                  onPressed: submitting ? null : onBack,
                  child: const Text('Quay lại'),
                ),
              ),
              const SizedBox(width: AppDimens.gap),
            ],
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: submitting || !canContinue ? null : (last ? onSubmit : onNext),
                child: submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                      )
                    : Text(last ? 'Gửi phản ánh' : 'Tiếp tục'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Màn kết quả sau khi gửi thành công
class _ResultView extends StatelessWidget {
  const _ResultView({required this.ticket, required this.category});

  final FeedbackTicket ticket;
  final FeedbackCategory category;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.tint(AppColors.green, .14),
                  ),
                  child: const Icon(Icons.check_rounded, size: 52, color: AppColors.green),
                ),
                const SizedBox(height: 20),
                Text('Gửi phản ánh thành công',
                    style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                const Text(
                  'Phản ánh của bạn đã được chuyển tới bộ phận tiếp nhận của UBND xã.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted, fontSize: 13.5),
                ),
                const SizedBox(height: 22),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.bg2,
                    borderRadius: BorderRadius.circular(AppDimens.radius),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      const Text('Mã phiếu của bạn',
                          style: TextStyle(color: AppColors.muted, fontSize: 12)),
                      const SizedBox(height: 4),
                      // Quy tắc đánh mã phiếu thật chờ khách xác nhận (câu hỏi mở #17)
                      Text(ticket.code,
                          style: const TextStyle(
                              color: AppColors.navy, fontSize: 22, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.schedule, size: 15, color: AppColors.green),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(category.slaText,
                          style: const TextStyle(color: AppColors.green, fontSize: 12.5, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
                const Spacer(),
                FilledButton(
                  onPressed: () =>
                      context.pushReplacement('/my-feedback/${Uri.encodeComponent(ticket.code)}'),
                  child: const Text('Theo dõi phiếu này'),
                ),
                const SizedBox(height: AppDimens.gap),
                OutlinedButton(onPressed: () => context.go('/'), child: const Text('Về trang chủ')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
