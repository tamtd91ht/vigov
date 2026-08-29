import { findCategory } from "@/config/sla.config";
import type { CategoryStat } from "@/services/reports.service";

/** Biểu đồ thanh ngang: phản ánh theo lĩnh vực — nhãn và màu tra từ findCategory theo categoryKey */
export function CategoryChart({ data }: { data: CategoryStat[] }) {
  // max tối thiểu là 1 để không chia cho 0 khi kỳ báo cáo chưa có phản ánh
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="hbars">
      {data.map((d) => {
        const category = findCategory(d.categoryKey);
        return (
          <div className="hbar-row" key={d.categoryKey} title={`${category.label}: ${d.total} lượt`}>
            <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {category.label}
            </span>
            <div className="hbar">
              <i style={{ width: `${(d.total / max) * 100}%`, background: category.color }} />
            </div>
            <b style={{ textAlign: "right", color: "var(--navy)" }}>{d.total}</b>
          </div>
        );
      })}
    </div>
  );
}
