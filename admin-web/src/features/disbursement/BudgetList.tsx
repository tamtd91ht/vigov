import type { BudgetItem } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatVnd, formatVndShort } from "@/lib/money";
import { Icon } from "@/lib/icons";
import { itemColor, itemPercent, percentLabel } from "./percent";

/**
 * Danh sách hạng mục — mỗi hạng mục một Card, bấm mở ngăn chi tiết.
 *
 * Ba chiều trạng thái hiện RIÊNG, không gộp một nhãn: trạng thái hồ sơ (Nháp /
 * Chờ duyệt / Đã phê duyệt…), mức giải ngân, và tình trạng tiến độ. Một hạng mục
 * có thể vừa "đã giải ngân một phần" vừa "chậm tiến độ" — gộp lại là mất một nửa
 * thông tin cán bộ cần.
 *
 * Số tiền hiện ĐẦY ĐỦ tới đồng ở dòng chính (chỗ đối chiếu chứng từ) và dạng
 * gọn ở dòng phụ (chỗ đọc nhanh).
 */

/** Nhãn thời hạn: quá hạn / đến hạn hôm nay / còn N ngày */
function deadlineNote(item: BudgetItem): { text: string; color: string } | null {
  const days = item.daysLeft;
  if (days === null || days === undefined) return null;
  if (days < 0) return { text: `Quá hạn ${Math.abs(days)} ngày`, color: "var(--red)" };
  if (days === 0) return { text: "Đến hạn hôm nay", color: "var(--orange)" };
  if (days <= 30) return { text: `Còn ${days} ngày`, color: "var(--orange)" };
  return { text: `Còn ${days} ngày`, color: "var(--mut)" };
}

export function BudgetList({
  items,
  onSelect,
}: {
  items: BudgetItem[];
  onSelect: (item: BudgetItem) => void;
}) {
  return (
    <>
      <h3 style={{ fontSize: 15, marginBottom: 12 }}>Danh sách hạng mục ({items.length})</h3>
      {items.map((item) => {
        const percent = itemPercent(item);
        const color = itemColor(item);
        const late = item.scheduleState === "cham";
        const deadline = deadlineNote(item);
        return (
          <Card
            key={item.id}
            style={{
              marginBottom: 14,
              cursor: "pointer",
              ...(late ? { borderLeft: "3px solid var(--red)" } : {}),
            }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(item)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(item)}
            >
              <CardBody style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 14.5 }}>{item.name}</h3>
                      <Chip color={item.fundingColor}>{item.fundingSource}</Chip>
                      {/* Trạng thái hồ sơ — nhãn do máy chủ trả về */}
                      {item.approvalLabel && (
                        <Chip color="var(--navy)">{item.approvalLabel}</Chip>
                      )}
                      {/* Tình trạng tiến độ — chiều thông tin khác hẳn */}
                      {item.scheduleLabel && item.scheduleState !== "dung-tien-do" && (
                        <Chip color={color}>{item.scheduleLabel}</Chip>
                      )}
                    </div>
                    <div
                      className="tiny muted"
                      style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Avatar name={item.owner} /> {item.owner} · Mã {item.id}
                      {item.expenseType ? ` · ${item.expenseType}` : ""}
                      {item.program ? ` · ${item.program}` : ""}
                    </div>
                    {(item.startDate || item.endDate) && (
                      <div
                        className="tiny muted"
                        style={{ marginTop: 4, display: "flex", gap: 5, alignItems: "center" }}
                      >
                        <Icon name="cal" size={12} />
                        {item.startDate || "—"} → {item.endDate || "—"}
                        {deadline && (
                          <span style={{ color: deadline.color, fontWeight: 600 }}>
                            · {deadline.text}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", minWidth: 220 }}>
                    {/* Số đầy đủ tới đồng — đây là chỗ đối chiếu với chứng từ */}
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>
                      {formatVnd(item.actualDong)}
                    </div>
                    <div className="tiny muted">
                      trên kế hoạch {formatVnd(item.plannedDong)}
                    </div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>
                      Còn lại {formatVndShort(item.remainingDong ?? item.plannedDong - item.actualDong)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14 }}>
                  <div style={{ flex: 1 }}>
                    <ProgressBar percent={percent ?? 0} color={color} thick />
                  </div>
                  <b style={{ width: 58, textAlign: "right", color, fontSize: 15 }}>
                    {percentLabel(item)}
                  </b>
                </div>
                {/* Kế hoạch luỹ kế đã tới hạn so với thực tế — căn cứ của kết luận
                    tiến độ, hiện ra để cán bộ không phải tin một cái nhãn suông */}
                {item.planCumulativeDong !== undefined && item.planCumulativeDong > 0 && (
                  <div className="tiny muted" style={{ marginTop: 8 }}>
                    Kế hoạch luỹ kế đã tới hạn: {formatVndShort(item.planCumulativeDong)} · Thực tế:{" "}
                    {formatVndShort(item.actualDong)}
                  </div>
                )}
              </CardBody>
            </div>
          </Card>
        );
      })}
    </>
  );
}
