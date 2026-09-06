import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile/ProfilePage";

export const metadata: Metadata = { title: "Hồ sơ cá nhân" };

export default function Page() {
  return <ProfilePage />;
}
