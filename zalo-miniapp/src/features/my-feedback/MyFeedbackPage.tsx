import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chip,
  IconBubble,
  StarRating,
  slaLabel,
  ticketStatusColors,
  ticketStatusLabels,
} from "@/components/common";
import { DataState } from "@/components/DataState";
import { categoryOf } from "@/config/categories";
import { useFeedback } from "@/state/FeedbackContext";
import type { FeedbackTicket, TicketStatus } from "@/types";

/** ===== Hằng số hiển thị ===== */
const PAGE_TITLE = "Phản ánh của tôi";
const ALL_KEY = "all";
const ALL_LABEL = "Tất cả";
const EMPTY_MESSAGE = "Chưa có phản ánh nào ở trạng thái này";
const TITLE_CLAMP_LINES = 2;
const RATING_STAR_SIZE = 13;

/** Thứ tự chip lọc lấy đúng theo nhãn dùng chung, không hardcode chuỗi rời */
const STATUS_KEYS = Object.keys(ticketStatusLabels) as TicketStatus[];

type FilterKey = TicketStatus | typeof ALL_KEY;

const rowStyle: CSSProperties = { display: "flex", gap: 12, alignItems: "flex-start" };
const bodyStyle: CSSProperties = { flex: 1, minWidth: 0 };
const codeStyle: CSSProperties = { fontWeight: 700 };
const titleStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: TITLE_CLAMP_LINES,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  color: "var(--navy)",
  fontWeight: 600,
  lineHeight: 1.4,
  margin: "2px 0 4px",
};
const metaStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const tagsStyle: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 9 };
const listStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 12, marginTop: 14 };

export function MyFeedbackPage() {
  const navigate = useNavigate();
  const { tickets, loading, error, reload } = useFeedback();
  const [filter, setFilter] = useState<FilterKey>(ALL_KEY);

  /** Số đếm cho từng chip lọc */
  const counts = useMemo(() => {
    const map = {} as Record<TicketStatus, number>;
    for (const key of STATUS_KEYS) map[key] = 0;
    for (const t of tickets) map[t.status] += 1;
    return map;
  }, [tickets]);

  const visible = useMemo(
    () => (filter === ALL_KEY ? tickets : tickets.filter((t) => t.status === filter)),
    [tickets, filter],
  );

  const openTicket = (code: string) => navigate(`/my-feedback/${encodeURIComponent(code)}`);

  return (
    <>
      <div className="subhead">
        <h2>{PAGE_TITLE}</h2>
      </div>

      <div className="page">
        <div className="chips-row">
          <FilterChip
            label={ALL_LABEL}
            count={tickets.length}
            active={filter === ALL_KEY}
            onClick={() => setFilter(ALL_KEY)}
          />
          {STATUS_KEYS.map((key) => (
            <FilterChip
              key={key}
              label={ticketStatusLabels[key]}
              count={counts[key]}
              active={filter === key}
              onClick={() => setFilter(key)}
            />
          ))}
        </div>

        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          empty={visible.length === 0}
          emptyIcon="chat"
          emptyMessage={EMPTY_MESSAGE}
        >
          <div style={listStyle}>
            {visible.map((t) => (
              <TicketCard key={t.code} ticket={t} onOpen={() => openTicket(t.code)} />
            ))}
          </div>
        </DataState>
      </div>
    </>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`fchip ${active ? "on" : ""}`} onClick={onClick}>
      {label} ({count})
    </button>
  );
}

function TicketCard({ ticket, onOpen }: { ticket: FeedbackTicket; onOpen: () => void }) {
  const cat = categoryOf(ticket.categoryKey);
  const sla = slaLabel(ticket.slaHoursLeft);

  return (
    <div className="card card-b tap" onClick={onOpen} style={rowStyle}>
      <IconBubble name={cat.icon} color={cat.color} />
      <div style={bodyStyle}>
        <div className="tiny muted" style={codeStyle}>
          {ticket.code}
        </div>
        <div style={titleStyle}>{ticket.title}</div>
        <div className="tiny muted" style={metaStyle}>
          {ticket.sentAt} · {ticket.location}
        </div>
        <div style={tagsStyle}>
          <Chip label={ticketStatusLabels[ticket.status]} color={ticketStatusColors[ticket.status]} />
          {ticket.status === "processing" && <Chip label={sla.text} color={sla.color} icon={sla.icon} />}
          {ticket.status === "resolved" && ticket.rating > 0 && (
            <StarRating value={ticket.rating} size={RATING_STAR_SIZE} />
          )}
        </div>
      </div>
    </div>
  );
}
