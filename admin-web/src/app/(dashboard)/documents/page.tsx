import type { Metadata } from "next";
import { DocumentsPage } from "@/features/documents/DocumentsPage";

export const metadata: Metadata = { title: "Văn bản & Đơn thư" };

export default function Page() {
  return <DocumentsPage />;
}
