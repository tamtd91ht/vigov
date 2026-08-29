import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { navTabs } from "@/config/nav.config";
import { Icon } from "./Icon";
import { formatTime } from "./common";
import { useRadio } from "@/state/RadioContext";

/** Khung app cho các tab chính: nội dung + mini player + bottom nav + nút gửi phản ánh nổi */
export function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  return (
    <div className="app">
      <Outlet />
      <RadioMiniPlayer />
      <button className="fab" onClick={() => navigate("/send-feedback")} aria-label="Gửi phản ánh">
        <Icon name="megaphone" size={25} />
      </button>
      <nav className="nav">
        {navTabs.slice(0, 2).map((t) => (
          <button key={t.key} className={isActive(t.path) ? "on" : ""} onClick={() => navigate(t.path)}>
            <Icon name={t.icon} size={21} />
            <span>{t.label}</span>
          </button>
        ))}
        <div className="spacer" />
        {navTabs.slice(2).map((t) => (
          <button key={t.key} className={isActive(t.path) ? "on" : ""} onClick={() => navigate(t.path)}>
            <Icon name={t.icon} size={21} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Thanh phát thu nhỏ — giữ phát khi chuyển màn (WBS #17) */
export function RadioMiniPlayer() {
  const navigate = useNavigate();
  const radio = useRadio();
  if (!radio.bulletin) return null;

  return (
    <div className="mini">
      <button
        onClick={radio.toggle}
        style={{ color: "#fff", display: "grid", placeItems: "center" }}
        aria-label={radio.playing ? "Tạm dừng" : "Phát"}
      >
        <Icon name={radio.playing ? "pause" : "playFill"} size={24} fill={!radio.playing} strokeWidth={2} />
      </button>
      <div className="t" onClick={() => navigate("/radio")}>
        <b>{radio.bulletin.title}</b>
        <div className="bar">
          <i style={{ width: `${radio.progress * 100}%` }} />
        </div>
      </div>
      <span className="tiny" style={{ color: "rgba(255,255,255,.72)" }}>
        {formatTime(radio.position)} / {formatTime(radio.duration)}
      </span>
      <button onClick={radio.stop} style={{ color: "rgba(255,255,255,.6)" }} aria-label="Đóng">
        <Icon name="close" size={17} />
      </button>
    </div>
  );
}
