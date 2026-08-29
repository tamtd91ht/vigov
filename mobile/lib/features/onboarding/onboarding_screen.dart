import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../config/theme.dart';
import '../../services/api_client.dart';
import '../../state/session_controller.dart';
import 'otp_input.dart';

/// SĐT hợp lệ: đúng 10 chữ số, bắt đầu bằng 0.
final RegExp kPhoneRegex = RegExp(r'^0\d{9}$');

/// Số giây đếm ngược trước khi cho phép gửi lại mã OTP.
const int kOtpResendSeconds = 30;

/// Ghi chú nguồn lấy mã OTP hiển thị dưới ô nhập mã.
///
/// Phase 1 backend CHƯA gửi SMS/ZNS thật mà ghi mã ra log máy chủ, nên người
/// kiểm thử cần biết tìm mã ở đâu (dòng log `Mã OTP cho [số điện thoại]: [mã]`).
const String kOtpMockHint = '(Bản demo: nhập 6 số bất kỳ)';
const String kOtpServerLogHint =
    'Phase 1 chưa gửi SMS/ZNS — mã được ghi ở log máy chủ backend,\n'
    'tìm dòng "Mã OTP cho <số điện thoại>".';

/// Màn Onboarding — định danh công dân bằng SĐT + OTP (WBS #11).
/// Sau khi verifyOtp thành công, router (refreshListenable) tự chuyển về Trang chủ.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _phoneCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _otpFocus = FocusNode();

  bool _otpStep = false; // false = bước nhập SĐT, true = bước nhập OTP
  bool _sending = false; // đang gọi sendOtp
  bool _verifying = false; // đang gọi verifyOtp
  String? _phoneError;
  String? _otpError;

  Timer? _resendTimer;
  int _resendLeft = 0;

  @override
  void dispose() {
    _resendTimer?.cancel();
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    _otpFocus.dispose();
    super.dispose();
  }

  void _startResendCountdown() {
    _resendTimer?.cancel();
    setState(() => _resendLeft = kOtpResendSeconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        _resendLeft -= 1;
        if (_resendLeft <= 0) t.cancel();
      });
    });
  }

  Future<void> _sendOtp() async {
    final phone = _phoneCtrl.text.trim();
    if (!kPhoneRegex.hasMatch(phone)) {
      setState(() => _phoneError = 'Số điện thoại phải gồm 10 số và bắt đầu bằng số 0');
      return;
    }
    setState(() {
      _phoneError = null;
      _sending = true;
    });
    try {
      // Bản mock trả về ngay; bản thật gọi POST /auth/citizen/otp/request
      await context.read<SessionController>().sendOtp(phone);
    } on ApiException catch (e) {
      if (!mounted) return;
      // Thông báo lấy thẳng từ backend: SĐT sai định dạng, quá hạn mức gửi…
      setState(() {
        _sending = false;
        _phoneError = e.message;
      });
      return;
    }
    if (!mounted) return;
    setState(() {
      _sending = false;
      _otpStep = true;
      _otpError = null;
      _otpCtrl.clear();
    });
    _startResendCountdown();
    _otpFocus.requestFocus();
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.text;
    if (otp.length < AppConfig.otpLength) {
      setState(() => _otpError = 'Vui lòng nhập đủ ${AppConfig.otpLength} số của mã xác thực');
      return;
    }
    setState(() {
      _otpError = null;
      _verifying = true;
    });
    try {
      // Bản thật gọi POST /auth/citizen/otp/verify rồi lưu accessToken;
      // bản mock chấp nhận mọi mã đủ độ dài AppConfig.otpLength.
      await context.read<SessionController>().verifyOtp(_phoneCtrl.text.trim(), otp);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _otpError = e.message;
      });
      return;
    }
    if (!mounted) return;
    setState(() => _verifying = false);
    // Thành công → router tự redirect về '/', không cần điều hướng thủ công.
  }

  void _backToPhone() {
    _resendTimer?.cancel();
    setState(() {
      _otpStep = false;
      _otpError = null;
      _otpCtrl.clear();
      _resendLeft = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg2,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppDimens.pagePadding * 1.5,
                  vertical: 32,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _BrandBlock(),
                    const SizedBox(height: 28),
                    if (!_otpStep)
                      _PhoneStep(
                        controller: _phoneCtrl,
                        errorText: _phoneError,
                        sending: _sending,
                        onSubmit: _sendOtp,
                      )
                    else
                      _OtpStep(
                        phone: _phoneCtrl.text.trim(),
                        controller: _otpCtrl,
                        focusNode: _otpFocus,
                        errorText: _otpError,
                        verifying: _verifying,
                        resendLeft: _resendLeft,
                        onVerify: _verifyOtp,
                        onResend: _sendOtp,
                        onChangePhone: _backToPhone,
                        onOtpChanged: (_) {
                          if (_otpError != null) setState(() => _otpError = null);
                        },
                      ),
                  ],
                ),
              ),
            ),
            const _HotlineFooter(),
          ],
        ),
      ),
    );
  }
}

/// Khối nhận diện: logo VG + tên app + tagline + đơn vị vận hành.
class _BrandBlock extends StatelessWidget {
  const _BrandBlock();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 72,
          height: 72,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.pink,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Text(
            'VG',
            style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 1),
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          AppConfig.appName,
          style: TextStyle(color: AppColors.navy, fontSize: 26, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        const Text(AppConfig.appTagline, style: TextStyle(color: AppColors.muted, fontSize: 14)),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.tint(AppColors.navy),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Text(
            AppConfig.orgName,
            style: TextStyle(color: AppColors.navy, fontSize: 12.5, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

/// Bước 1 — giới thiệu lợi ích + nhập SĐT nhận OTP.
class _PhoneStep extends StatelessWidget {
  const _PhoneStep({
    required this.controller,
    required this.errorText,
    required this.sending,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final String? errorText;
  final bool sending;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _BenefitRow(
          icon: Icons.campaign_outlined,
          color: AppColors.pink,
          text: 'Gửi phản ánh hiện trường tới chính quyền xã, theo dõi tiến độ xử lý',
        ),
        const SizedBox(height: 10),
        const _BenefitRow(
          icon: Icons.find_in_page_outlined,
          color: AppColors.blue,
          text: 'Tra cứu tình trạng hồ sơ thủ tục hành chính một cửa',
        ),
        const SizedBox(height: 10),
        const _BenefitRow(
          icon: Icons.article_outlined,
          color: AppColors.green,
          text: 'Cập nhật tin tức, thông báo và truyền thanh của xã',
        ),
        const SizedBox(height: 26),
        const Text(
          'Số điện thoại',
          style: TextStyle(color: AppColors.navy, fontSize: 13.5, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.done,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(10),
          ],
          onSubmitted: (_) => onSubmit(),
          decoration: InputDecoration(
            hintText: 'Ví dụ: 0912345678',
            prefixIcon: const Icon(Icons.phone_iphone, size: 20, color: AppColors.muted),
            errorText: errorText,
          ),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: sending ? null : onSubmit,
          child: sending
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                )
              : const Text('Nhận mã xác thực'),
        ),
      ],
    );
  }
}

/// Một dòng lợi ích ở màn giới thiệu.
class _BenefitRow extends StatelessWidget {
  const _BenefitRow({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.tint(color, .12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: color),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Text(text, style: const TextStyle(color: AppColors.text, fontSize: 13.5, height: 1.35)),
          ),
        ),
      ],
    );
  }
}

/// Bước 2 — nhập OTP, đếm ngược gửi lại, đổi SĐT.
class _OtpStep extends StatelessWidget {
  const _OtpStep({
    required this.phone,
    required this.controller,
    required this.focusNode,
    required this.errorText,
    required this.verifying,
    required this.resendLeft,
    required this.onVerify,
    required this.onResend,
    required this.onChangePhone,
    required this.onOtpChanged,
  });

  final String phone;
  final TextEditingController controller;
  final FocusNode focusNode;
  final String? errorText;
  final bool verifying;
  final int resendLeft;
  final VoidCallback onVerify;
  final VoidCallback onResend;
  final VoidCallback onChangePhone;
  final ValueChanged<String> onOtpChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Nhập mã xác thực',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.navy, fontSize: 17, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          'Mã OTP gồm ${AppConfig.otpLength} số đã được gửi tới số $phone',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.text, fontSize: 13.5),
        ),
        const SizedBox(height: 4),
        // Mock: nhập mã bất kỳ. Bản thật: mã nằm ở log máy chủ (chưa gửi SMS).
        Text(
          AppConfig.useMocks ? kOtpMockHint : kOtpServerLogHint,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.muted, fontSize: 12, fontStyle: FontStyle.italic),
        ),
        const SizedBox(height: 20),
        OtpInput(
          controller: controller,
          focusNode: focusNode,
          length: AppConfig.otpLength,
          hasError: errorText != null,
          onChanged: onOtpChanged,
          onSubmitted: (_) => onVerify(),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 10),
          Text(
            errorText!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.red, fontSize: 12.5, fontWeight: FontWeight.w600),
          ),
        ],
        const SizedBox(height: 14),
        // Đếm ngược gửi lại mã
        if (resendLeft > 0)
          Text(
            'Gửi lại mã sau ${resendLeft}s',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted, fontSize: 13),
          )
        else
          GestureDetector(
            onTap: onResend,
            child: const Text(
              'Gửi lại mã xác thực',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.blue, fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ),
        const SizedBox(height: 18),
        FilledButton(
          onPressed: verifying ? null : onVerify,
          child: verifying
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                )
              : const Text('Xác nhận'),
        ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: onChangePhone,
          icon: const Icon(Icons.arrow_back_rounded, size: 17, color: AppColors.slate),
          label: const Text(
            'Đổi số điện thoại',
            style: TextStyle(color: AppColors.slate, fontSize: 13.5, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

/// Footer hỗ trợ — tổng đài lấy từ AppConfig.
class _HotlineFooter extends StatelessWidget {
  const _HotlineFooter();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppDimens.pagePadding, 8, AppDimens.pagePadding, 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.support_agent, size: 16, color: AppColors.muted),
          const SizedBox(width: 6),
          Text(
            'Hỗ trợ: ${AppConfig.hotline} (giờ hành chính)',
            style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}
