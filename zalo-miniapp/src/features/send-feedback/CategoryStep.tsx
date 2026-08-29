import { IconBubble, Note, tint } from "@/components/common";
import { feedbackCategories, slaText, type FeedbackCategory } from "@/config/categories";

const TILE_PADDING = "13px 6px";
const BUBBLE_SIZE = 40;

/** Bước 1 — chọn 1 trong 12 danh mục phản ánh */
export function CategoryStep({
  selected,
  onSelect,
}: {
  selected: FeedbackCategory | null;
  onSelect: (category: FeedbackCategory) => void;
}) {
  return (
    <>
      <div className="fgroup">
        <label>
          Danh mục phản ánh <span className="req">*</span>
        </label>
        <div className="fhint" style={{ marginTop: 0, marginBottom: 10 }}>
          Chọn đúng danh mục giúp phản ánh được chuyển tới bộ phận xử lý nhanh hơn.
        </div>
        <div className="grid3">
          {feedbackCategories.map((c) => {
            const on = selected?.key === c.key;
            return (
              <button
                key={c.key}
                type="button"
                className="card"
                aria-pressed={on}
                onClick={() => onSelect(c)}
                style={{
                  padding: TILE_PADDING,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "center",
                  borderColor: on ? c.color : "var(--bd)",
                  background: on ? tint(c.color, 0.1) : "#fff",
                  boxShadow: on ? `0 0 0 1px ${c.color}` : "var(--sh)",
                }}
              >
                <IconBubble name={c.icon} color={c.color} size={BUBBLE_SIZE} iconSize={20} />
                <span className="tiny" style={{ fontWeight: 600, color: "var(--navy)", lineHeight: 1.3 }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <Note color={selected.color} icon="clock">
          <b style={{ color: "var(--navy)" }}>{selected.label}</b>
          <div style={{ marginTop: 2 }}>{slaText(selected)}</div>
        </Note>
      )}
    </>
  );
}
