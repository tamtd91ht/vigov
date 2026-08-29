"use client";

import type { CitizenFeedback } from "@/types";
import { findCategoryIn, useCategoryDirectory } from "@/services/category-directory";
import { feedbackStatuses, findStatus } from "@/config/status.config";
import { slaLabel } from "@/lib/format";
import { Icon } from "@/lib/icons";
import { Chip } from "@/components/ui/Chip";
import { StarRating } from "@/components/ui/StarRating";
import { UNASSIGNED } from "@/config/status.config";

/** Nền cover "ảnh hiện trường": gradient từ màu lĩnh vực sang tông đậm hơn */
export function categoryCover(color: string): string {
  return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 68%, #16314e))`;
}

function FeedbackCard({ item, onOpen }: { item: CitizenFeedback; onOpen: (code: string) => void }) {
  const categories = useCategoryDirectory();
  const cat = findCategoryIn(categories, item.categoryLabel);
  const status = findStatus(feedbackStatuses, item.status);
  const resolved = item.status === "Đã xử lý";
  const sla = slaLabel(item.slaHoursLeft, resolved);
  const unassigned = item.assignee === UNASSIGNED;

  return (
    <div className="fb" onClick={() => onOpen(item.code)} role="button">
      <div className="img" style={{ background: categoryCover(cat.color) }}>
        <span style={{ opacity: 0.92 }}>ẢNH HIỆN TRƯỜNG · {item.categoryLabel.toUpperCase()}</span>
      </div>
      <div className="in">
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <span className="cd">{item.code}</span>
          <Chip color={status.color} tint={status.tint}>
            {status.label}
          </Chip>
        </div>
        <div className="ti">{item.title}</div>
        <div className="ex">{item.excerpt}</div>
        {unassigned && (
          <div
            className="tiny"
            style={{ color: "var(--orange)", fontWeight: 700, display: "flex", gap: 5, alignItems: "center", marginBottom: 8 }}
          >
            <Icon name="alert" size={13} />
            Chưa phân công cán bộ xử lý
          </div>
        )}
        <div className="ft">
          <Chip color={cat.color}>{item.categoryLabel}</Chip>
          {resolved && item.rating > 0 ? (
            <StarRating value={item.rating} />
          ) : (
            <span className="sla" style={{ color: sla.color }}>
              <Icon name={item.slaHoursLeft < 0 && !resolved ? "alert" : "clock"} size={13} />
              {sla.text}
            </span>
          )}
          <span className="tiny muted" style={{ marginLeft: "auto", display: "inline-flex", gap: 4, alignItems: "center" }}>
            <Icon name="pin" size={12} />
            {item.location}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Lưới phiếu phản ánh */
export function FeedbackGrid({ items, onOpen }: { items: CitizenFeedback[]; onOpen: (code: string) => void }) {
  if (!items.length) {
    return (
      <div className="card">
        <div className="card-b muted" style={{ textAlign: "center", padding: 44 }}>
          Không có phiếu phản ánh nào khớp bộ lọc đã chọn.
        </div>
      </div>
    );
  }
  return (
    <div className="grid3">
      {items.map((item) => (
        <FeedbackCard key={item.code} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}
