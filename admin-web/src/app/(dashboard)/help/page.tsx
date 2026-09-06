import type { Metadata } from "next";
import { HelpPage } from "@/features/help/HelpPage";

export const metadata: Metadata = { title: "Trợ giúp" };

export default function Page() {
  return <HelpPage />;
}
