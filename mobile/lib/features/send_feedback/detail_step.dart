import 'package:flutter/material.dart';
import '../../config/app_config.dart';
import '../../config/theme.dart';
import '../../services/device/location_service.dart';

/// Giới hạn ký tự tiêu đề phản ánh
const int kFeedbackTitleMax = 120;

/// Độ dài tối thiểu tiêu đề — khớp MIN_TITLE_LENGTH của CreateCitizenFeedbackDto
const int kFeedbackTitleMin = 5;

/// Giới hạn ký tự mô tả chi tiết
const int kFeedbackDescMax = 1000;

/// Màu placeholder ảnh mock — xoay vòng theo thứ tự thêm.
/// image_picker thật (camera/thư viện) thuộc phạm vi tích hợp ngoài (P3);
/// nếu người dùng từ chối quyền camera vẫn gửi được phản ánh không kèm ảnh (câu hỏi mở #16).
const List<Color> kMockImageColors = [AppColors.blue, AppColors.teal, AppColors.slate];

/// BƯỚC 2 — nội dung phản ánh: tiêu đề, mô tả, ảnh hiện trường (mock), vị trí GPS.
class DetailStep extends StatelessWidget {
  const DetailStep({
    super.key,
    required this.titleCtrl,
    required this.descCtrl,
    required this.addressCtrl,
    this.titleError,
    this.descError,
    this.addressError,
    required this.images,
    required this.onAddImage,
    required this.onRemoveImage,
    required this.locationLoading,
    this.location,
    required this.editingAddress,
    required this.onEditAddress,
  });

  final TextEditingController titleCtrl;
  final TextEditingController descCtrl;
  final TextEditingController addressCtrl;
  final String? titleError;
  final String? descError;
  final String? addressError;

  /// Ảnh mock — mỗi phần tử là 1 màu placeholder
  final List<Color> images;
  final VoidCallback onAddImage;
  final ValueChanged<int> onRemoveImage;

  final bool locationLoading;
  final LocationResult? location;
  final bool editingAddress;
  final VoidCallback onEditAddress;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppDimens.pagePadding),
      children: [
        Text('Tiêu đề *', style: theme.textTheme.titleSmall),
        const SizedBox(height: 6),
        TextField(
          controller: titleCtrl,
          maxLength: kFeedbackTitleMax,
          textInputAction: TextInputAction.next,
          decoration: InputDecoration(
            hintText: 'Ví dụ: Rác ứ đọng tại đầu ngõ 12 nhiều ngày',
            errorText: titleError,
          ),
        ),
        const SizedBox(height: 10),
        Text('Mô tả chi tiết *', style: theme.textTheme.titleSmall),
        const SizedBox(height: 6),
        TextField(
          controller: descCtrl,
          maxLength: kFeedbackDescMax,
          minLines: 4,
          maxLines: 8,
          keyboardType: TextInputType.multiline,
          decoration: InputDecoration(
            hintText: 'Mô tả rõ sự việc: xảy ra từ khi nào, mức độ ảnh hưởng, đề xuất của bạn…',
            errorText: descError,
          ),
        ),
        const SizedBox(height: 10),
        Text('Ảnh hiện trường (tối đa ${AppConfig.maxFeedbackImages} ảnh)', style: theme.textTheme.titleSmall),
        const SizedBox(height: 4),
        Text(
          'Không bắt buộc — nếu không cấp quyền camera/thư viện, bạn vẫn gửi được phản ánh không kèm ảnh.',
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: 10),
        _ImageRow(images: images, onAdd: onAddImage, onRemove: onRemoveImage),
        const SizedBox(height: 18),
        Text('Vị trí xảy ra sự việc *', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        _LocationSection(
          loading: locationLoading,
          location: location,
          addressCtrl: addressCtrl,
          addressError: addressError,
          editing: editingAddress,
          onEdit: onEditAddress,
        ),
        const SizedBox(height: 20),
      ],
    );
  }
}

/// Hàng ảnh mock + nút thêm (ẩn khi đủ số ảnh tối đa)
class _ImageRow extends StatelessWidget {
  const _ImageRow({required this.images, required this.onAdd, required this.onRemove});

  final List<Color> images;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (var i = 0; i < images.length; i++)
          SizedBox(
            width: 76,
            height: 76,
            child: Stack(
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    color: AppColors.tint(images[i], .35),
                    borderRadius: BorderRadius.circular(AppDimens.radiusSm),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(Icons.image_outlined, color: images[i], size: 26),
                ),
                Positioned(
                  top: 4,
                  right: 4,
                  child: GestureDetector(
                    onTap: () => onRemove(i),
                    child: Container(
                      width: 18,
                      height: 18,
                      decoration: const BoxDecoration(color: AppColors.navy, shape: BoxShape.circle),
                      child: const Icon(Icons.close_rounded, size: 12, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (images.length < AppConfig.maxFeedbackImages)
          InkWell(
            onTap: onAdd,
            borderRadius: BorderRadius.circular(AppDimens.radiusSm),
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: AppColors.bg,
                borderRadius: BorderRadius.circular(AppDimens.radiusSm),
                border: Border.all(color: AppColors.border),
              ),
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_a_photo_outlined, size: 20, color: AppColors.blue),
                  SizedBox(height: 4),
                  Text('Thêm ảnh', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.blue)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Khối vị trí: spinner khi đang định vị → card địa chỉ (granted) → TextField khi Sửa/từ chối quyền
class _LocationSection extends StatelessWidget {
  const _LocationSection({
    required this.loading,
    required this.location,
    required this.addressCtrl,
    required this.addressError,
    required this.editing,
    required this.onEdit,
  });

  final bool loading;
  final LocationResult? location;
  final TextEditingController addressCtrl;
  final String? addressError;
  final bool editing;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(AppDimens.radiusSm),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          children: [
            SizedBox(width: 17, height: 17, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.blue)),
            SizedBox(width: 10),
            Text('Đang xác định vị trí của bạn…', style: TextStyle(fontSize: 13, color: AppColors.muted)),
          ],
        ),
      );
    }

    final denied = location != null && !location!.granted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (denied) ...[
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: AppColors.tint(AppColors.orange, .10),
              borderRadius: BorderRadius.circular(AppDimens.radiusSm),
              border: Border.all(color: AppColors.tint(AppColors.orange, .35)),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.location_off_outlined, size: 16, color: AppColors.orange),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Không truy cập được vị trí — vui lòng nhập địa chỉ',
                    style: TextStyle(color: AppColors.orange, fontSize: 12.5, fontWeight: FontWeight.w600, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
        if (!denied && !editing && location != null)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.bg,
              borderRadius: BorderRadius.circular(AppDimens.radiusSm),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on_outlined, size: 19, color: AppColors.pink),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        addressCtrl.text,
                        style: const TextStyle(color: AppColors.navy, fontSize: 13.5, fontWeight: FontWeight.w600, height: 1.4),
                      ),
                      if (location!.lat != null && location!.lng != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          '${location!.lat!.toStringAsFixed(4)}, ${location!.lng!.toStringAsFixed(4)}',
                          style: const TextStyle(color: AppColors.muted, fontSize: 12),
                        ),
                      ],
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: onEdit,
                  child: const Text('Sửa',
                      style: TextStyle(color: AppColors.blue, fontSize: 13, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          )
        else
          TextField(
            controller: addressCtrl,
            decoration: InputDecoration(
              hintText: 'Nhập địa chỉ: số nhà, đường/thôn, ${AppConfig.orgName}…',
              prefixIcon: const Icon(Icons.location_on_outlined, size: 19, color: AppColors.muted),
              errorText: addressError,
            ),
          ),
      ],
    );
  }
}
