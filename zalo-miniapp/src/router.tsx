import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useSession } from "@/state/SessionContext";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { HomePage } from "@/features/home/HomePage";
import { SendFeedbackPage } from "@/features/send-feedback/SendFeedbackPage";
import { MyFeedbackPage } from "@/features/my-feedback/MyFeedbackPage";
import { FeedbackDetailPage } from "@/features/my-feedback/FeedbackDetailPage";
import { LookupPage } from "@/features/lookup/LookupPage";
import { NewsPage } from "@/features/news/NewsPage";
import { NewsDetailPage } from "@/features/news/NewsDetailPage";
import { RadioPage } from "@/features/radio/RadioPage";
import { VideoPage } from "@/features/video/VideoPage";
import { VideoDetailPage } from "@/features/video/VideoDetailPage";
import { DirectoryPage } from "@/features/directory/DirectoryPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { CccdScanPage } from "@/features/idcard/CccdScanPage";
import { MapPage } from "@/features/map/MapPage";

/** Chưa định danh SĐT Zalo thì đưa về màn onboarding */
function RequireIdentity() {
  const { identified } = useSession();
  return identified ? <Outlet /> : <Navigate to="/onboarding" replace />;
}

/** Đã định danh thì không quay lại onboarding */
function RedirectIfIdentified() {
  const { identified } = useSession();
  return identified ? <Navigate to="/" replace /> : <OnboardingPage />;
}

export const router = createBrowserRouter([
  { path: "/onboarding", element: <RedirectIfIdentified /> },
  {
    element: <RequireIdentity />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/my-feedback", element: <MyFeedbackPage /> },
          { path: "/news", element: <NewsPage /> },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
      { path: "/send-feedback", element: <SendFeedbackPage /> },
      { path: "/my-feedback/:code", element: <FeedbackDetailPage /> },
      { path: "/lookup", element: <LookupPage /> },
      { path: "/news/:id", element: <NewsDetailPage /> },
      { path: "/radio", element: <RadioPage /> },
      { path: "/video", element: <VideoPage /> },
      { path: "/video/:id", element: <VideoDetailPage /> },
      { path: "/directory", element: <DirectoryPage /> },
      { path: "/cccd", element: <CccdScanPage /> },
      { path: "/map", element: <MapPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
