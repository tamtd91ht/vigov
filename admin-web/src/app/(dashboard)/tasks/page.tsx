import type { Metadata } from "next";
import { Suspense } from "react";
import { TasksPage } from "@/features/tasks/TasksPage";

export const metadata: Metadata = { title: "Nhiệm vụ" };

/*
 * Bọc Suspense vì TasksPage đọc tham số truy vấn (?code) bằng `useSearchParams`
 * để mở sẵn ngăn chi tiết bản ghi. Trang được dựng sẵn dạng tĩnh, mà tham số
 * truy vấn chỉ biết được ở trình duyệt — không có ranh giới Suspense thì Next
 * báo lỗi khi dựng bản phát hành.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <TasksPage />
    </Suspense>
  );
}
