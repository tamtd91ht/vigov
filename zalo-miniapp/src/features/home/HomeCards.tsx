import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { Chip, IconBubble, slaLabel, ticketStatusColors, ticketStatusLabels } from "@/components/common";
import { categoryOf } from "@/config/categories";
import type { QuickAction } from "@/config/nav.config";
import type { Article, FeedbackTicket } from "@/types";

/** Cắt chữ tối đa N dòng (không dùng Tailwind nên đặt inline) */
export function clamp(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

const tileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "14px 6px 12px",
  textAlign: "center",
};

/** Một ô truy cập nhanh trong lưới 3 cột */
export function QuickActionTile({ action, onClick }: { action: QuickAction; onClick: () => void }) {
  return (
    <button className="card tap" style={tileStyle} onClick={onClick}>
      <IconBubble name={action.icon} color={action.color} size={44} iconSize={22} />
      <span
        style={{
          fontSize: ".76rem",
          fontWeight: 600,
          color: "var(--navy)",
          lineHeight: 1.35,
          minHeight: "2.1em",
          ...clamp(2),
        }}
      >
        {action.label}
      </span>
    </button>
  );
}

/** Thẻ phiếu phản ánh mới nhất ở Trang chủ */
export function LatestTicketCard({ ticket, onClick }: { ticket: FeedbackTicket; onClick: () => void }) {
  const category = categoryOf(ticket.categoryKey);
  const sla = ticket.status === "processing" ? slaLabel(ticket.slaHoursLeft) : null;

  return (
    <div className="card card-b tap" onClick={onClick} style={{ display: "flex", gap: 12 }}>
      <IconBubble name={category.icon} color={category.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: ".3px" }}>
          {ticket.code}
        </div>
        <div
          style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--navy)", margin: "3px 0 8px", ...clamp(2) }}
        >
          {ticket.title}
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Chip label={ticketStatusLabels[ticket.status]} color={ticketStatusColors[ticket.status]} />
          {sla && <Chip label={sla.text} color={sla.color} icon={sla.icon} />}
        </div>
      </div>
      <Icon name="right" size={18} color="var(--mut)" />
    </div>
  );
}

/** Một hàng tin tức ở Trang chủ */
export function NewsRow({ article, onClick }: { article: Article; onClick: () => void }) {
  return (
    <div className="card card-b tap" onClick={onClick} style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <span className="thumb" style={{ width: 56, height: 56, background: article.coverColor }}>
        <Icon name="news" size={24} color="#fff" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".87rem", fontWeight: 600, color: "var(--navy)", lineHeight: 1.4, ...clamp(2) }}>
          {article.title}
        </div>
        <div className="tiny muted" style={{ marginTop: 5 }}>
          {article.category} · {article.publishedAt}
        </div>
      </div>
    </div>
  );
}
