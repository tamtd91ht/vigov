import type { Metadata } from "next";
import { DisbursementPage } from "@/features/disbursement/DisbursementPage";

export const metadata: Metadata = {
  title: "Giải ngân",
};

export default function Page() {
  return <DisbursementPage />;
}
