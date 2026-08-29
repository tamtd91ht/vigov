/**
 * Dữ liệu seed phân hệ Người dùng Mini App & Bảo mật (WBS #11)
 * — port từ admin-web/src/mocks/users.ts: 12 công dân, 6 bản ghi chặn,
 * 10 phiên đăng nhập đang hoạt động.
 *
 * Chuyển đổi so với mock:
 *   • `phoneMasked` ("098•••432") → `phone` là số 10 chữ số hợp lệ, tất định
 *     nên khớp với người gửi phản ánh trong feedback.seed.ts;
 *   • `kind: 'miniapp'` của phiên đăng nhập → 'zalo' theo enum của schema.
 */
import type { BlacklistRecord, CitizenUser, LoginSession } from '@vigov/shared';
import { parseVnDateTime, unmaskPhone } from './seed.util';

export type CitizenUserSeed = Partial<CitizenUser> & { phone: string };
export type BlacklistRecordSeed = Partial<BlacklistRecord> & { subject: string };
export type LoginSessionSeed = Partial<LoginSession> & { subject: string; device: string };

interface CitizenBase {
  zaloName: string;
  phoneMasked: string;
  area: string;
  feedbackCount: number;
  status: string;
  lockReason?: string;
}

const CITIZEN_BASE: CitizenBase[] = [
  { zaloName: 'Thắng Nguyễn', phoneMasked: '098•••432', area: 'Thôn Đông', feedbackCount: 9, status: 'active' },
  { zaloName: 'Mến Trần', phoneMasked: '097•••215', area: 'Thôn Đoài', feedbackCount: 4, status: 'active' },
  { zaloName: 'Hoa Phạm', phoneMasked: '091•••808', area: 'Thôn Trung', feedbackCount: 6, status: 'active' },
  { zaloName: 'Tùng Lê', phoneMasked: '090•••334', area: 'Tổ dân phố số 1', feedbackCount: 2, status: 'active' },
  {
    zaloName: 'Cường Đỗ',
    phoneMasked: '094•••671',
    area: 'Tổ dân phố số 2',
    feedbackCount: 11,
    status: 'locked',
    lockReason: 'Gửi phản ánh sai sự thật nhiều lần',
  },
  { zaloName: 'Nhung Vũ', phoneMasked: '096•••529', area: 'Tổ dân phố số 3', feedbackCount: 3, status: 'active' },
  { zaloName: 'Hải Bùi', phoneMasked: '093•••118', area: 'Thôn Đông', feedbackCount: 7, status: 'active' },
  { zaloName: 'Lan Ngô', phoneMasked: '098•••960', area: 'Tổ dân phố số 4', feedbackCount: 1, status: 'active' },
  { zaloName: 'Quân Hoàng', phoneMasked: '092•••245', area: 'Tổ dân phố số 5', feedbackCount: 5, status: 'active' },
  { zaloName: 'Thuỷ Đinh', phoneMasked: '097•••773', area: 'Thôn Đoài', feedbackCount: 0, status: 'active' },
  {
    zaloName: 'Phúc Trịnh',
    phoneMasked: '090•••486',
    area: 'Tổ dân phố số 2',
    feedbackCount: 8,
    status: 'locked',
    lockReason: 'Dùng lời lẽ xúc phạm cán bộ tiếp nhận trong nội dung phản ánh',
  },
  { zaloName: 'Duyên Mai', phoneMasked: '094•••052', area: 'Thôn Trung', feedbackCount: 2, status: 'active' },
];

/** 12 công dân dùng Zalo Mini App */
export const CITIZEN_USER_SEED: CitizenUserSeed[] = CITIZEN_BASE.map((row) => ({
  phone: unmaskPhone(row.phoneMasked),
  displayName: row.zaloName,
  area: row.area,
  channel: 'zalo',
  feedbackCount: row.feedbackCount,
  status: row.status,
  lockReason: row.lockReason,
  pushTokens: [],
}));

/** 6 bản ghi chặn — số điện thoại trong `subject` cũng được bỏ che dấu */
export const BLACKLIST_SEED: BlacklistRecordSeed[] = [
  {
    subject: `Cường Đỗ · ${unmaskPhone('094•••671')}`,
    kind: 'citizen',
    reason: 'Gửi phản ánh sai sự thật nhiều lần',
    by: 'Nguyễn Văn Bình',
    active: true,
  },
  {
    subject: `Phúc Trịnh · ${unmaskPhone('090•••486')}`,
    kind: 'citizen',
    reason: 'Dùng lời lẽ xúc phạm cán bộ tiếp nhận trong nội dung phản ánh',
    by: 'Trần Thị Hạnh',
    active: true,
  },
  {
    subject: 'Thiết bị Android · ID a83f-77c1',
    kind: 'device',
    reason: 'Tạo nhiều tài khoản ảo để gửi phản ánh trùng lặp',
    by: 'Hoàng Văn Sơn',
    active: true,
  },
  {
    subject: '113.190.52.109',
    kind: 'ip',
    reason: 'Gọi API gửi phản ánh vượt tần suất cho phép (nghi spam tự động)',
    by: 'Nguyễn Văn Bình',
    active: true,
  },
  {
    subject: '113.190.61.230',
    kind: 'ip',
    reason: 'Quét dò đường dẫn trang quản trị ngoài giờ hành chính',
    by: 'Hoàng Văn Sơn',
    active: false,
  },
  {
    subject: 'Thiết bị iOS · ID 5c2e-90ab',
    kind: 'device',
    reason: 'Phát tán liên kết lừa đảo trong phần mô tả phản ánh',
    by: 'Trần Thị Hạnh',
    active: false,
  },
];

interface SessionBase {
  userName: string;
  kind: string;
  device: string;
  ip: string;
  startedAt: string;
  lastActiveAt: string;
}

const SESSION_BASE: SessionBase[] = [
  { userName: 'Nguyễn Văn Bình', kind: 'web', device: 'Chrome 128 · Windows 11', ip: '113.190.32.41', startedAt: '27/08/2026 07:42', lastActiveAt: '27/08/2026 09:35' },
  { userName: 'Trần Thị Hạnh', kind: 'web', device: 'Edge 128 · Windows 11', ip: '113.190.32.44', startedAt: '27/08/2026 08:05', lastActiveAt: '27/08/2026 09:20' },
  { userName: 'Lê Minh Tuấn', kind: 'web', device: 'Chrome 128 · Windows 10', ip: '113.190.33.12', startedAt: '27/08/2026 07:58', lastActiveAt: '27/08/2026 08:47' },
  { userName: 'Đỗ Thanh Hà', kind: 'web', device: 'Firefox 129 · Windows 11', ip: '113.190.33.27', startedAt: '27/08/2026 07:35', lastActiveAt: '27/08/2026 09:02' },
  { userName: 'Ngô Thị Lan', kind: 'web', device: 'Chrome 128 · macOS 14', ip: '113.190.34.8', startedAt: '26/08/2026 16:44', lastActiveAt: '26/08/2026 17:31' },
  { userName: 'Thắng Nguyễn', kind: 'zalo', device: 'Zalo App · iPhone 13', ip: '113.190.45.60', startedAt: '27/08/2026 06:58', lastActiveAt: '27/08/2026 09:30' },
  { userName: 'Mến Trần', kind: 'zalo', device: 'Zalo App · Samsung Galaxy A54', ip: '113.190.45.77', startedAt: '27/08/2026 08:12', lastActiveAt: '27/08/2026 08:55' },
  { userName: 'Hoa Phạm', kind: 'zalo', device: 'Zalo App · iPhone 15 Pro', ip: '113.190.46.19', startedAt: '27/08/2026 07:20', lastActiveAt: '27/08/2026 09:14' },
  { userName: 'Hải Bùi', kind: 'zalo', device: 'Zalo App · Xiaomi Redmi Note 13', ip: '113.190.46.83', startedAt: '26/08/2026 20:41', lastActiveAt: '27/08/2026 06:32' },
  { userName: 'Quân Hoàng', kind: 'zalo', device: 'Zalo App · OPPO Reno11', ip: '113.190.47.5', startedAt: '27/08/2026 09:01', lastActiveAt: '27/08/2026 09:26' },
];

/** 10 phiên đăng nhập đang hoạt động (5 web quản trị + 5 Zalo Mini App) */
export const LOGIN_SESSION_SEED: LoginSessionSeed[] = SESSION_BASE.map((row) => ({
  subject: row.userName,
  kind: row.kind,
  device: row.device,
  ip: row.ip,
  startedAt: parseVnDateTime(row.startedAt),
  lastActiveAt: parseVnDateTime(row.lastActiveAt),
  revoked: false,
}));
