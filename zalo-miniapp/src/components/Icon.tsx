/** Bộ icon SVG stroke dùng chung — đồng bộ ngôn ngữ đồ hoạ với Web Quản trị. */
const ICON_PATHS = {
  home: '<path d="M3.5 10.5L12 3.5l8.5 7"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/>',
  chat: '<path d="M21 14.5a2 2 0 0 1-2 2H8l-4 3.5V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><path d="M8 8h9M8 11.5h6"/>',
  news: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M16 8h4v11a2 2 0 0 1-4 0"/><path d="M7.5 7.5h5M7.5 11h5M7.5 14.5h3"/>',
  user: '<circle cx="12" cy="8.4" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  megaphone: '<path d="M4 9.5v5a1.5 1.5 0 0 0 1.5 1.5H8l7 4.5V5L8 9.5H5.5A1.5 1.5 0 0 0 4 11z"/><path d="M18 9.2a4.2 4.2 0 0 1 0 5.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16.7 16.7"/>',
  radio: '<rect x="3" y="8" width="18" height="12.5" rx="2"/><path d="M7.5 8l10-4"/><circle cx="16" cy="14.2" r="3"/><path d="M6.5 12.5h4M6.5 16h4"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>',
  phone: '<path d="M20.5 16.9v2.6a1.8 1.8 0 0 1-2 1.8 18.4 18.4 0 0 1-8-2.9 18 18 0 0 1-5.5-5.5 18.4 18.4 0 0 1-2.9-8.1 1.8 1.8 0 0 1 1.8-2h2.6a1.8 1.8 0 0 1 1.8 1.6c.1.9.4 1.9.7 2.7a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.6 14.6 0 0 0 5.5 5.5l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.9.3 1.8.6 2.7.7a1.8 1.8 0 0 1 1.6 1.9z"/>',
  bell: '<path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5"/><path d="M13.8 20.5a2 2 0 0 1-3.6 0"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  right: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  ok: '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.2l2.6 2.6 5-5.4"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.1 2"/>',
  alert: '<path d="M12 3.4l8.8 15.6H3.2z"/><path d="M12 9.5v4.2M12 16.7h.01"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.8h.01"/>',
  pin: '<path d="M12 21s6.8-6.3 6.8-10.8A6.8 6.8 0 0 0 5.2 10.2C5.2 14.7 12 21 12 21z"/><circle cx="12" cy="10.2" r="2.4"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.6" cy="9.6" r="1.7"/><path d="M3.6 17.2l4.6-4.4 3.4 3 3-2.6 5.8 5"/>',
  camera: '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.7l1.4-2.2h6.8L16.8 7h2.7A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h3v3h-3zM20.5 14v6.5H17M14 20.5h1.5"/>',
  star: '<path d="M12 3.5l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.8l-5.6 2.9 1.1-6.2L2.9 10l6.3-.9z"/>',
  trash: '<path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  edit: '<path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17z"/><path d="M14.5 7l3 3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  car: '<path d="M5 16.5h14M6.5 16.5v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2M20.5 16.5v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2"/><path d="M3.5 16.5v-4l2-5.5h13l2 5.5v4z"/><circle cx="7.5" cy="13" r="1"/><circle cx="16.5" cy="13" r="1"/>',
  leaf: '<path d="M20 4c0 9-5.5 13.5-11 13.5A5 5 0 0 1 4 12.5C4 7 9 4 20 4z"/><path d="M4 20c3-6 7.5-9 12-11"/>',
  store: '<path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5"/><path d="M3 9.5L4.8 4.5h14.4L21 9.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M9.5 20v-5.5h5V20"/>',
  shield: '<path d="M12 3.2l7.5 3v5.4c0 4.6-3.1 8-7.5 9.2-4.4-1.2-7.5-4.6-7.5-9.2V6.2z"/><path d="M9 12l2.2 2.2L15.4 10"/>',
  build: '<path d="M3 21h18"/><path d="M5 21V8.5L12 4l7 4.5V21"/><path d="M9.5 21v-5h5v5"/>',
  badge: '<rect x="4" y="6.5" width="16" height="14" rx="2"/><path d="M9 6.5v-1a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v1"/><circle cx="12" cy="12" r="2.2"/><path d="M8.5 17.5a3.5 3.5 0 0 1 7 0"/>',
  bulb: '<path d="M9.5 18h5M10 21h4"/><path d="M12 3a6 6 0 0 1 3.6 10.8c-.7.5-1.1 1.3-1.1 2.2H9.5c0-.9-.4-1.7-1.1-2.2A6 6 0 0 1 12 3z"/>',
  water: '<path d="M12 3.5s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  map: '<path d="M9 4L3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5z"/><path d="M9 4v14M15 6.5v14"/>',
  health: '<path d="M20.8 6.6a5.2 5.2 0 0 0-8.8-2.2 5.2 5.2 0 0 0-8.8 3.7c0 6 8.8 11.4 8.8 11.4s8.8-5.4 8.8-11.4c0-.5-.1-1-.2-1.5z"/><path d="M12 8.5v5M9.5 11h5"/>',
  more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  logout: '<path d="M15 4.5h3a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3"/><path d="M10.5 16.5L6 12l4.5-4.5M6 12h10"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  playFill: '<path d="M7 4.5v15l13-7.5z"/>',
  skipBack: '<path d="M20.5 12A8.5 8.5 0 1 1 12 3.5"/><path d="M12 .8L15.6 4 12 7.2"/>',
  skipFwd: '<path d="M3.5 12A8.5 8.5 0 1 0 12 3.5"/><path d="M12 .8L8.4 4 12 7.2"/>',
  text: '<path d="M4 6.5V4.5h16v2"/><path d="M12 4.5v15M8.5 19.5h7"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.2 4v4h4"/><path d="M12 7.6V12l3 2"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  send: '<path d="M21 3.5L10.5 14M21 3.5l-6.6 17.2-3.9-6.7-6.7-3.9z"/>',
  users: '<circle cx="9.5" cy="8" r="3.3"/><path d="M3.5 20a6 6 0 0 1 12 0"/><path d="M16.5 5.2a3.3 3.3 0 0 1 0 6.4"/><path d="M18 20a6.2 6.2 0 0 0-2.6-4.6"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9"/>',
  verified: '<path d="M12 3l2.2 2.1 3-.3.6 3 2.6 1.6-1.4 2.7 1.4 2.7-2.6 1.6-.6 3-3-.3L12 21l-2.2-2.1-3 .3-.6-3-2.6-1.6L5 12l-1.4-2.7 2.6-1.6.6-3 3 .3z"/><path d="M9.3 12.2l1.9 1.9 3.6-3.9"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  fill?: boolean;
}

export function Icon({ name, size = 20, strokeWidth = 1.8, color, className, fill }: IconProps) {
  return (
    <svg
      className={className ? `ic ${className}` : "ic"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={color ? { color } : undefined}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
