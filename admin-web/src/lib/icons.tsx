/**
 * Bộ icon SVG stroke dùng chung — port từ mockup đã duyệt (vigov-prototype.html).
 */

const ICON_PATHS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/>',
  check: '<path d="M9 11.5l2.6 2.6L21 4.7"/><path d="M21 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5z"/><path d="M16.5 12h2.5"/>',
  msg: '<path d="M21 14.5a2 2 0 0 1-2 2H8l-4 3.5V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><path d="M8 8h9M8 11.5h6"/>',
  map: '<path d="M9 4L3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5z"/><path d="M9 4v14M15 6.5v14"/>',
  chart: '<path d="M3 3v16.5A1.5 1.5 0 0 0 4.5 21H21"/><path d="M7.5 16v-4M12 16V8M16.5 16v-6"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16.7 16.7"/>',
  bell: '<path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5"/><path d="M13.8 20.5a2 2 0 0 1-3.6 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.4"/><path d="M12 17.2h.01"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.1 2"/>',
  alert: '<path d="M12 3.4l8.8 15.6H3.2z"/><path d="M12 9.5v4.2M12 16.7h.01"/>',
  star: '<path d="M12 3.5l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.8l-5.6 2.9 1.1-6.2L2.9 10l6.3-.9z"/>',
  clip: '<path d="M20.5 11.5l-8.4 8.4a5 5 0 0 1-7.1-7.1l8.9-8.9a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.8 1.8 0 1 1-2.5-2.5l7.6-7.6"/>',
  users: '<circle cx="9.5" cy="8" r="3.3"/><path d="M3.5 20a6 6 0 0 1 12 0"/><path d="M16.5 5.2a3.3 3.3 0 0 1 0 6.4"/><path d="M18 20a6.2 6.2 0 0 0-2.6-4.6"/>',
  smile: '<circle cx="12" cy="12" r="8.6"/><path d="M8.4 14.2s1.3 1.9 3.6 1.9 3.6-1.9 3.6-1.9"/><path d="M9.4 9.4h.01M14.6 9.4h.01"/>',
  pin: '<path d="M12 21s6.8-6.3 6.8-10.8A6.8 6.8 0 0 0 5.2 10.2C5.2 14.7 12 21 12 21z"/><circle cx="12" cy="10.2" r="2.4"/>',
  down: '<path d="M12 3.5v12M7.2 11l4.8 4.8L16.8 11"/><path d="M4 20.5h16"/>',
  right: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  layer: '<path d="M12 3.2l8.6 4.4L12 12 3.4 7.6z"/><path d="M3.4 12.4L12 16.8l8.6-4.4M3.4 16.6L12 21l8.6-4.4"/>',
  cal: '<rect x="3.4" y="5" width="17.2" height="16" rx="2"/><path d="M3.4 10h17.2M8 3v4M16 3v4"/>',
  filter: '<path d="M3.5 5.5h17l-6.7 7.9V20l-3.6-2v-4.6z"/>',
  send: '<path d="M21 3.5L10.5 14M21 3.5l-6.6 17.2-3.9-6.7-6.7-3.9z"/>',
  ok: '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.2l2.6 2.6 5-5.4"/>',
  arrowUp: '<path d="M12 19.5v-15M6 10.5l6-6 6 6"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M4 17.2h15"/>',
  build: '<path d="M3 21h18"/><path d="M5 21V8.5L12 4l7 4.5V21"/><path d="M9.5 21v-5h5v5"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.8-1.2"/>',
  trash: '<path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13"/>',
  edit: '<path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17z"/><path d="M14.5 7l3 3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  logout: '<path d="M15 4.5h3a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3"/><path d="M10.5 16.5L6 12l4.5-4.5M6 12h10"/>',
  phone: '<path d="M20.5 16.9v2.6a1.8 1.8 0 0 1-2 1.8 18.4 18.4 0 0 1-8-2.9 18 18 0 0 1-5.5-5.5 18.4 18.4 0 0 1-2.9-8.1 1.8 1.8 0 0 1 1.8-2h2.6a1.8 1.8 0 0 1 1.8 1.6c.1.9.4 1.9.7 2.7a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.6 14.6 0 0 0 5.5 5.5l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.9.3 1.8.6 2.7.7a1.8 1.8 0 0 1 1.6 1.9z"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 18, strokeWidth = 1.7, className }: IconProps) {
  return (
    <svg
      className={className ? `ic ${className}` : "ic"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
