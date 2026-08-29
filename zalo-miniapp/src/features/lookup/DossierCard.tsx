import { Chip } from "@/components/common";
import type { DossierResult } from "@/types";
import { StepTracker } from "./StepTracker";

/** Tổng số bước của quy trình một cửa — bước cuối = đã có kết quả */
const TOTAL_STEPS = 4;

/** Bề rộng cột nhãn của các dòng thông tin (px) */
const LABEL_WIDTH = 118;

/** Card kết quả tra cứu: thông tin hồ sơ + tracker các bước xử lý (WBS #15). */
export function DossierCard({ result }: { result: DossierResult }) {
  const finished = result.currentStep >= TOTAL_STEPS;
  const statusColor = finished ? "var(--green)" : "var(--blue)";
  const statusLabel = finished ? result.statusLabel : "Đang xử lý";

  return (
    <div className="card card-b">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, color: "var(--navy)", fontSize: "1rem", fontWeight: 800, letterSpacing: ".2px" }}>
          {result.code}
        </div>
        <Chip label={statusLabel} color={statusColor} icon={finished ? "ok" : "clock"} />
      </div>

      <div style={{ marginTop: 12 }}>
        <InfoRow label="Thủ tục" value={result.procedure} />
        <InfoRow label="Người nộp" value={result.applicant} />
        <InfoRow label="Cán bộ phụ trách" value={result.officer} />
        <InfoRow label="Ngày nộp" value={result.submittedAt} />
        <InfoRow label="Hẹn trả" value={result.expectedAt} />
      </div>

      <div className="divider" />

      <h3 style={{ fontSize: ".92rem" }}>Tiến độ xử lý</h3>
      <div style={{ marginTop: 14 }}>
        <StepTracker steps={result.steps} currentStep={result.currentStep} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
      <span className="muted tiny" style={{ width: LABEL_WIDTH, flex: "none" }}>
        {label}
      </span>
      <span className="sm" style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
