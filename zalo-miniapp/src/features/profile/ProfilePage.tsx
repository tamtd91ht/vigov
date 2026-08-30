import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@/components/Icon";
import { Chip, IconBubble, SectionHead } from "@/components/common";
import { appConfig } from "@/config/app.config";
import { useFeedback } from "@/state/FeedbackContext";
import { maskPhone, useSession } from "@/state/SessionContext";
import { fontScaleOptions, useSettings } from "@/state/SettingsContext";
import { useToast } from "@/state/ToastContext";

const SECTION_TOOLS = "Tiện ích của tôi";
const SECTION_DISPLAY = "Cài đặt hiển thị";
const SECTION_NOTIFICATION = "Thông báo";
const SECTION_ABOUT = "Về ứng dụng";

const FONT_LABEL = "Cỡ chữ";
const FONT_PREVIEW = "Xem trước: Kích thước chữ hiện tại";
const NOTIFICATION_TITLE = "Nhận thông báo từ chính quyền xã";
const NOTIFICATION_SUB = "Kết quả phản ánh, tin khẩn, lịch cắt điện nước…";
const TERMS_LABEL = "Điều khoản sử dụng & Quyền riêng tư";
const TERMS_TOAST = "Tài liệu sẽ bổ sung khi phát hành";
const LOGOUT_CONFIRM = "Đăng xuất khỏi ViGov? Bạn sẽ cần định danh lại bằng số điện thoại Zalo.";

const callToast = (phone: string) => `Đang gọi ${phone}… (mô phỏng)`;
const fontToast = (label: string) => `Đã áp dụng cỡ chữ ${label}`;

/** Chữ cái đầu hiển thị trên avatar — lấy theo tên gọi (từ cuối), quy ước chung của app */
function initial(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? "";
  return (last[0] ?? "C").toUpperCase();
}

const rowStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  textAlign: "left",
};

/** Hàng tiện ích có mũi tên điều hướng */
function ToolRow({
  icon,
  color,
  title,
  subtitle,
  onClick,
}: {
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button style={rowStyle} onClick={onClick}>
      <IconBubble name={icon} color={color} size={38} iconSize={19} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, color: "var(--navy)" }}>{title}</span>
        <span className="tiny muted" style={{ display: "block" }}>
          {subtitle}
        </span>
      </span>
      <Icon name="right" size={17} color="var(--mut)" />
    </button>
  );
}

/** Hàng thông tin trong khối "Về ứng dụng" */
function InfoRow({ label, value, onClick }: { label: string; value: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: "var(--navy)" }}>{label}</span>
      <span className="tiny muted" style={{ textAlign: "right" }}>
        {value}
      </span>
      {onClick && <Icon name="right" size={16} color="var(--mut)" />}
    </>
  );
  return onClick ? (
    <button style={rowStyle} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div style={rowStyle}>{content}</div>
  );
}

function RowDivider() {
  return <div className="divider" style={{ margin: 0 }} />;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { session, logout } = useSession();
  const { tickets } = useFeedback();
  const { font, setFont, notificationsEnabled, setNotifications } = useSettings();
  const { showToast } = useToast();

  const displayName = session?.displayName ?? "Công dân";
  const phone = session?.phone ?? "";

  const onLogout = () => {
    // Router tự đưa về /onboarding khi phiên bị xoá
    if (window.confirm(LOGOUT_CONFIRM)) logout();
  };

  return (
    <div className="page">
      {/* Tab chính — header không có nút quay lại; tràn viền bằng margin âm của .page */}
      <div
        className="subhead"
        style={{
          marginTop: "calc(var(--pad) * -1)",
          marginLeft: "calc(var(--pad) * -1)",
          marginRight: "calc(var(--pad) * -1)",
          marginBottom: 14,
        }}
      >
        <h2>Cá nhân</h2>
      </div>

      {/* Hồ sơ công dân */}
      <div className="card card-b" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--navy)",
            color: "#fff",
            fontWeight: 800,
            fontSize: "1.25rem",
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
        >
          {initial(displayName)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: "1.02rem" }}>{displayName}</div>
          <div className="tiny muted" style={{ margin: "2px 0 7px" }}>
            {maskPhone(phone)}
          </div>
          <Chip label="Đã định danh" color="var(--green)" icon="verified" />
        </div>
      </div>

      {/* Tiện ích của tôi */}
      <SectionHead title={SECTION_TOOLS} />
      <div className="card">
        <ToolRow
          icon="chat"
          color="var(--pink)"
          title="Phản ánh của tôi"
          subtitle={`${tickets.length} phiếu đã gửi`}
          onClick={() => navigate("/my-feedback")}
        />
        <RowDivider />
        <ToolRow
          icon="history"
          color="var(--blue)"
          title="Lịch sử tra cứu hồ sơ"
          subtitle="Xem lại các hồ sơ một cửa đã tra cứu"
          onClick={() => navigate("/lookup")}
        />
        <RowDivider />
        {/* Lối vào riêng cho bản trình diễn P5-11 — chưa nối vào luồng nghiệp vụ nào */}
        <ToolRow
          icon="badge"
          color="var(--teal)"
          title="Quét thẻ căn cước"
          subtitle="Bản trình diễn cơ chế đọc QR trên CCCD"
          onClick={() => navigate("/cccd")}
        />
      </div>

      {/* Cỡ chữ — áp dụng toàn app qua CSS var --font-scale */}
      <SectionHead title={SECTION_DISPLAY} />
      <div className="card card-b">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Icon name="text" size={18} color="var(--navy)" />
          <span style={{ fontWeight: 700, color: "var(--navy)" }}>{FONT_LABEL}</span>
        </div>
        <div className="chips-row">
          {fontScaleOptions.map((o) => (
            <button
              key={o.key}
              className={`fchip ${o.key === font.key ? "on" : ""}`}
              onClick={() => {
                setFont(o);
                showToast(fontToast(o.label));
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="divider" />
        <div className="sm muted">{FONT_PREVIEW}</div>
      </div>

      {/* Thông báo — đăng ký nhận ZNS/push thật ở P3 (#23) */}
      <SectionHead title={SECTION_NOTIFICATION} />
      <div className="card card-b" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--navy)" }}>{NOTIFICATION_TITLE}</div>
          <div className="tiny muted" style={{ marginTop: 2 }}>
            {NOTIFICATION_SUB}
          </div>
        </div>
        <button
          role="switch"
          aria-checked={notificationsEnabled}
          aria-label={NOTIFICATION_TITLE}
          onClick={() => setNotifications(!notificationsEnabled)}
          style={{
            position: "relative",
            width: 46,
            height: 27,
            borderRadius: 14,
            background: notificationsEnabled ? "var(--green)" : "var(--bd)",
            transition: ".18s",
            flex: "none",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: notificationsEnabled ? 22 : 3,
              width: 21,
              height: 21,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,.25)",
              transition: ".18s",
            }}
          />
        </button>
      </div>

      {/* Về ứng dụng */}
      <SectionHead title={SECTION_ABOUT} />
      <div className="card">
        <InfoRow label="Đơn vị vận hành" value={`${appConfig.org.name} · ${appConfig.org.parent}`} />
        <RowDivider />
        <InfoRow
          label="Tổng đài hỗ trợ"
          value={appConfig.hotline}
          onClick={() => showToast(callToast(appConfig.hotline))}
        />
        <RowDivider />
        <InfoRow label="Phiên bản" value={`${appConfig.appName} ${appConfig.version}`} />
        <RowDivider />
        <InfoRow label={TERMS_LABEL} value="" onClick={() => showToast(TERMS_TOAST)} />
      </div>

      <button className="btn danger" style={{ marginTop: 20 }} onClick={onLogout}>
        <Icon name="logout" size={18} />
        Đăng xuất
      </button>
    </div>
  );
}
