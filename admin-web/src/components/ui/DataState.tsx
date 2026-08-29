import type { ReactNode } from "react";
import { Icon } from "@/lib/icons";

/**
 * Bọc phần nội dung phụ thuộc API: hiện vòng quay khi đang tải,
 * thông báo kèm nút thử lại khi lỗi, còn lại render nội dung.
 */
export function DataState({
  loading,
  error,
  onRetry,
  empty,
  emptyMessage = "Chưa có dữ liệu",
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  /** true khi tải xong nhưng danh sách rỗng */
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="empty">
        <span className="spinner" />
        <div style={{ marginTop: 10 }}>Đang tải dữ liệu…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty">
        <Icon name="alert" size={34} />
        <div style={{ marginTop: 10, color: "var(--red)" }}>{error}</div>
        {onRetry && (
          <button className="btn sm" style={{ marginTop: 12 }} onClick={onRetry} type="button">
            Thử lại
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="empty">
        <Icon name="file" size={34} />
        <div style={{ marginTop: 10 }}>{emptyMessage}</div>
      </div>
    );
  }

  return <>{children}</>;
}
