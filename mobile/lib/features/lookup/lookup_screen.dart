import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../config/app_config.dart';
import '../../config/theme.dart';
import '../../mocks/dossier_mock.dart';
import '../../models/models.dart';
import '../../services/device/qr_service.dart';
import '../../widgets/common.dart';
import 'dossier_result_card.dart';

/// Key lưu lịch sử tra cứu trong shared_preferences (danh sách mã, mới nhất trước)
const String _kHistoryKey = 'vigov.lookup.history';

/// Số mã tra cứu gần nhất tối đa được lưu
const int _kHistoryMax = 5;

/// Màn "Tra cứu hồ sơ một cửa" — WBS #15.
/// Nhập/quét QR mã hồ sơ → hiển thị thông tin + tracker 4 bước xử lý.
class LookupScreen extends StatefulWidget {
  const LookupScreen({super.key});

  @override
  State<LookupScreen> createState() => _LookupScreenState();
}

class _LookupScreenState extends State<LookupScreen> {
  final TextEditingController _codeController = TextEditingController();
  final QrService _qrService = QrService();

  bool _loading = false;
  bool _scanning = false;

  /// Đã bấm tra cứu ít nhất một lần — để phân biệt "chưa tra" và "không thấy"
  bool _searched = false;
  String _searchedCode = '';
  DossierResult? _result;
  List<String> _history = [];

  @override
  void initState() {
    super.initState();
    // Đọc async rồi setState trong callback .then
    SharedPreferences.getInstance().then((prefs) {
      final saved = prefs.getStringList(_kHistoryKey) ?? const [];
      if (!mounted) return;
      setState(() => _history = saved);
    });
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _search([String? codeOverride]) async {
    if (_loading) return;
    final code = (codeOverride ?? _codeController.text).trim();
    if (code.isEmpty) {
      showAppSnack(context, 'Vui lòng nhập mã hồ sơ cần tra cứu');
      return;
    }
    if (codeOverride != null) _codeController.text = codeOverride;
    FocusScope.of(context).unfocus();

    setState(() => _loading = true);
    final result = await lookupDossier(code);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _searched = true;
      _searchedCode = code;
      _result = result;
    });
    if (result != null) await _saveToHistory(result.code);
  }

  Future<void> _scanQr() async {
    if (_scanning || _loading) return;
    setState(() => _scanning = true);
    final code = await _qrService.scan();
    if (!mounted) return;
    setState(() => _scanning = false);
    if (code == null || code.isEmpty) {
      showAppSnack(context, 'Không đọc được mã QR, vui lòng thử lại');
      return;
    }
    await _search(code);
  }

  Future<void> _saveToHistory(String code) async {
    final next = <String>[code, ..._history.where((c) => c.toLowerCase() != code.toLowerCase())];
    if (next.length > _kHistoryMax) next.removeRange(_kHistoryMax, next.length);
    setState(() => _history = next);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_kHistoryKey, next);
  }

  Future<void> _clearHistory() async {
    setState(() => _history = []);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kHistoryKey);
    if (!mounted) return;
    showAppSnack(context, 'Đã xoá lịch sử tra cứu');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tra cứu hồ sơ')),
      body: ListView(
        padding: const EdgeInsets.all(AppDimens.pagePadding),
        children: [
          _buildSearchCard(),
          const SizedBox(height: AppDimens.gap),
          if (_searched && _result != null) DossierResultCard(result: _result!),
          if (_searched && _result == null) _buildNotFound(),
          if (_history.isNotEmpty) ...[
            const SizedBox(height: AppDimens.gap + 6),
            _buildHistory(),
          ],
        ],
      ),
    );
  }

  Widget _buildSearchCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppDimens.pagePadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Nhập mã hồ sơ trên giấy tiếp nhận hoặc quét mã QR',
              style: TextStyle(color: AppColors.muted, fontSize: 13),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _codeController,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _search(),
              decoration: InputDecoration(
                hintText: 'VD: HS-2026-04182',
                prefixIcon: const Icon(Icons.description_outlined, size: 20, color: AppColors.muted),
                suffixIcon: _scanning
                    ? const Padding(
                        padding: EdgeInsets.all(13),
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.blue),
                        ),
                      )
                    : IconButton(
                        tooltip: 'Quét mã QR',
                        onPressed: _scanQr,
                        icon: const Icon(Icons.qr_code_scanner_rounded, color: AppColors.navy),
                      ),
              ),
            ),
            const SizedBox(height: AppDimens.gap),
            FilledButton(
              onPressed: _loading ? null : _search,
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    )
                  : const Text('Tra cứu'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotFound() {
    return Card(
      child: Column(
        children: [
          EmptyState(
            icon: Icons.search_off_rounded,
            message: 'Không tìm thấy hồ sơ mã "$_searchedCode".\n'
                'Vui lòng kiểm tra lại mã in trên giấy tiếp nhận hồ sơ.',
          ),
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 16, bottom: 20),
            child: Text(
              'Cần hỗ trợ? Gọi tổng đài ${AppConfig.hotline}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.blue, fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistory() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Expanded(child: SectionHeader(title: 'Tra cứu gần đây')),
            GestureDetector(
              onTap: _clearHistory,
              child: const Padding(
                padding: EdgeInsets.only(top: 2, left: 8),
                child: Text(
                  'Xoá lịch sử',
                  style: TextStyle(color: AppColors.red, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final code in _history)
              ActionChip(
                avatar: const Icon(Icons.history_rounded, size: 16, color: AppColors.slate),
                label: Text(code),
                onPressed: _loading ? null : () => _search(code),
              ),
          ],
        ),
      ],
    );
  }
}
