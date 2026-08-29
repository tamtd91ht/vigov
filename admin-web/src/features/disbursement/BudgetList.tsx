import type { BudgetItem } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatBillion } from "@/lib/format";
import { itemColor, itemPercent } from "./percent";

/** Danh sách hạng mục đầu tư — mỗi hạng mục một Card, bấm mở drawer chi tiết */
export function BudgetList({ items, onSelect }: { items: BudgetItem[]; onSelect: (item: BudgetItem) => void }) {
  return (
    <>
      <h3 style={{ fontSize: 15, marginBottom: 12 }}>Danh sách hạng mục ({items.length})</h3>
      {items.map((item) => {
        const pct = itemPercent(item);
        const color = itemColor(item);
        return (
          <Card
            key={item.id}
            style={{
              marginBottom: 14,
              cursor: "pointer",
              ...(item.delayed ? { borderLeft: "3px solid var(--red)" } : {}),
            }}
          >
            <div role="button" tabIndex={0} onClick={() => onSelect(item)} onKeyDown={(e) => e.key === "Enter" && onSelect(item)}>
              <CardBody style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 14.5 }}>{item.name}</h3>
                      <Chip color={item.fundingColor}>{item.fundingSource}</Chip>
                      {item.delayed && (
                        <Chip color="var(--red)" tint="rgba(231,76,60,.10)">
                          Chậm tiến độ
                        </Chip>
                      )}
                    </div>
                    <div className="tiny muted" style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                      <Avatar name={item.owner} /> Phụ trách: {item.owner} · Mã hạng mục {item.id}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 150 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)" }}>
                      {formatBillion(item.actual)} / {formatBillion(item.planned)}
                    </div>
                    <div className="tiny muted">Đã giải ngân / Kế hoạch vốn</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14 }}>
                  <div style={{ flex: 1 }}>
                    <ProgressBar percent={pct} color={color} thick />
                  </div>
                  <b style={{ width: 52, textAlign: "right", color, fontSize: 15 }}>{pct}%</b>
                </div>
              </CardBody>
            </div>
          </Card>
        );
      })}
    </>
  );
}
