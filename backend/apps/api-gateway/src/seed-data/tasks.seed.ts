/**
 * Dữ liệu seed phân hệ Nhiệm vụ (WBS #3) — port từ admin-web/src/mocks/tasks.ts.
 * Mock dùng `id` (NV-2601) còn schema dùng `code`; `deadlineAt` sinh từ `deadline`
 * (dd/MM/yyyy, lấy mốc cuối ngày). Bình luận và nhật ký sinh theo đúng công thức
 * của mockTaskComments / mockTaskLog để giao diện có nội dung như bản demo.
 */
import type { Comment, Task, TimelineStep } from '@vigov/shared';
import { endOfVnDay } from './seed.util';

export type TaskSeed = Partial<Task> & { code: string };

/** Danh bạ cán bộ — khớp admin-web/src/mocks/directory.ts (viết tắt + màu avatar) */
const STAFF_BADGE: Record<string, { initials: string; color: string }> = {
  'Nguyễn Văn Bình': { initials: 'NB', color: '#1B3A5C' },
  'Trần Thị Hạnh': { initials: 'TH', color: '#E91E8C' },
  'Lê Minh Tuấn': { initials: 'LT', color: '#3B82C4' },
  'Phạm Thị Ngọc': { initials: 'PN', color: '#8E44AD' },
  'Vũ Đức Anh': { initials: 'VA', color: '#27AE60' },
  'Đỗ Thanh Hà': { initials: 'ĐH', color: '#E67E22' },
  'Hoàng Văn Sơn': { initials: 'HS', color: '#17A2A2' },
  'Ngô Thị Lan': { initials: 'NL', color: '#E74C3C' },
  'Bùi Quang Khải': { initials: 'BK', color: '#5B6C8F' },
};

const FALLBACK_BADGE = { initials: 'CB', color: '#8896A6' };

/** Nhãn trạng thái nhiệm vụ để ghi nhật ký */
const STATUS_LABELS: Record<string, string> = {
  moi: 'Mới giao',
  dang: 'Đang thực hiện',
  cho: 'Chờ duyệt',
  qua: 'Quá hạn',
  xong: 'Hoàn thành',
};

/** 3 bộ hội thoại trao đổi — port nguyên văn COMMENT_SETS của mock */
const COMMENT_SETS: string[][] = [
  [
    'Đã hoàn thành các bước đầu, hiện còn vướng khâu tổng hợp số liệu từ các thôn. Đề nghị bộ phận phối hợp hỗ trợ thêm.',
    'Bộ phận chúng tôi sẽ gửi số liệu trong ngày mai để đồng chí tổng hợp kịp thời hạn.',
    'Đề nghị đồng chí bám sát tiến độ, báo cáo Thường trực UBND xã trước ngày hết hạn 01 ngày.',
  ],
  [
    'Báo cáo lãnh đạo: khối lượng công việc đã đạt yêu cầu theo kế hoạch, phần còn lại tập trung hoàn thiện hồ sơ.',
    'Tôi đã rà soát dự thảo, đề nghị bổ sung phần căn cứ pháp lý cho đầy đủ.',
    'Thống nhất. Giao Văn phòng UBND theo dõi, tổng hợp vào báo cáo tuần.',
  ],
  [
    'Hiện trường đã được kiểm tra, biên bản lập đầy đủ. Đề xuất bố trí kinh phí để triển khai bước tiếp theo.',
    'Tài chính – Kế toán đã tiếp nhận đề xuất, sẽ cân đối trong dự toán quý này.',
    'Đồng ý chủ trương. Đề nghị các bộ phận phối hợp chặt chẽ, không để chậm tiến độ.',
  ],
];

/** Tệp đính kèm minh chứng — port taskAttachments của mock */
export const TASK_ATTACHMENTS: string[] = [
  'Bien-ban-hien-truong.jpg',
  'Anh-minh-chung-02.jpg',
  'Bao-cao-tien-do.pdf',
];

/** Phần dữ liệu gốc lấy nguyên trạng từ mock (chưa có comments/timeline) */
interface TaskBase {
  code: string;
  title: string;
  sourceLabel: string;
  sourceType: string;
  sourceRefId?: string;
  assignee: string;
  department: string;
  deadline: string;
  progress: number;
  status: string;
  priority: string;
  assigner: string;
  collaborators: string[];
  description: string;
  checklist: { title: string; done: boolean }[];
}

const TASK_BASE: TaskBase[] = [
  {
    code: 'NV-2601',
    title: 'Rà soát quỹ đất công ích năm 2026',
    sourceLabel: 'Từ kết luận họp 12/8',
    sourceType: 'hop',
    assignee: 'Lê Minh Tuấn',
    department: 'Địa chính – Xây dựng',
    deadline: '30/08/2026',
    progress: 65,
    status: 'dang',
    priority: 'cao',
    assigner: 'Nguyễn Văn Bình',
    collaborators: ['Đỗ Thanh Hà', 'Trần Thị Hạnh'],
    description:
      'Rà soát, thống kê toàn bộ diện tích đất công ích (đất 5%) trên địa bàn xã; đối chiếu hồ sơ địa chính với hiện trạng sử dụng; lập danh sách các trường hợp sử dụng sai mục đích, báo cáo UBND huyện trước ngày 30/8/2026.',
    checklist: [
      { title: 'Trích lục hồ sơ địa chính 8 thôn, tổ dân phố', done: true },
      { title: 'Đo đạc, kiểm tra hiện trạng thực địa', done: true },
      { title: 'Lập biên bản các trường hợp sử dụng sai mục đích', done: false },
      { title: 'Dự thảo báo cáo gửi Phòng Tài nguyên và Môi trường huyện', done: false },
    ],
  },
  {
    code: 'NV-2602',
    title: 'Chuẩn bị nội dung kỳ họp HĐND xã',
    sourceLabel: 'Từ kết luận họp 12/8',
    sourceType: 'hop',
    assignee: 'Trần Thị Hạnh',
    department: 'Văn phòng UBND',
    deadline: '26/08/2026',
    progress: 80,
    status: 'cho',
    priority: 'cao',
    assigner: 'Nguyễn Văn Bình',
    collaborators: ['Đỗ Thanh Hà'],
    description:
      'Xây dựng tài liệu phục vụ kỳ họp thường lệ HĐND xã tháng 9/2026: báo cáo tình hình kinh tế – xã hội 8 tháng, tờ trình điều chỉnh dự toán ngân sách, dự thảo nghị quyết.',
    checklist: [
      { title: 'Dự thảo báo cáo kinh tế – xã hội 8 tháng', done: true },
      { title: 'Tờ trình điều chỉnh dự toán ngân sách xã', done: true },
      { title: 'Trình Thường trực HĐND xã cho ý kiến', done: false },
    ],
  },
  {
    code: 'NV-2603',
    title: 'Xử lý ô nhiễm kênh tiêu Thôn Đoài',
    sourceLabel: 'Từ phản ánh #PA-1042',
    sourceType: 'pa',
    sourceRefId: '#PA-1042',
    assignee: 'Vũ Đức Anh',
    department: 'Văn hoá – Xã hội',
    deadline: '21/08/2026',
    progress: 45,
    status: 'qua',
    priority: 'cao',
    assigner: 'Trần Thị Hạnh',
    collaborators: ['Hoàng Văn Sơn', 'Lê Minh Tuấn'],
    description:
      'Kiểm tra, xác minh nguồn xả thải gây ô nhiễm đoạn kênh tiêu qua Thôn Đoài; yêu cầu cơ sở vi phạm khắc phục; tổ chức nạo vét, khơi thông dòng chảy.',
    checklist: [
      { title: 'Kiểm tra hiện trường, lấy mẫu nước', done: true },
      { title: 'Lập biên bản làm việc với cơ sở chế biến', done: true },
      { title: 'Tổ chức nạo vét đoạn kênh 420m', done: false },
      { title: 'Báo cáo kết quả về UBND xã', done: false },
    ],
  },
  {
    code: 'NV-2604',
    title: 'Hoàn thiện hồ sơ hộ nghèo Quý III',
    sourceLabel: 'Từ CV 198/UBND-VHXH',
    sourceType: 'vb',
    sourceRefId: '421',
    assignee: 'Vũ Đức Anh',
    department: 'Văn hoá – Xã hội',
    deadline: '05/09/2026',
    progress: 30,
    status: 'dang',
    priority: 'tb',
    assigner: 'Trần Thị Hạnh',
    collaborators: ['Ngô Thị Lan'],
    description:
      'Rà soát, bổ sung hồ sơ hộ nghèo, hộ cận nghèo Quý III/2026 theo chuẩn nghèo đa chiều giai đoạn 2022–2026; niêm yết công khai danh sách tại nhà văn hoá các thôn.',
    checklist: [
      { title: 'Thu thập phiếu rà soát tại 8 thôn, tổ dân phố', done: true },
      { title: 'Chấm điểm theo chuẩn nghèo đa chiều', done: false },
      { title: 'Niêm yết công khai danh sách 10 ngày', done: false },
    ],
  },
  {
    code: 'NV-2605',
    title: 'Phúc đáp Công văn 214/UBND-VP',
    sourceLabel: 'Từ CV 214/UBND',
    sourceType: 'vb',
    sourceRefId: '412',
    assignee: 'Lê Minh Tuấn',
    department: 'Địa chính – Xây dựng',
    deadline: '19/08/2026',
    progress: 55,
    status: 'qua',
    priority: 'cao',
    assigner: 'Nguyễn Văn Bình',
    collaborators: ['Phạm Thị Ngọc'],
    description:
      'Phúc đáp Công văn số 214/UBND-VP ngày 08/8/2026 của UBND huyện về việc báo cáo kết quả quản lý, sử dụng đất công ích và đất chưa sử dụng trên địa bàn.',
    checklist: [
      { title: 'Tổng hợp số liệu từ hồ sơ địa chính', done: true },
      { title: 'Dự thảo văn bản phúc đáp', done: true },
      { title: 'Trình Chủ tịch UBND xã ký ban hành', done: false },
    ],
  },
  {
    code: 'NV-2606',
    title: 'Giải phóng mặt bằng đường liên thôn Đông – Trung',
    sourceLabel: 'Từ kết luận họp 05/8',
    sourceType: 'hop',
    assignee: 'Lê Minh Tuấn',
    department: 'Địa chính – Xây dựng',
    deadline: '15/09/2026',
    progress: 25,
    status: 'dang',
    priority: 'cao',
    assigner: 'Nguyễn Văn Bình',
    collaborators: ['Đỗ Thanh Hà', 'Hoàng Văn Sơn'],
    description:
      'Tổ chức kiểm đếm, lập phương án bồi thường, hỗ trợ giải phóng mặt bằng tuyến đường liên thôn Đông – Trung dài 1,8km; vận động 34 hộ dân bàn giao mặt bằng.',
    checklist: [
      { title: 'Thành lập Tổ công tác giải phóng mặt bằng', done: true },
      { title: 'Kiểm đếm tài sản trên đất của 34 hộ', done: false },
      { title: 'Niêm yết phương án bồi thường, hỗ trợ', done: false },
      { title: 'Tổ chức đối thoại với các hộ chưa đồng thuận', done: false },
    ],
  },
  {
    code: 'NV-2607',
    title: 'Cấp phát trang thiết bị phòng chống thiên tai',
    sourceLabel: 'Từ CV 187/UBND-QS',
    sourceType: 'vb',
    assignee: 'Bùi Quang Khải',
    department: 'Quân sự xã',
    deadline: '28/08/2026',
    progress: 0,
    status: 'moi',
    priority: 'tb',
    assigner: 'Nguyễn Văn Bình',
    collaborators: ['Đỗ Thanh Hà'],
    description:
      'Tiếp nhận, phân bổ trang thiết bị, vật tư phòng chống thiên tai và tìm kiếm cứu nạn năm 2026 cho lực lượng xung kích 8 thôn, tổ dân phố.',
    checklist: [
      { title: 'Lập danh sách nhu cầu của từng thôn', done: false },
      { title: 'Tiếp nhận vật tư từ Ban Chỉ huy huyện', done: false },
      { title: 'Bàn giao, ký nhận tại các thôn', done: false },
    ],
  },
  {
    code: 'NV-2608',
    title: 'Số hoá hồ sơ hộ tịch giai đoạn 2015–2020',
    sourceLabel: 'Từ Kế hoạch 42/KH-UBND',
    sourceType: 'vb',
    sourceRefId: '433',
    assignee: 'Phạm Thị Ngọc',
    department: 'Tư pháp – Hộ tịch',
    deadline: '30/09/2026',
    progress: 52,
    status: 'dang',
    priority: 'tb',
    assigner: 'Trần Thị Hạnh',
    collaborators: ['Ngô Thị Lan'],
    description:
      'Quét, chuẩn hoá và cập nhật 6.480 hồ sơ hộ tịch giai đoạn 2015–2020 lên Hệ thống thông tin đăng ký và quản lý hộ tịch dùng chung.',
    checklist: [
      { title: 'Phân loại, sắp xếp sổ gốc theo năm', done: true },
      { title: 'Quét và đặt tên tệp theo quy chuẩn', done: true },
      { title: 'Nhập liệu, đối chiếu dữ liệu dân cư', done: false },
    ],
  },
  {
    code: 'NV-2609',
    title: 'Kiểm tra an toàn thực phẩm dịp Tết Trung thu',
    sourceLabel: 'Từ kết luận họp 12/8',
    sourceType: 'hop',
    assignee: 'Ngô Thị Lan',
    department: 'Trung tâm Phục vụ hành chính công',
    deadline: '12/09/2026',
    progress: 0,
    status: 'moi',
    priority: 'thap',
    assigner: 'Trần Thị Hạnh',
    collaborators: ['Hoàng Văn Sơn'],
    description:
      'Thành lập đoàn kiểm tra liên ngành, kiểm tra điều kiện an toàn thực phẩm tại 26 cơ sở sản xuất, kinh doanh bánh kẹo trên địa bàn dịp Tết Trung thu 2026.',
    checklist: [
      { title: 'Ban hành quyết định thành lập đoàn kiểm tra', done: false },
      { title: 'Kiểm tra 26 cơ sở trên địa bàn', done: false },
      { title: 'Công khai kết quả kiểm tra', done: false },
    ],
  },
  {
    code: 'NV-2610',
    title: 'Quyết toán kinh phí hoạt động Quý II/2026',
    sourceLabel: 'Từ CV 176/UBND-TC',
    sourceType: 'vb',
    sourceRefId: '436',
    assignee: 'Đỗ Thanh Hà',
    department: 'Tài chính – Kế toán',
    deadline: '18/08/2026',
    progress: 100,
    status: 'xong',
    priority: 'tb',
    assigner: 'Nguyễn Văn Bình',
    collaborators: [],
    description:
      'Lập báo cáo quyết toán kinh phí hoạt động thường xuyên Quý II/2026, gửi Phòng Tài chính – Kế hoạch huyện thẩm định.',
    checklist: [
      { title: 'Đối chiếu chứng từ chi thường xuyên', done: true },
      { title: 'Lập báo cáo quyết toán theo biểu mẫu', done: true },
      { title: 'Gửi Phòng Tài chính – Kế hoạch huyện', done: true },
    ],
  },
  {
    code: 'NV-2611',
    title: 'Lắp đặt hệ thống chiếu sáng Tổ dân phố số 3',
    sourceLabel: 'Từ phản ánh #PA-1028',
    sourceType: 'pa',
    sourceRefId: '#PA-1039',
    assignee: 'Lê Minh Tuấn',
    department: 'Địa chính – Xây dựng',
    deadline: '14/08/2026',
    progress: 100,
    status: 'xong',
    priority: 'tb',
    assigner: 'Trần Thị Hạnh',
    collaborators: ['Đỗ Thanh Hà'],
    description:
      'Thay thế 18 bộ đèn chiếu sáng công cộng hỏng và bổ sung 6 bộ mới trên tuyến đường Tổ dân phố số 3 theo phản ánh của người dân.',
    checklist: [
      { title: 'Khảo sát, lập dự toán', done: true },
      { title: 'Thi công thay thế 18 bộ đèn', done: true },
      { title: 'Nghiệm thu, bàn giao cho tổ dân phố', done: true },
    ],
  },
  {
    code: 'NV-2612',
    title: 'Tổng hợp báo cáo cải cách hành chính 8 tháng',
    sourceLabel: 'Từ CV 203/UBND-VP',
    sourceType: 'vb',
    sourceRefId: '429',
    assignee: 'Trần Thị Hạnh',
    department: 'Văn phòng UBND',
    deadline: '31/08/2026',
    progress: 70,
    status: 'cho',
    priority: 'tb',
    assigner: 'Nguyễn Văn Bình',
    collaborators: ['Ngô Thị Lan'],
    description:
      'Tổng hợp kết quả thực hiện công tác cải cách hành chính 8 tháng đầu năm 2026, đánh giá chỉ số hài lòng của người dân đối với dịch vụ công.',
    checklist: [
      { title: 'Thu thập số liệu từ các bộ phận', done: true },
      { title: 'Phân tích chỉ số hài lòng', done: true },
      { title: 'Hoàn thiện báo cáo trình ký', done: false },
    ],
  },
  {
    code: 'NV-2613',
    title: 'Bảo đảm an ninh trật tự dịp Quốc khánh 2/9',
    sourceLabel: 'Từ Kế hoạch 51/KH-CAX',
    sourceType: 'vb',
    assignee: 'Hoàng Văn Sơn',
    department: 'Công an xã',
    deadline: '03/09/2026',
    progress: 40,
    status: 'dang',
    priority: 'cao',
    assigner: 'Nguyễn Văn Bình',
    collaborators: ['Bùi Quang Khải'],
    description:
      'Xây dựng và triển khai phương án bảo đảm an ninh trật tự, an toàn giao thông trên địa bàn xã dịp kỷ niệm Quốc khánh 2/9/2026.',
    checklist: [
      { title: 'Xây dựng phương án, phân công lực lượng', done: true },
      { title: 'Tuần tra, kiểm soát địa bàn trọng điểm', done: false },
      { title: 'Báo cáo kết quả sau đợt cao điểm', done: false },
    ],
  },
  {
    code: 'NV-2614',
    title: 'Cập nhật dữ liệu hộ kinh doanh cá thể',
    sourceLabel: 'Từ phản ánh #PA-1035',
    sourceType: 'pa',
    sourceRefId: '#PA-1035',
    assignee: 'Ngô Thị Lan',
    department: 'Trung tâm Phục vụ hành chính công',
    deadline: '17/08/2026',
    progress: 60,
    status: 'qua',
    priority: 'tb',
    assigner: 'Trần Thị Hạnh',
    collaborators: ['Đỗ Thanh Hà'],
    description:
      'Rà soát, cập nhật thông tin 1.812 hộ kinh doanh cá thể lên bản đồ kinh tế số của xã; bổ sung ngành nghề, quy mô lao động.',
    checklist: [
      { title: 'Đối chiếu danh sách với cơ quan thuế', done: true },
      { title: 'Khảo sát bổ sung tại 3 chợ trên địa bàn', done: true },
      { title: 'Cập nhật lên bản đồ kinh tế số', done: false },
    ],
  },
  {
    code: 'NV-2615',
    title: 'Sửa chữa, chống xuống cấp Nhà văn hoá Thôn Trung',
    sourceLabel: 'Từ kết luận họp 05/8',
    sourceType: 'hop',
    assignee: 'Đỗ Thanh Hà',
    department: 'Tài chính – Kế toán',
    deadline: '22/09/2026',
    progress: 15,
    status: 'moi',
    priority: 'thap',
    assigner: 'Nguyễn Văn Bình',
    collaborators: ['Lê Minh Tuấn'],
    description:
      'Bố trí kinh phí, tổ chức sửa chữa mái, hệ thống điện và sân Nhà văn hoá Thôn Trung đã xuống cấp sau mùa mưa bão.',
    checklist: [
      { title: 'Khảo sát, lập dự toán sửa chữa', done: true },
      { title: 'Trình phê duyệt nguồn kinh phí', done: false },
      { title: 'Lựa chọn đơn vị thi công', done: false },
    ],
  },
];

/** Một bình luận với avatar lấy theo danh bạ cán bộ */
function buildComment(name: string, time: string, content: string): Comment {
  const badge = STAFF_BADGE[name] ?? FALLBACK_BADGE;
  return {
    authorName: name,
    authorInitials: badge.initials,
    authorColor: badge.color,
    time,
    content,
  };
}

/** 3 bình luận trao đổi — cùng công thức với mockTaskComments của admin-web */
function buildComments(task: TaskBase): Comment[] {
  const set = COMMENT_SETS[Number.parseInt(task.code.slice(-2), 10) % COMMENT_SETS.length];
  const collaborator = task.collaborators[0] ?? task.assigner;
  return [
    buildComment(task.assignee, '19/08/2026 09:20', set[0]),
    buildComment(collaborator, '20/08/2026 14:05', set[1]),
    buildComment(task.assigner, '21/08/2026 08:35', set[2]),
  ];
}

/** Nhật ký xử lý — cùng công thức với mockTaskLog của admin-web */
function buildTimeline(task: TaskBase): TimelineStep[] {
  const statusLabel = STATUS_LABELS[task.status] ?? task.status;
  return [
    {
      title: `Tạo nhiệm vụ và giao chủ trì cho ${task.assignee}`,
      meta: `12/08/2026 08:10 · ${task.assigner}`,
      state: 'ok',
    },
    {
      title: `Bổ sung cán bộ phối hợp: ${task.collaborators.join(', ') || 'không có'}`,
      meta: `12/08/2026 09:25 · ${task.assigner}`,
      state: 'ok',
    },
    {
      title: `Cập nhật tiến độ từ 0% lên ${Math.max(0, task.progress - 25)}%`,
      meta: `16/08/2026 15:40 · ${task.assignee}`,
      state: 'ok',
    },
    {
      title: `Cập nhật tiến độ lên ${task.progress}% · Trạng thái: ${statusLabel}`,
      meta: `22/08/2026 16:30 · ${task.assignee}`,
      state: 'cur',
    },
  ];
}

/** 15 nhiệm vụ NV-2601…NV-2615 đã chuyển đổi sang schema Task của backend */
export const TASK_SEED: TaskSeed[] = TASK_BASE.map((task) => ({
  ...task,
  deadlineAt: endOfVnDay(task.deadline),
  comments: buildComments(task),
  timeline: buildTimeline(task),
  attachments: TASK_ATTACHMENTS,
}));
