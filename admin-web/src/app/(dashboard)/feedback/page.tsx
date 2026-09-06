import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackPage } from "@/features/feedback/FeedbackPage";

export const metadata: Metadata = { title: "Phản ánh người dân" };

/*
 * Bọc Suspense vì FeedbackPage đọc tham số truy vấn (?code) bằng `useSearchParams`
 * để mở sẵn ngăn chi tiết bản ghi. Trang được dựng sẵn dạng tĩnh, mà tham số
 * truy vấn chỉ biết được ở trình duyệt — không có ranh giới Suspense thì Next
 * báo lỗi khi dựng bản phát hành.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <FeedbackPage />
    </Suspense>
  );
}
