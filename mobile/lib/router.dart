import 'package:go_router/go_router.dart';
import 'state/session_controller.dart';
import 'widgets/app_shell.dart';
import 'features/onboarding/onboarding_screen.dart';
import 'features/home/home_screen.dart';
import 'features/send_feedback/send_feedback_screen.dart';
import 'features/my_feedback/my_feedback_screen.dart';
import 'features/my_feedback/feedback_detail_screen.dart';
import 'features/lookup/lookup_screen.dart';
import 'features/news/news_screen.dart';
import 'features/news/news_detail_screen.dart';
import 'features/radio/radio_screen.dart';
import 'features/video/video_screen.dart';
import 'features/video/video_detail_screen.dart';
import 'features/directory/directory_screen.dart';
import 'features/profile/profile_screen.dart';

/// Router toàn app — chưa định danh SĐT thì chuyển về /onboarding.
GoRouter buildRouter(SessionController session) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: session,
    redirect: (context, state) {
      if (!session.loaded) return null;
      final onboarding = state.uri.path == '/onboarding';
      if (!session.identified) return onboarding ? null : '/onboarding';
      if (onboarding) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      ShellRoute(
        builder: (_, _, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/', pageBuilder: (_, _) => const NoTransitionPage(child: HomeScreen())),
          GoRoute(path: '/my-feedback', pageBuilder: (_, _) => const NoTransitionPage(child: MyFeedbackScreen())),
          GoRoute(path: '/news', pageBuilder: (_, _) => const NoTransitionPage(child: NewsScreen())),
          GoRoute(path: '/profile', pageBuilder: (_, _) => const NoTransitionPage(child: ProfileScreen())),
        ],
      ),
      GoRoute(path: '/send-feedback', builder: (_, _) => const SendFeedbackScreen()),
      GoRoute(
        path: '/my-feedback/:code',
        builder: (_, state) => FeedbackDetailScreen(code: state.pathParameters['code'] ?? ''),
      ),
      GoRoute(path: '/lookup', builder: (_, _) => const LookupScreen()),
      GoRoute(
        path: '/news/:id',
        builder: (_, state) => NewsDetailScreen(id: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(path: '/radio', builder: (_, _) => const RadioScreen()),
      GoRoute(path: '/video', builder: (_, _) => const VideoScreen()),
      GoRoute(
        path: '/video/:id',
        builder: (_, state) => VideoDetailScreen(id: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(path: '/directory', builder: (_, _) => const DirectoryScreen()),
    ],
  );
}
