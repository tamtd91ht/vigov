import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { Note, tint } from "@/components/common";
import { appConfig } from "@/config/app.config";

const CIRCLE_SIZE = 96;
const CODE_FONT_SIZE = "1.5rem";

/**
 * Màn kết quả sau khi gửi phản ánh thành công.
 * Mã phiếu do FeedbackContext sinh ở Phase 1 — quy tắc đánh mã thật chờ khách (câu hỏi mở #17).
 */
export function ResultView({ code, sla }: { code: string; sla: string }) {
  const navigate = useNavigate();

  return (
    <div className="app">
      <div
        className="page plain"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <span
          style={{
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: "50%",
            background: tint("var(--green)", 0.14),
            color: "var(--green)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="check" size={46} strokeWidth={2.4} />
        </span>

        <h1 style={{ marginTop: 18 }}>Gửi phản ánh thành công</h1>
        <p className="sm muted" style={{ marginTop: 8, maxWidth: 300 }}>
          Phản ánh của bạn đã được chuyển tới {appConfig.org.name} và sẽ được phân loại xử lý.
        </p>

        <div className="card card-b" style={{ width: "100%", marginTop: 20 }}>
          <div className="tiny muted" style={{ fontWeight: 600 }}>
            Mã phiếu phản ánh
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: CODE_FONT_SIZE,
              fontWeight: 800,
              letterSpacing: ".4px",
              color: "var(--navy)",
            }}
          >
            {code}
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            Dùng mã này để theo dõi tiến độ xử lý
          </div>
        </div>

        <div style={{ width: "100%", marginTop: 14 }}>
          <Note color="var(--green)" icon="clock">
            {sla}
          </Note>
        </div>

        <div style={{ width: "100%", marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn pink"
            onClick={() => navigate(`/my-feedback/${encodeURIComponent(code)}`, { replace: true })}
          >
            <Icon name="megaphone" size={18} />
            Theo dõi phiếu này
          </button>
          <button className="btn" onClick={() => navigate("/")}>
            <Icon name="home" size={18} />
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
