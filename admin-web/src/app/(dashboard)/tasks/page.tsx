import type { Metadata } from "next";
import { TasksPage } from "@/features/tasks/TasksPage";

export const metadata: Metadata = { title: "Nhiệm vụ" };

export default function Page() {
  return <TasksPage />;
}
