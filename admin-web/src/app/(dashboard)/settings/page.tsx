import type { Metadata } from "next";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const metadata: Metadata = { title: "Cấu hình" };

export default function Page() {
  return <SettingsPage />;
}
