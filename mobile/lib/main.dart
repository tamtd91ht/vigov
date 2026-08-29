import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/app_config.dart';
import 'config/theme.dart';
import 'router.dart';
import 'services/content_service.dart';
import 'services/identity_service.dart';
import 'state/app_settings.dart';
import 'state/feedback_store.dart';
import 'state/radio_player_controller.dart';
import 'state/session_controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  final feedback = FeedbackStore();
  final session = SessionController(IdentityService())
    // Đăng xuất hoặc token hết hạn → xoá phiếu của công dân cũ khỏi bộ nhớ
    ..onSignedOut = feedback.reset;
  final settings = AppSettings();
  // Khôi phục phiên + cài đặt trước khung hình đầu tiên
  session.restore();
  settings.restore();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: session),
        ChangeNotifierProvider.value(value: settings),
        // Nội dung công khai (tin tức/video/truyền thanh) — không cần token
        Provider(create: (_) => ContentService()),
        ChangeNotifierProvider.value(value: feedback),
        ChangeNotifierProvider(create: (_) => RadioPlayerController()),
      ],
      child: const ViGovApp(),
    ),
  );
}

class ViGovApp extends StatefulWidget {
  const ViGovApp({super.key});

  @override
  State<ViGovApp> createState() => _ViGovAppState();
}

class _ViGovAppState extends State<ViGovApp> {
  late final _router = buildRouter(context.read<SessionController>());

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<AppSettings>();
    return MaterialApp.router(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: _router,
      // Cỡ chữ lớn áp dụng toàn app (WBS #20)
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(settings.fontScale)),
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
