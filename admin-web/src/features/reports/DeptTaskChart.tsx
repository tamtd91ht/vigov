import type { DeptTaskStat } from "@/services/reports.service";

/** Màu nhận diện bộ phận — gán theo thứ tự API trả về, quay vòng khi hết màu */
const DEPT_COLORS = [
  "var(--navy)",
  "var(--blue)",
  "var(--green)",
  "var(--purple)",
  "var(--orange)",
  "var(--teal)",
  "var(--red)",
  "var(--pink)",
] as const;

/** Biểu đồ thanh ngang: số nhiệm vụ theo bộ phận (mỗi bộ phận một màu nhận diện) */
export function DeptTaskChart({ data }: { data: DeptTaskStat[] }) {
  // max tối thiểu là 1 để không chia cho 0 khi kỳ báo cáo chưa có nhiệm vụ nào
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div className="hbar-row" key={d.department}>
          <span
            className="muted"
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={d.department}
          >
            {d.department}
          </span>
          <div className="hbar">
            <i style={{ width: `${(d.total / max) * 100}%`, background: DEPT_COLORS[i % DEPT_COLORS.length] }} />
          </div>
          <b style={{ textAlign: "right", color: "var(--navy)" }}>{d.total}</b>
        </div>
      ))}
    </div>
  );
}
