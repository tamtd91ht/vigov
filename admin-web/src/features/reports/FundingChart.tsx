import { formatBillion } from "@/lib/format";
import type { FundingStat } from "@/services/reports.service";

/** Màu cột kế hoạch (nhạt) / thực hiện (đậm) — đơn vị tỷ đồng */
const PLAN_COLOR = "#DCE7F2";
const ACTUAL_COLOR = "var(--green)";

/** Rút gọn tên nguồn vốn cho nhãn dưới cột */
const SHORT_RULES: [RegExp, string][] = [
  [/^Ngân sách\s+/i, "NS "],
  [/^Chương trình mục tiêu\s+/i, "CTMT "],
  [/^Vốn sự nghiệp\s+/i, "Vốn SN "],
];

/** Độ dài tối đa của nhãn rút gọn trước khi cắt bớt */
const SHORT_MAX_LENGTH = 18;

function shortFundingName(name: string): string {
  for (const [pattern, replacement] of SHORT_RULES) {
    if (pattern.test(name)) return name.replace(pattern, replacement).trim();
  }
  return name.length > SHORT_MAX_LENGTH ? `${name.slice(0, SHORT_MAX_LENGTH - 1)}…` : name;
}

/** Biểu đồ cột đôi: giải ngân theo nguồn vốn (kế hoạch nhạt vs thực tế đậm) */
export function FundingChart({ data }: { data: FundingStat[] }) {
  // max tối thiểu là 1 để không chia cho 0 khi chưa giao kế hoạch nguồn vốn nào
  const max = Math.max(1, ...data.map((d) => Math.max(d.planned, d.actual)));
  return (
    <div className="bars">
      {data.map((d) => (
        <div
          className="col"
          key={d.fundingSource}
          title={`${d.fundingSource}: ${formatBillion(d.actual)} / ${formatBillion(d.planned)} đồng`}
        >
          <div className="stack">
            <div className="bar" style={{ height: `${(d.planned / max) * 100}%`, background: PLAN_COLOR }} />
            <div className="bar" style={{ height: `${(d.actual / max) * 100}%`, background: ACTUAL_COLOR }} />
          </div>
          <div className="lbl" style={{ textAlign: "center", lineHeight: 1.25 }}>
            {shortFundingName(d.fundingSource)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Chú giải dùng ở header card */
export function FundingLegend() {
  return (
    <span className="legend">
      <span>
        <i style={{ background: PLAN_COLOR }} />
        Kế hoạch
      </span>
      <span>
        <i style={{ background: ACTUAL_COLOR }} />
        Thực hiện
      </span>
    </span>
  );
}
