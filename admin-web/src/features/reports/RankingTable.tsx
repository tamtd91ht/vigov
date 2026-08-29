import { Chip } from "@/components/ui/Chip";
import type { DeptRanking } from "@/services/reports.service";

/* ---- Cấu hình cục bộ (hằng số đầu file) ---- */

/** Màu huy chương top 3: vàng / bạc / đồng */
const MEDAL_COLORS = ["#D4A017", "#9AA8B6", "#B87333"] as const;

/** Ngưỡng xếp loại tỷ lệ đúng hạn (%) */
const RATE_GOOD = 90; // >= 90: xanh
const RATE_WARN = 80; // >= 80: cam; còn lại: đỏ

/** Số việc trễ hạn từ mức này trở lên thì tô đỏ */
const LATE_ALERT_THRESHOLD = 3;

/** Backend chưa thống kê thời gian xử lý trung bình — hiển thị gạch ngang */
const NO_VALUE = "—";

function rateStyle(rate: number): { color: string; tint: string } {
  if (rate >= RATE_GOOD) return { color: "var(--green)", tint: "rgba(39,174,96,.12)" };
  if (rate >= RATE_WARN) return { color: "var(--orange)", tint: "rgba(230,126,34,.12)" };
  return { color: "var(--red)", tint: "rgba(231,76,60,.12)" };
}

/** Bảng xếp hạng bộ phận theo tỷ lệ xử lý đúng hạn (backend đã xếp sẵn thứ hạng) */
export function RankingTable({ data }: { data: DeptRanking[] }) {
  return (
    <div className="tw">
      <table className="tb2">
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Bộ phận</th>
            <th>Tổng nhiệm vụ</th>
            <th>Đúng hạn</th>
            <th>Trễ hạn</th>
            <th>Tỷ lệ đúng hạn</th>
            <th>Thời gian xử lý TB</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const rate = Math.round(r.onTimeRate);
            const { color, tint } = rateStyle(rate);
            const medal = MEDAL_COLORS[r.rank - 1];
            return (
              <tr key={r.department} style={{ cursor: "default" }}>
                <td>
                  {medal ? (
                    <span className="medal" style={{ background: medal }}>
                      {r.rank}
                    </span>
                  ) : (
                    <span className="muted" style={{ paddingLeft: 8 }}>{r.rank}</span>
                  )}
                </td>
                <td className="tt">{r.department}</td>
                <td>{r.total}</td>
                <td style={{ color: "var(--green)", fontWeight: 600 }}>{r.onTime}</td>
                <td style={{ color: r.late > LATE_ALERT_THRESHOLD ? "var(--red)" : "var(--tx)", fontWeight: 600 }}>{r.late}</td>
                <td>
                  <Chip color={color} tint={tint}>
                    {rate}%
                  </Chip>
                </td>
                <td className="muted" title="Chưa có số liệu thời gian xử lý trung bình">
                  {NO_VALUE}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
