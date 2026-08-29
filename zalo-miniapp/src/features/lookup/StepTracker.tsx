import { Icon } from "@/components/Icon";
import { tint } from "@/components/common";

/** Đường kính chấm tròn mỗi bước (px) */
const DOT_SIZE = 26;
/** Độ dày vạch nối giữa các chấm (px) */
const LINE_THICKNESS = 2.5;

/**
 * Tracker ngang các bước xử lý hồ sơ một cửa (WBS #15).
 * Bước đã qua = nền xanh + icon check, bước hiện tại = viền cam + vòng sáng + icon clock,
 * bước chưa tới = xám (hiện số thứ tự).
 */
export function StepTracker({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {steps.map((label, i) => (
        <StepItem key={label} label={label} index={i} total={steps.length} currentStep={currentStep} />
      ))}
    </div>
  );
}

function StepItem({
  label,
  index,
  total,
  currentStep,
}: {
  label: string;
  index: number;
  total: number;
  currentStep: number;
}) {
  const stepNo = index + 1; // steps là 1-based
  const done = stepNo < currentStep;
  const current = stepNo === currentStep;

  // Vạch nối: xanh cho đoạn đường hồ sơ đã đi qua
  const leftColor = stepNo <= currentStep ? "var(--green)" : "var(--bd)";
  const rightColor = stepNo < currentStep ? "var(--green)" : "var(--bd)";

  const labelColor = current ? "var(--orange)" : done ? "var(--navy)" : "var(--mut)";

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", width: "100%", height: DOT_SIZE + 8 }}>
        <span style={{ flex: 1, height: LINE_THICKNESS, background: index === 0 ? "transparent" : leftColor }} />
        <StepDot done={done} current={current} stepNo={stepNo} />
        <span
          style={{ flex: 1, height: LINE_THICKNESS, background: index === total - 1 ? "transparent" : rightColor }}
        />
      </div>
      <div
        style={{
          marginTop: 4,
          padding: "0 2px",
          fontSize: ".67rem",
          lineHeight: 1.28,
          fontWeight: current ? 700 : 500,
          color: labelColor,
          textAlign: "center",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function StepDot({ done, current, stepNo }: { done: boolean; current: boolean; stepNo: number }) {
  const background = done ? "var(--green)" : "#fff";
  const border = done ? "var(--green)" : current ? "var(--orange)" : "var(--bd)";

  return (
    <span
      style={{
        width: DOT_SIZE,
        height: DOT_SIZE,
        flex: "none",
        borderRadius: "50%",
        background,
        border: `2px solid ${border}`,
        display: "grid",
        placeItems: "center",
        // Vòng sáng quanh bước đang xử lý
        boxShadow: current
          ? `0 0 0 4px ${tint("var(--orange)", 0.28)}, 0 0 0 8px ${tint("var(--orange)", 0.13)}`
          : undefined,
      }}
    >
      {done ? (
        <Icon name="check" size={14} strokeWidth={2.6} color="#fff" />
      ) : current ? (
        <Icon name="clock" size={15} strokeWidth={2} color="var(--orange)" />
      ) : (
        <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--mut)" }}>{stepNo}</span>
      )}
    </span>
  );
}
