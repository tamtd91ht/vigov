import { useMemo, useState, type CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { EmptyState, IconBubble, SectionHead, SubHeader, tint } from "@/components/common";
import { appConfig } from "@/config/app.config";
import { mockGovContacts } from "@/mocks/directory.mock";
import { zaloService } from "@/services/zalo";
import { useToast } from "@/state/ToastContext";
import type { GovContact } from "@/types";

/** Màu avatar xoay vòng theo vị trí trong danh bạ */
const AVATAR_COLORS = [
  "var(--navy)",
  "var(--blue)",
  "var(--teal)",
  "var(--purple)",
  "var(--orange)",
  "var(--pink)",
  "var(--green)",
  "var(--slate)",
];

const LEADER_SECTION = "Lãnh đạo UBND xã";
const DEPARTMENT_SECTION = "Bộ phận chuyên môn";
const SEARCH_PLACEHOLDER = "Tìm theo tên, chức danh, bộ phận…";
const EMPTY_MESSAGE = "Không tìm thấy cán bộ hoặc bộ phận phù hợp.";
const CHAT_TOAST = "Đang mở cửa sổ chat Zalo… (mô phỏng)";
const HOTLINE_LABEL = "Tổng đài một cửa";

const callToast = (phone: string) => `Đang gọi ${phone}… (mô phỏng)`;

/** Chữ cái đầu hiển thị trên avatar — lấy theo tên gọi (từ cuối), quy ước chung của app */
function initial(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? "";
  return (last[0] ?? "?").toUpperCase();
}

/** Nút tròn hành động (gọi / nhắn Zalo) */
function actionStyle(color: string): CSSProperties {
  return {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: tint(color, 0.14),
    color,
    display: "grid",
    placeItems: "center",
    flex: "none",
  };
}

function ContactRow({
  contact,
  colorIndex,
  onCall,
  onChat,
}: {
  contact: GovContact;
  colorIndex: number;
  onCall: () => void;
  onChat?: () => void;
}) {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  return (
    <div className="card card-b" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: color,
          color: "#fff",
          fontWeight: 800,
          display: "grid",
          placeItems: "center",
          flex: "none",
        }}
      >
        {initial(contact.name)}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "var(--navy)" }}>{contact.name}</div>
        <div className="tiny">{contact.title}</div>
        <div className="tiny muted" style={{ marginTop: 2 }}>
          {contact.department} · {contact.phone}
        </div>
      </div>

      {onChat && (
        <button style={actionStyle("var(--blue)")} onClick={onChat} aria-label={`Nhắn Zalo cho ${contact.name}`}>
          <Icon name="chat" size={19} />
        </button>
      )}
      <button style={actionStyle("var(--green)")} onClick={onCall} aria-label={`Gọi ${contact.name}`}>
        <Icon name="phone" size={19} />
      </button>
    </div>
  );
}

export function DirectoryPage() {
  const { showToast } = useToast();
  const [query, setQuery] = useState("");

  /** Giữ vị trí gốc để màu avatar không nhảy khi lọc */
  const indexed = useMemo(() => mockGovContacts.map((contact, index) => ({ contact, index })), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return indexed;
    return indexed.filter(({ contact }) =>
      [contact.name, contact.title, contact.department, contact.phone].some((f) => f.toLowerCase().includes(q)),
    );
  }, [indexed, query]);

  const leaders = filtered.filter(({ contact }) => contact.group === "leader");
  const departments = filtered.filter(({ contact }) => contact.group === "department");

  const call = (phone: string) => {
    void zaloService.call(phone);
    showToast(callToast(phone));
  };

  const chat = (phone: string) => {
    void zaloService.openChat(phone);
    showToast(CHAT_TOAST);
  };

  return (
    <div className="app">
      <SubHeader title="Danh bạ chính quyền" />
      <div className="page plain">
        <div className="tiny muted" style={{ marginBottom: 12 }}>
          {appConfig.org.name}
        </div>

        {/* Ô tìm kiếm — lọc theo tên / chức danh / bộ phận / số điện thoại */}
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 13,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--mut)",
              pointerEvents: "none",
            }}
          >
            <Icon name="search" size={18} />
          </span>
          <input
            className="finp"
            style={{ paddingLeft: 40 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            aria-label={SEARCH_PLACEHOLDER}
          />
        </div>

        {filtered.length === 0 && <EmptyState icon="users" message={EMPTY_MESSAGE} />}

        {leaders.length > 0 && (
          <>
            <SectionHead title={LEADER_SECTION} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leaders.map(({ contact, index }) => (
                <ContactRow
                  key={`${contact.phone}-${index}`}
                  contact={contact}
                  colorIndex={index}
                  onCall={() => call(contact.phone)}
                  onChat={() => chat(contact.phone)}
                />
              ))}
            </div>
          </>
        )}

        {departments.length > 0 && (
          <>
            <SectionHead title={DEPARTMENT_SECTION} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {departments.map(({ contact, index }) => (
                <ContactRow
                  key={`${contact.phone}-${index}`}
                  contact={contact}
                  colorIndex={index}
                  onCall={() => call(contact.phone)}
                />
              ))}
            </div>
          </>
        )}

        {/* Tổng đài một cửa — luôn hiển thị kể cả khi lọc không ra kết quả */}
        <div className="divider" />
        <div className="card card-b" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IconBubble name="phone" color="var(--green)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "var(--navy)" }}>
              {HOTLINE_LABEL}: {appConfig.hotline}
            </div>
            <div className="tiny muted">Hỗ trợ trong giờ hành chính, từ thứ Hai đến thứ Sáu.</div>
          </div>
          <button className="btn sm" onClick={() => call(appConfig.hotline)}>
            <Icon name="phone" size={16} />
            Gọi
          </button>
        </div>
      </div>
    </div>
  );
}
