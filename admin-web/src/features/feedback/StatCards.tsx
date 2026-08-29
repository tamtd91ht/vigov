import { KpiCard } from "@/components/ui/KpiCard";
import { formatNumber } from "@/lib/format";
import { appConfig } from "@/config/app.config";
import type { FeedbackStatsData } from "@/services/feedback.service";

/** Chỉ tiêu tỷ lệ xử lý đúng hạn được giao (hiển thị để đối chiếu) */
const ON_TIME_TARGET = 85;

/** 4 thẻ thống kê đầu trang Phản ánh người dân — số liệu từ GET /feedback/stats */
export function StatCards({ stats }: { stats: FeedbackStatsData }) {
  const pending = Math.max(0, stats.receivedThisMonth - stats.resolvedThisMonth);

  return (
    <div className="grid4" style={{ marginBottom: 20 }}>
      <KpiCard
        value={formatNumber(stats.receivedThisMonth)}
        label="Tiếp nhận trong tháng"
        sub={`Kỳ thống kê tháng ${stats.month}`}
        color="var(--blue)"
        tint="rgba(59,130,196,.07)"
        icon="msg"
      />
      <KpiCard
        value={formatNumber(stats.resolvedThisMonth)}
        label="Đã xử lý xong"
        sub={`${formatNumber(pending)} lượt còn đang xử lý`}
        color="var(--green)"
        tint="rgba(39,174,96,.07)"
        icon="check"
      />
      <KpiCard
        value={`${stats.onTimeRate}%`}
        label="Tỷ lệ đúng hạn"
        sub={`Chỉ tiêu giao: ${ON_TIME_TARGET}%`}
        color="var(--orange)"
        tint="rgba(230,126,34,.07)"
        icon="clock"
      />
      <KpiCard
        value={stats.avgRating.toLocaleString(appConfig.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        label="Điểm hài lòng"
        sub={`Thang điểm 5 · ${formatNumber(stats.ratedCount)} lượt đánh giá`}
        color="var(--teal)"
        tint="rgba(23,162,162,.07)"
        icon="smile"
      />
    </div>
  );
}
