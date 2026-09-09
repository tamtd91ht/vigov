import type { Metadata } from "next";
import { CmsPage } from "@/features/cms/CmsPage";

export const metadata: Metadata = {
  title: "Nội dung Mini App — ViGov",
};

export default function Page() {
  return <CmsPage />;
}
