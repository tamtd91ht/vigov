import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentsPage } from "@/features/documents/DocumentsPage";

export const metadata: Metadata = { title: "Văn bản & Đơn thư" };

/*
 * Bọc Suspense vì DocumentsPage đọc tham số truy vấn (?arrivalNo) bằng `useSearchParams`
 * để mở sẵn ngăn chi tiết bản ghi. Trang được dựng sẵn dạng tĩnh, mà tham số
 * truy vấn chỉ biết được ở trình duyệt — không có ranh giới Suspense thì Next
 * báo lỗi khi dựng bản phát hành.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentsPage />
    </Suspense>
  );
}
