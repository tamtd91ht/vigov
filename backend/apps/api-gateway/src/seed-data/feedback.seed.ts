/**
 * Dữ liệu seed phân hệ Phản ánh người dân (WBS #6/#13)
 * — port từ admin-web/src/mocks/feedback.ts (9 phiếu #PA-1034…#PA-1042).
 *
 * Chuyển đổi so với mock:
 *   • `categoryLabel` → `categoryKey` theo admin-web/src/config/sla.config.ts;
 *   • `status` tiếng Việt → 'received' | 'processing' | 'resolved';
 *   • `senderPhone` che dấu → `citizenPhone` là số 10 chữ số hợp lệ (tất định);
 *   • `slaDueAt` = thời điểm gửi + resolveDays của lĩnh vực;
 *   • `channel` = 'app'; ghim bản đồ mock quy đổi thành lat/lng quanh trung tâm xã.
 */
import type { Feedback } from '@vigov/shared';
import { addDays, parseVnDateTime, pinToLatLng, unmaskPhone } from './seed.util';

export type FeedbackSeed = Partial<Feedback> & { code: string };

/** Nhãn lĩnh vực (mock) → khoá lĩnh vực (sla.config.ts) */
const CATEGORY_KEY_BY_LABEL: Record<string, string> = {
  'Rác thải': 'rac-thai',
  'Giao thông': 'giao-thong',
  'Vệ sinh môi trường': 've-sinh-moi-truong',
  'Trật tự đô thị': 'trat-tu-do-thi',
  'An ninh': 'an-ninh',
  'Xây dựng': 'xay-dung',
  'Cán bộ': 'can-bo',
  Khác: 'khac',
};

/** Số ngày xử lý theo SLA từng lĩnh vực — đồng bộ defaultSlaRules */
const RESOLVE_DAYS_BY_CATEGORY: Record<string, number> = {
  'rac-thai': 3,
  'giao-thong': 5,
  've-sinh-moi-truong': 3,
  'trat-tu-do-thi': 5,
  'an-ninh': 2,
  'xay-dung': 7,
  'can-bo': 5,
  khac: 7,
};

/** Trạng thái hiển thị (mock) → trạng thái schema */
const STATUS_BY_LABEL: Record<string, string> = {
  'Mới tiếp nhận': 'received',
  'Đang xử lý': 'processing',
  'Đã xử lý': 'resolved',
};

/** Nhãn của mock khi phiếu chưa được phân công */
const UNASSIGNED = 'Chưa phân công';

/** Ghim bản đồ mini của mock (phần trăm trong khung) */
const PINS: Record<string, { x: number; y: number }> = {
  '#PA-1042': { x: 62, y: 40 },
  '#PA-1041': { x: 28, y: 52 },
  '#PA-1040': { x: 47, y: 66 },
  '#PA-1039': { x: 55, y: 34 },
  '#PA-1038': { x: 24, y: 46 },
  '#PA-1037': { x: 40, y: 60 },
  '#PA-1036': { x: 52, y: 48 },
  '#PA-1035': { x: 68, y: 58 },
  '#PA-1034': { x: 72, y: 38 },
};

/** Dữ liệu gốc từ mock, giữ nguyên nhãn tiếng Việt để chuyển đổi bên dưới */
interface FeedbackBase {
  code: string;
  categoryLabel: string;
  title: string;
  excerpt: string;
  location: string;
  statusLabel: string;
  rating: number;
  ratingComment?: string;
  senderName: string;
  senderPhone: string;
  sentAt: string;
  assignee: string;
  department: string;
  linkedTaskCode?: string;
  timeline: { title: string; meta: string; state: string }[];
}

const FEEDBACK_BASE: FeedbackBase[] = [
  {
    code: '#PA-1042',
    categoryLabel: 'Vệ sinh môi trường',
    title: 'Bãi rác tự phát đầu cầu Thôn Đông',
    excerpt:
      'Người dân tự ý đổ rác thải sinh hoạt tại khu đất trống đầu cầu, bốc mùi hôi thối, ruồi muỗi nhiều.',
    location: 'Thôn Đông',
    statusLabel: 'Đang xử lý',
    rating: 0,
    senderName: 'Ông Nguyễn Văn Thắng',
    senderPhone: '098•••432',
    sentAt: '18/08/2026 07:42',
    assignee: 'Vũ Đức Anh',
    department: 'Văn hoá – Xã hội',
    linkedTaskCode: 'NV-2603',
    timeline: [
      { title: 'Người dân gửi phản ánh qua ứng dụng ViGov', meta: '18/08/2026 07:42', state: 'ok' },
      { title: 'Trung tâm Phục vụ hành chính công tiếp nhận, phân loại', meta: '18/08/2026 08:10 · Ngô Thị Lan', state: 'ok' },
      { title: 'Chuyển Văn hoá – Xã hội xử lý', meta: '18/08/2026 09:05 · Trần Thị Hạnh', state: 'ok' },
      { title: 'Kiểm tra hiện trường, lập biên bản', meta: '19/08/2026 14:20 · Vũ Đức Anh', state: 'ok' },
      { title: 'Đang tổ chức thu gom, cắm biển cấm đổ rác', meta: 'Từ 21/08/2026 · Vũ Đức Anh', state: 'cur' },
    ],
  },
  {
    code: '#PA-1041',
    categoryLabel: 'Giao thông',
    title: 'Ổ gà lớn đường liên thôn Đoài – Trung',
    excerpt: 'Đoạn đường dài khoảng 60m xuất hiện nhiều ổ gà sâu, nước đọng, đã có 2 vụ ngã xe máy.',
    location: 'Thôn Đoài',
    statusLabel: 'Đang xử lý',
    rating: 0,
    senderName: 'Bà Trần Thị Mến',
    senderPhone: '091•••118',
    sentAt: '21/08/2026 16:05',
    assignee: 'Lê Minh Tuấn',
    department: 'Địa chính – Xây dựng',
    timeline: [
      { title: 'Người dân gửi phản ánh kèm 3 ảnh hiện trường', meta: '21/08/2026 16:05', state: 'ok' },
      { title: 'Trung tâm Phục vụ hành chính công tiếp nhận', meta: '21/08/2026 16:30 · Ngô Thị Lan', state: 'ok' },
      { title: 'Chuyển Địa chính – Xây dựng xử lý', meta: '22/08/2026 08:00 · Trần Thị Hạnh', state: 'ok' },
      { title: 'Đang khảo sát, chuẩn bị vật liệu vá đường', meta: 'Từ 22/08/2026 · Lê Minh Tuấn', state: 'cur' },
    ],
  },
  {
    code: '#PA-1040',
    categoryLabel: 'Vệ sinh môi trường',
    title: 'Cống thoát nước tắc gây ngập Tổ dân phố số 4',
    excerpt: 'Mỗi khi mưa lớn, nước dâng ngập vào sân nhà dân khoảng 30cm, thoát rất chậm.',
    location: 'Tổ dân phố số 4',
    statusLabel: 'Đang xử lý',
    rating: 0,
    senderName: 'Tập thể Tổ dân phố số 4',
    senderPhone: '090•••765',
    sentAt: '17/08/2026 09:20',
    assignee: 'Lê Minh Tuấn',
    department: 'Địa chính – Xây dựng',
    timeline: [
      { title: 'Người dân gửi phản ánh tập thể', meta: '17/08/2026 09:20', state: 'ok' },
      { title: 'Trung tâm Phục vụ hành chính công tiếp nhận', meta: '17/08/2026 10:00 · Ngô Thị Lan', state: 'ok' },
      { title: 'Chuyển Địa chính – Xây dựng xử lý', meta: '17/08/2026 14:15 · Trần Thị Hạnh', state: 'ok' },
      { title: 'Đã nạo vét 2 hố ga, đang chờ bố trí kinh phí nâng cấp', meta: 'Từ 20/08/2026 · Lê Minh Tuấn', state: 'cur' },
    ],
  },
  {
    code: '#PA-1039',
    categoryLabel: 'Trật tự đô thị',
    title: 'Đèn chiếu sáng hỏng đoạn Tổ dân phố số 3',
    excerpt:
      '18 bộ đèn chiếu sáng công cộng không sáng gần một tháng, người dân đi lại buổi tối không an toàn.',
    location: 'Tổ dân phố số 3',
    statusLabel: 'Đã xử lý',
    rating: 5,
    ratingComment:
      'Cán bộ xã xử lý rất nhanh, chỉ sau 5 ngày đã thay xong toàn bộ đèn. Bà con trong tổ rất phấn khởi.',
    senderName: 'Ông Vũ Ngọc Bảo',
    senderPhone: '097•••201',
    sentAt: '02/08/2026 19:30',
    assignee: 'Lê Minh Tuấn',
    department: 'Địa chính – Xây dựng',
    linkedTaskCode: 'NV-2611',
    timeline: [
      { title: 'Người dân gửi phản ánh qua ứng dụng ViGov', meta: '02/08/2026 19:30', state: 'ok' },
      { title: 'Trung tâm Phục vụ hành chính công tiếp nhận', meta: '03/08/2026 08:05 · Ngô Thị Lan', state: 'ok' },
      { title: 'Chuyển Địa chính – Xây dựng, tạo nhiệm vụ NV-2611', meta: '03/08/2026 09:40 · Trần Thị Hạnh', state: 'ok' },
      { title: 'Thi công thay thế 18 bộ đèn, bổ sung 6 bộ mới', meta: '06/08/2026 · Lê Minh Tuấn', state: 'ok' },
      { title: 'Hoàn thành, người dân đánh giá 5 sao', meta: '08/08/2026 17:10 · Lê Minh Tuấn', state: 'ok' },
    ],
  },
  {
    code: '#PA-1038',
    categoryLabel: 'Rác thải',
    title: 'Quán ăn xả nước thải ra kênh Thôn Đoài',
    excerpt:
      'Quán ăn ven đường xả trực tiếp nước thải chưa qua xử lý ra kênh tiêu, nước đen và có mùi.',
    location: 'Thôn Đoài',
    statusLabel: 'Đang xử lý',
    rating: 0,
    senderName: 'Ông Lê Văn Hoà',
    senderPhone: '094•••887',
    sentAt: '19/08/2026 11:15',
    assignee: 'Vũ Đức Anh',
    department: 'Văn hoá – Xã hội',
    timeline: [
      { title: 'Người dân gửi phản ánh kèm video', meta: '19/08/2026 11:15', state: 'ok' },
      { title: 'Trung tâm Phục vụ hành chính công tiếp nhận', meta: '19/08/2026 13:40 · Ngô Thị Lan', state: 'ok' },
      { title: 'Chuyển Văn hoá – Xã hội phối hợp Công an xã', meta: '19/08/2026 15:00 · Trần Thị Hạnh', state: 'ok' },
      { title: 'Đã lập biên bản, yêu cầu cơ sở khắc phục trong 10 ngày', meta: 'Từ 20/08/2026 · Vũ Đức Anh', state: 'cur' },
    ],
  },
  {
    code: '#PA-1037',
    categoryLabel: 'An ninh',
    title: 'Tụ tập gây mất trật tự ban đêm khu chợ Đại Thắng',
    excerpt:
      'Một nhóm thanh niên thường xuyên tụ tập, nẹt pô sau 23 giờ gây ồn ào khu dân cư quanh chợ.',
    location: 'Tổ dân phố số 1',
    statusLabel: 'Đang xử lý',
    rating: 0,
    senderName: 'Bà Phạm Thị Xuân',
    senderPhone: '096•••330',
    sentAt: '20/08/2026 22:40',
    assignee: 'Hoàng Văn Sơn',
    department: 'Công an xã',
    timeline: [
      { title: 'Người dân gửi phản ánh qua tổng đài', meta: '20/08/2026 22:40', state: 'ok' },
      { title: 'Trực ban Công an xã tiếp nhận', meta: '20/08/2026 22:55 · Hoàng Văn Sơn', state: 'ok' },
      { title: 'Đang tăng cường tuần tra ban đêm khu vực chợ', meta: 'Từ 21/08/2026 · Hoàng Văn Sơn', state: 'cur' },
    ],
  },
  {
    code: '#PA-1036',
    categoryLabel: 'Xây dựng',
    title: 'Công trình xây dựng không che chắn Thôn Trung',
    excerpt:
      'Nhà dân đang xây không che chắn, vật liệu rơi vãi xuống đường gây nguy hiểm cho người qua lại.',
    location: 'Thôn Trung',
    statusLabel: 'Đã xử lý',
    rating: 4,
    ratingComment:
      'Xã có xuống kiểm tra và nhắc nhở chủ nhà. Xử lý được nhưng mong lần sau nhanh hơn một chút.',
    senderName: 'Ông Đinh Văn Cường',
    senderPhone: '098•••512',
    sentAt: '10/08/2026 08:25',
    assignee: 'Lê Minh Tuấn',
    department: 'Địa chính – Xây dựng',
    timeline: [
      { title: 'Người dân gửi phản ánh qua ứng dụng ViGov', meta: '10/08/2026 08:25', state: 'ok' },
      { title: 'Trung tâm Phục vụ hành chính công tiếp nhận', meta: '10/08/2026 09:10 · Ngô Thị Lan', state: 'ok' },
      { title: 'Chuyển Địa chính – Xây dựng kiểm tra', meta: '10/08/2026 10:30 · Trần Thị Hạnh', state: 'ok' },
      { title: 'Lập biên bản, yêu cầu chủ đầu tư che chắn', meta: '12/08/2026 · Lê Minh Tuấn', state: 'ok' },
      { title: 'Hoàn thành, người dân đánh giá 4 sao', meta: '14/08/2026 16:00 · Lê Minh Tuấn', state: 'ok' },
    ],
  },
  {
    code: '#PA-1035',
    categoryLabel: 'Cán bộ',
    title: 'Thủ tục cấp bản sao hộ tịch chờ lâu',
    excerpt: 'Người dân đến làm bản sao trích lục khai sinh phải chờ hơn 40 phút do máy in bị lỗi.',
    location: 'Tổ dân phố số 2',
    statusLabel: 'Đã xử lý',
    rating: 4,
    ratingComment:
      'Bộ phận một cửa đã xin lỗi và bố trí máy in dự phòng. Lần sau đi làm nhanh hơn hẳn.',
    senderName: 'Bà Nguyễn Thị Hoà',
    senderPhone: '093•••604',
    sentAt: '08/08/2026 10:05',
    assignee: 'Ngô Thị Lan',
    department: 'Trung tâm Phục vụ hành chính công',
    linkedTaskCode: 'NV-2614',
    timeline: [
      { title: 'Người dân góp ý tại quầy tiếp nhận', meta: '08/08/2026 10:05', state: 'ok' },
      { title: 'Trung tâm Phục vụ hành chính công ghi nhận', meta: '08/08/2026 10:20 · Ngô Thị Lan', state: 'ok' },
      { title: 'Bố trí máy in dự phòng, rà soát quy trình', meta: '09/08/2026 · Ngô Thị Lan', state: 'ok' },
      { title: 'Hoàn thành, người dân đánh giá 4 sao', meta: '11/08/2026 09:00 · Ngô Thị Lan', state: 'ok' },
    ],
  },
  {
    code: '#PA-1034',
    categoryLabel: 'Giao thông',
    title: 'Biển báo giao thông ngã ba Thôn Đông bị che khuất',
    excerpt: 'Cây xanh mọc um tùm che khuất biển báo giao hạn chế tốc độ tại ngã ba vào Thôn Đông.',
    location: 'Thôn Đông',
    statusLabel: 'Mới tiếp nhận',
    rating: 0,
    senderName: 'Ông Hoàng Minh Đức',
    senderPhone: '090•••977',
    sentAt: '22/08/2026 07:50',
    assignee: UNASSIGNED,
    department: UNASSIGNED,
    timeline: [
      { title: 'Người dân gửi phản ánh qua ứng dụng ViGov', meta: '22/08/2026 07:50', state: 'ok' },
      { title: 'Chờ Trung tâm Phục vụ hành chính công phân loại', meta: 'Từ 22/08/2026', state: 'cur' },
    ],
  },
];

/** 9 phiếu phản ánh đã chuyển đổi sang schema Feedback của backend */
export const FEEDBACK_SEED: FeedbackSeed[] = FEEDBACK_BASE.map((row) => {
  const categoryKey = CATEGORY_KEY_BY_LABEL[row.categoryLabel] ?? 'khac';
  const sentDate = parseVnDateTime(row.sentAt);
  const pin = PINS[row.code];
  const coords = pin ? pinToLatLng(pin) : undefined;

  return {
    code: row.code,
    categoryKey,
    title: row.title,
    description: row.excerpt,
    location: row.location,
    lat: coords?.lat,
    lng: coords?.lng,
    sentAt: row.sentAt,
    status: STATUS_BY_LABEL[row.statusLabel] ?? 'received',
    slaDueAt: addDays(sentDate, RESOLVE_DAYS_BY_CATEGORY[categoryKey] ?? 7),
    imageFileIds: [],
    resultImageFileIds: [],
    citizenPhone: unmaskPhone(row.senderPhone),
    citizenName: row.senderName,
    channel: 'app',
    assignee: row.assignee === UNASSIGNED ? '' : row.assignee,
    department: row.department === UNASSIGNED ? '' : row.department,
    timeline: row.timeline,
    rating: row.rating,
    ratingComment: row.ratingComment,
    linkedTaskCode: row.linkedTaskCode,
  };
});
