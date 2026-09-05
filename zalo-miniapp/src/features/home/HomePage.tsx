import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { DemoBadge, SectionHead } from "@/components/common";
import { DataState } from "@/components/DataState";
import { appConfig } from "@/config/app.config";
import { homeQuickActions } from "@/config/nav.config";
import { useApiResource } from "@/hooks/useApiResource";
import { contentService } from "@/services/content.service";
import { useFeedback } from "@/state/FeedbackContext";
import { useSession } from "@/state/SessionContext";
import { useToast } from "@/state/ToastContext";
import { LatestTicketCard, NewsRow, QuickActionTile } from "./HomeCards";

/** Số thông báo chưa đọc — chờ backend P3 (Trung tâm thông báo) */
const UNREAD_NOTIFICATIONS = 3;
const NOTIFICATION_TOAST = "Trung tâm thông báo kết nối ở giai đoạn backend";

/** Mốc giờ đổi lời chào */
const AFTERNOON_FROM = 11;
const EVENING_FROM = 18;

function greeting(hour: number): string {
  if (hour < AFTERNOON_FROM) return "Chào buổi sáng";
  if (hour < EVENING_FROM) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function initial(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? "";
  return (last[0] ?? "C").toUpperCase();
}

export function HomePage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { tickets, loading: ticketsLoading, error: ticketsError, reload: reloadTickets } = useFeedback();
  const { showToast } = useToast();

  // Tin tức mới nhất — CMS công khai, không cần token
  const news = useApiResource(() => contentService.listArticles(), []);

  const displayName = session?.displayName ?? "Công dân";
  const latestTicket = tickets[0];
  const articles = (news.data ?? []).slice(0, appConfig.homeNewsCount);

  return (
    <div className="page flush">
      {/* Header navy — bottom nav do Layout đảm nhiệm */}
      <div className="hero">
        <div className="row">
          <div className="avatar">{initial(displayName)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="greet">{greeting(new Date().getHours())}</div>
            <div className="name">{displayName}</div>
          </div>
          <button className="bell" onClick={() => showToast(NOTIFICATION_TOAST)} aria-label="Thông báo">
            <Icon name="bell" size={19} />
            <span className="badge">{UNREAD_NOTIFICATIONS}</span>
          </button>
        </div>
        <div className="org" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DemoBadge />
          <span>
            {appConfig.org.name} · {appConfig.org.parent}
          </span>
        </div>
      </div>

      <div style={{ padding: "var(--pad)" }}>
        {/* Truy cập nhanh */}
        <div className="grid3" style={{ marginTop: 2 }}>
          {homeQuickActions.map((a) => (
            <QuickActionTile key={a.path} action={a} onClick={() => navigate(a.path)} />
          ))}
        </div>

        {/* Phản ánh của tôi — phiếu mới nhất */}
        <SectionHead title="Phản ánh của tôi" onMore={() => navigate("/my-feedback")} />
        {latestTicket && !ticketsLoading && !ticketsError ? (
          <LatestTicketCard
            ticket={latestTicket}
            onClick={() => navigate(`/my-feedback/${encodeURIComponent(latestTicket.code)}`)}
          />
        ) : (
          // Trạng thái tải / lỗi / rỗng nằm trong thẻ trắng, giữ đúng bố cục cũ
          <div className="card">
            <DataState
              loading={ticketsLoading}
              error={ticketsError}
              onRetry={reloadTickets}
              empty
              emptyIcon="chat"
              emptyMessage="Bạn chưa gửi phản ánh nào."
            >
              {null}
            </DataState>
          </div>
        )}

        {/* Tin tức mới — GET /content/public/articles */}
        <SectionHead title="Tin tức mới" onMore={() => navigate("/news")} />
        <DataState
          loading={news.loading}
          error={news.error}
          onRetry={news.reload}
          empty={articles.length === 0}
          emptyIcon="news"
          emptyMessage="Chưa có tin tức mới"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {articles.map((a) => (
              <NewsRow key={a.id} article={a} onClick={() => navigate(`/news/${a.id}`)} />
            ))}
          </div>
        </DataState>
      </div>
    </div>
  );
}
