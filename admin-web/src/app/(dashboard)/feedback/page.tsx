import type { Metadata } from "next";
import { FeedbackPage } from "@/features/feedback/FeedbackPage";

export const metadata: Metadata = { title: "Phản ánh người dân" };

export default function Page() {
  return <FeedbackPage />;
}
