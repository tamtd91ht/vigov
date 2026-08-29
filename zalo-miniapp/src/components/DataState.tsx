import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Bọc phần nội dung phụ thuộc API: hiện vòng quay khi đang tải,
 * thông báo kèm nút thử lại khi lỗi, còn lại render nội dung.
 *
 * Cùng khuôn với admin-web/src/components/ui/DataState.tsx, dựng lại bằng
 * lớp CSS của Mini App (.empty cho khối trạng thái, .spin.dark cho vòng quay
 * trên nền sáng).
 */
export function DataState({
  loading,
  error,
  onRetry,
  empty,
  emptyIcon = "file",
  emptyMessage = "Chưa có dữ liệu",
  loadingMessage = "Đang tải dữ liệu…",
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  /** true khi tải xong nhưng danh sách rỗng */
  empty?: boolean;
  emptyIcon?: IconName;
  emptyMessage?: string;
  loadingMessage?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="empty">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span className="spin dark" />
        </div>
        <div style={{ marginTop: 10 }}>{loadingMessage}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty">
        <Icon name="alert" size={34} color="var(--red)" />
        <div style={{ marginTop: 10, color: "var(--red)" }}>{error}</div>
        {onRetry && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <button className="btn sm" type="button" onClick={onRetry}>
              <Icon name="history" size={15} />
              Thử lại
            </button>
          </div>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="empty">
        <Icon name={emptyIcon} size={34} color="var(--mut)" />
        <div style={{ marginTop: 10 }}>{emptyMessage}</div>
      </div>
    );
  }

  return <>{children}</>;
}
