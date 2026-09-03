import type { CSSProperties, ReactNode } from "react";
import { useGoBack } from "@/hooks/useGoBack";
import { Icon, type IconName } from "./Icon";
import type { TicketStatus, TimelineStep } from "@/types";

/** Nền nhạt từ màu chính (dùng cho chip/ô icon) */
export function tint(color: string, alpha = 0.12): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

/** Nhãn trạng thái phiếu phản ánh */
export const ticketStatusLabels: Record<TicketStatus, string> = {
  received: "Mới tiếp nhận",
  processing: "Đang xử lý",
  resolved: "Đã xử lý",
};

export const ticketStatusColors: Record<TicketStatus, string> = {
  received: "var(--mut)",
  processing: "var(--blue)",
  resolved: "var(--green)",
};

/** Header của các trang con (có nút quay lại) */
export function SubHeader({ title, action }: { title: string; action?: ReactNode }) {
  const goBack = useGoBack();
  return (
    <div className="subhead">
      <button type="button" className="back" onClick={goBack} aria-label="Quay lại">
        <Icon name="back" size={20} />
      </button>
      <h2>{title}</h2>
      {action}
    </div>
  );
}

/** Tiêu đề khối + hành động "Xem tất cả" */
export function SectionHead({ title, moreLabel = "Xem tất cả", onMore }: { title: string; moreLabel?: string; onMore?: () => void }) {
  return (
    <div className="sec-head">
      <h3>{title}</h3>
      {onMore && (
        <button className="more" onClick={onMore}>
          {moreLabel}
        </button>
      )}
    </div>
  );
}

/** Chip màu */
export function Chip({ label, color, icon, style }: { label: string; color: string; icon?: IconName; style?: CSSProperties }) {
  return (
    <span className="chip" style={{ color, background: tint(color), ...style }}>
      {icon && <Icon name={icon} size={13} strokeWidth={2} />}
      {label}
    </span>
  );
}

/** Ô icon tròn nền nhạt */
export function IconBubble({ name, color, size = 42, iconSize = 21 }: { name: IconName; color: string; size?: number; iconSize?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: tint(color, 0.14),
        color,
        display: "grid",
        placeItems: "center",
        flex: "none",
      }}
    >
      <Icon name={name} size={iconSize} />
    </span>
  );
}

/** Timeline dọc — dùng chung Phản ánh của tôi + Tra cứu hồ sơ */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="tl">
      {steps.map((s, i) => (
        <div key={i} className={`tl-it ${s.current ? "cur" : ""}`}>
          <div className="t">{s.title}</div>
          <div className="m">{s.meta}</div>
        </div>
      ))}
    </div>
  );
}

/** Trạng thái rỗng */
export function EmptyState({ icon, message }: { icon: IconName; message: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={42} color="var(--mut)" />
      <div>{message}</div>
    </div>
  );
}

/** Hàng sao đánh giá (chỉ đọc hoặc chọn được) */
export function StarRating({ value, size = 18, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          onClick={onChange ? () => onChange(i) : undefined}
          style={{ opacity: i <= value ? 1 : 0.25, cursor: onChange ? "pointer" : "default" }}
        >
          <Icon name="star" size={size} fill={i <= value} strokeWidth={1.7} />
        </span>
      ))}
    </span>
  );
}

/** Khối ghi chú màu */
export function Note({ children, color = "var(--blue)", icon = "info" }: { children: ReactNode; color?: string; icon?: IconName }) {
  return (
    <div className="note" style={{ background: tint(color, 0.08), border: `1px solid ${tint(color, 0.3)}`, color: "var(--tx)" }}>
      <Icon name={icon} size={17} color={color} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

/** Nhãn SLA theo số giờ còn lại (âm = quá hạn) */
export function slaLabel(hoursLeft: number): { text: string; color: string; icon: IconName } {
  if (hoursLeft < 0) return { text: `Quá hạn ${-hoursLeft} giờ`, color: "var(--red)", icon: "alert" };
  if (hoursLeft <= 12) return { text: `Còn ${hoursLeft} giờ`, color: "var(--orange)", icon: "clock" };
  return { text: `Còn ${hoursLeft} giờ`, color: "var(--green)", icon: "clock" };
}

/** Định dạng số theo locale VN: 3241 -> "3.241" */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

/** "mm:ss" từ số giây */
export function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
