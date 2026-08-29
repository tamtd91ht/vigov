import type { Metadata } from "next";
import { UsersPage } from "@/features/users/UsersPage";

export const metadata: Metadata = { title: "Người dùng Mini App" };

export default function Page() {
  return <UsersPage />;
}
