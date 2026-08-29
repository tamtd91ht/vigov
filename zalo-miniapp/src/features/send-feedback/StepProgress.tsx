import { Fragment } from "react";
import { Icon } from "@/components/Icon";

/** Nhãn 3 bước của luồng gửi phản ánh */
const STEP_LABELS = ["Danh mục", "Nội dung", "Xác nhận"] as const;
const DOT_SIZE = 30;
const LINE_HEIGHT = 2;

/** Thanh tiến trình 3 bước — chấm hiện tại màu pink, bước đã xong hiện icon check */
export function StepProgress({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        background: "#fff",
        borderBottom: "1px solid var(--bd)",
        padding: "14px var(--pad) 12px",
      }}
    >
      {STEP_LABELS.map((label, i) => {
        const stepNo = i + 1;
        const done = stepNo < current;
        const active = stepNo === current;
        const dotColor = done ? "var(--green)" : active ? "var(--pink)" : "var(--bd)";
        return (
          <Fragment key={label}>
            {i > 0 && (
              <div
                aria-hidden
                style={{
                  flex: 1,
                  height: LINE_HEIGHT,
                  borderRadius: LINE_HEIGHT,
                  marginTop: DOT_SIZE / 2 - LINE_HEIGHT / 2,
                  background: stepNo <= current ? "var(--pink)" : "var(--bd)",
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 82 }}>
              <span
                style={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: ".82rem",
                  fontWeight: 700,
                  border: `1.5px solid ${dotColor}`,
                  background: done || active ? dotColor : "#fff",
                  color: done || active ? "#fff" : "var(--mut)",
                }}
              >
                {done ? <Icon name="check" size={15} strokeWidth={2.6} /> : stepNo}
              </span>
              <span
                className="tiny"
                style={{
                  fontWeight: active ? 700 : 600,
                  color: active ? "var(--pink)" : done ? "var(--navy)" : "var(--mut)",
                  textAlign: "center",
                  lineHeight: 1.25,
                }}
              >
                {label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
