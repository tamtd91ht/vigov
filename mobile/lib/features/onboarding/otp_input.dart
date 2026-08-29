import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../config/theme.dart';

/// Dãy ô nhập OTP — hiển thị mỗi chữ số một ô vuông bo góc.
/// Kỹ thuật: một TextField trong suốt phủ toàn bộ vùng ô để nhận focus/bàn phím,
/// các ô bên dưới chỉ vẽ lại nội dung theo controller.
class OtpInput extends StatelessWidget {
  const OtpInput({
    super.key,
    required this.controller,
    required this.length,
    this.focusNode,
    this.hasError = false,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final int length;
  final FocusNode? focusNode;

  /// true → viền đỏ toàn bộ ô (kèm thông báo lỗi do màn cha hiển thị)
  final bool hasError;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: Stack(
        children: [
          AnimatedBuilder(
            animation: Listenable.merge([controller, ?focusNode]),
            builder: (context, _) {
              final text = controller.text;
              final focused = focusNode?.hasFocus ?? false;
              return Row(
                children: [
                  for (var i = 0; i < length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(child: _buildBox(text, i, focused)),
                  ],
                ],
              );
            },
          ),
          // TextField trong suốt nhận toàn bộ thao tác chạm/gõ
          Positioned.fill(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(length),
              ],
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              showCursor: false,
              enableInteractiveSelection: false,
              autocorrect: false,
              style: const TextStyle(color: Colors.transparent, fontSize: 1, height: 1),
              decoration: const InputDecoration(
                filled: false,
                isCollapsed: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                counterText: '',
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Vẽ một ô: viền xanh khi là ô đang nhập, đỏ khi lỗi, xám mặc định.
  Widget _buildBox(String text, int index, bool focused) {
    final char = index < text.length ? text[index] : '';
    final isActive = focused &&
        (index == text.length || (text.length == length && index == length - 1));

    final Color borderColor;
    if (hasError) {
      borderColor = AppColors.red;
    } else if (isActive) {
      borderColor = AppColors.blue;
    } else {
      borderColor = AppColors.border;
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 120),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(AppDimens.radiusSm),
        border: Border.all(color: borderColor, width: isActive || hasError ? 1.6 : 1),
      ),
      child: Text(
        char,
        style: const TextStyle(color: AppColors.navy, fontSize: 20, fontWeight: FontWeight.w700),
      ),
    );
  }
}
