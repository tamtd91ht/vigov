/**
 * Dữ liệu seed phân hệ Văn bản đến & Đơn thư (WBS #4)
 * — port từ admin-web/src/mocks/documents.ts (8 văn bản đến + 6 đơn thư).
 *
 * Chuyển đổi so với mock:
 *   • thêm `kind`: 'incoming' cho văn bản đến, 'petition' cho đơn thư công dân;
 *   • thêm `deadlineAt` (Date cuối ngày) phục vụ CronJob nhắc hạn;
 *   • `ocrFields` để rỗng — chạy OCR thật ở bước sau (WBS #25).
 */
import type { IncomingDocument } from '@vigov/shared';
import { endOfVnDay, seedActivity } from './seed.util';

/**
 * Khoá hành động cho nhật ký của dữ liệu seed.
 *
 * Seed là nội dung DEMO: mỗi mốc là một câu tường thuật riêng nên dùng một khoá
 * chung và đặt cả câu vào `detail`. Mã nghiệp vụ thì ngược lại — mỗi hành động
 * một khoá riêng (xem `ACT` trong service của từng phân hệ).
 */
const ACT_NOTE = 'document.note';

export type DocumentSeed = Partial<IncomingDocument> & { arrivalNo: string };

/** Phần dữ liệu gốc từ mock (chưa gắn kind/deadlineAt) */
type DocumentBase = Omit<DocumentSeed, 'kind' | 'deadlineAt' | 'ocrFields'>;

const INCOMING_BASE: DocumentBase[] = [
  {
    arrivalNo: '412',
    refNo: '214/UBND-VP',
    date: '08/08/2026',
    sender: 'UBND huyện Phú Xuyên',
    summary: 'V/v báo cáo kết quả quản lý, sử dụng đất công ích và đất chưa sử dụng trên địa bàn',
    deadline: '19/08/2026',
    daysLeft: -3,
    department: 'Địa chính – Xây dựng',
    status: 'dangxl',
    docType: 'Công văn',
    confidentiality: 'Thường',
    urgency: 'Khẩn',
    signer: 'Phó Chủ tịch Nguyễn Đức Trung',
    pageCount: 4,
    linkedTaskCode: 'NV-2605',
    timeline: [
      seedActivity(ACT_NOTE, 'Văn phòng tiếp nhận, vào sổ văn bản đến', '08/08/2026 09:12 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Trình Chủ tịch UBND xã cho ý kiến', '08/08/2026 14:30 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Chuyển bộ phận Địa chính – Xây dựng chủ trì', '09/08/2026 08:05 · Nguyễn Văn Bình'),
      seedActivity(ACT_NOTE, 'Chuyển Tư pháp – Hộ tịch phối hợp rà soát pháp lý', '12/08/2026 10:40 · Lê Minh Tuấn'),
      seedActivity(ACT_NOTE, 'Đang xử lý — dự thảo văn bản phúc đáp', 'Từ 14/08/2026 · Lê Minh Tuấn', 'cur'),
    ],
  },
  {
    arrivalNo: '418',
    refNo: '1123/QĐ-UBND',
    date: '11/08/2026',
    sender: 'UBND Thành phố Hà Nội',
    summary: 'Quyết định phê duyệt kế hoạch sử dụng đất năm 2026 huyện Phú Xuyên',
    deadline: '25/08/2026',
    daysLeft: 2,
    department: 'Địa chính – Xây dựng',
    status: 'dangxl',
    docType: 'Quyết định',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Phó Chủ tịch Trần Quốc Hưng',
    pageCount: 12,
    timeline: [
      seedActivity(ACT_NOTE, 'Văn phòng tiếp nhận qua trục liên thông', '11/08/2026 07:55 · Hệ thống'),
      seedActivity(ACT_NOTE, 'Trình Chủ tịch UBND xã', '11/08/2026 10:20 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Chuyển Địa chính – Xây dựng nghiên cứu, triển khai', '12/08/2026 08:15 · Nguyễn Văn Bình'),
      seedActivity(ACT_NOTE, 'Đang xử lý — xây dựng kế hoạch triển khai', 'Từ 13/08/2026 · Lê Minh Tuấn', 'cur'),
    ],
  },
  {
    arrivalNo: '421',
    refNo: '198/UBND-VHXH',
    date: '12/08/2026',
    sender: 'UBND huyện Phú Xuyên',
    summary: 'V/v rà soát, bổ sung hồ sơ hộ nghèo, hộ cận nghèo Quý III năm 2026',
    deadline: '05/09/2026',
    daysLeft: 13,
    department: 'Văn hoá – Xã hội',
    status: 'dangxl',
    docType: 'Công văn',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Phó Chủ tịch Lê Thị Vân',
    pageCount: 3,
    linkedTaskCode: 'NV-2604',
    timeline: [
      seedActivity(ACT_NOTE, 'Văn phòng tiếp nhận, vào sổ văn bản đến', '12/08/2026 08:40 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Chuyển Văn hoá – Xã hội chủ trì', '12/08/2026 15:10 · Nguyễn Văn Bình'),
      seedActivity(ACT_NOTE, 'Đã tạo nhiệm vụ NV-2604 theo dõi', '13/08/2026 09:00 · Vũ Đức Anh', 'cur'),
    ],
  },
  {
    arrivalNo: '425',
    refNo: '87/TB-CAH',
    date: '14/08/2026',
    sender: 'Công an huyện Phú Xuyên',
    summary: 'Thông báo tình hình an ninh trật tự và phương án bảo đảm dịp Quốc khánh 2/9',
    deadline: '22/08/2026',
    daysLeft: -1,
    department: 'Công an xã',
    status: 'dangxl',
    docType: 'Thông báo',
    confidentiality: 'Mật',
    urgency: 'Khẩn',
    signer: 'Trưởng Công an huyện Phạm Văn Đông',
    pageCount: 6,
    timeline: [
      seedActivity(ACT_NOTE, 'Văn phòng tiếp nhận bản giấy', '14/08/2026 09:25 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Chuyển Công an xã chủ trì', '14/08/2026 11:00 · Nguyễn Văn Bình'),
      seedActivity(ACT_NOTE, 'Đang xử lý — xây dựng phương án', 'Từ 15/08/2026 · Hoàng Văn Sơn', 'cur'),
    ],
  },
  {
    arrivalNo: '429',
    refNo: '203/UBND-VP',
    date: '15/08/2026',
    sender: 'UBND huyện Phú Xuyên',
    summary: 'V/v báo cáo kết quả công tác cải cách hành chính 8 tháng đầu năm 2026',
    deadline: '31/08/2026',
    daysLeft: 8,
    department: 'Văn phòng UBND',
    status: 'dangxl',
    docType: 'Công văn',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Chánh Văn phòng Đinh Thị Mai',
    pageCount: 2,
    linkedTaskCode: 'NV-2612',
    timeline: [
      seedActivity(ACT_NOTE, 'Văn phòng tiếp nhận qua trục liên thông', '15/08/2026 08:02 · Hệ thống'),
      seedActivity(ACT_NOTE, 'Chuyển Văn phòng UBND chủ trì tổng hợp', '15/08/2026 09:30 · Nguyễn Văn Bình'),
      seedActivity(ACT_NOTE, 'Đang xử lý — chờ số liệu các bộ phận', 'Từ 16/08/2026 · Trần Thị Hạnh', 'cur'),
    ],
  },
  {
    arrivalNo: '433',
    refNo: '42/KH-UBND',
    date: '17/08/2026',
    sender: 'UBND huyện Phú Xuyên',
    summary: 'Kế hoạch số hoá dữ liệu hộ tịch giai đoạn 2015–2020 trên địa bàn huyện',
    deadline: '30/09/2026',
    daysLeft: 38,
    department: 'Tư pháp – Hộ tịch',
    status: 'dangxl',
    docType: 'Kế hoạch',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Phó Chủ tịch Lê Thị Vân',
    pageCount: 8,
    linkedTaskCode: 'NV-2608',
    timeline: [
      seedActivity(ACT_NOTE, 'Văn phòng tiếp nhận, vào sổ văn bản đến', '17/08/2026 08:15 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Chuyển Tư pháp – Hộ tịch chủ trì', '17/08/2026 14:00 · Nguyễn Văn Bình'),
      seedActivity(ACT_NOTE, 'Đang xử lý — triển khai nhiệm vụ NV-2608', 'Từ 18/08/2026 · Phạm Thị Ngọc', 'cur'),
    ],
  },
  {
    arrivalNo: '436',
    refNo: '176/UBND-TC',
    date: '18/08/2026',
    sender: 'Phòng Tài chính – Kế hoạch huyện',
    summary: 'V/v đôn đốc tiến độ giải ngân vốn đầu tư công năm 2026',
    deadline: '29/08/2026',
    daysLeft: 6,
    department: 'Tài chính – Kế toán',
    status: 'choduyet',
    docType: 'Công văn',
    confidentiality: 'Thường',
    urgency: 'Khẩn',
    signer: 'Trưởng phòng Nguyễn Hữu Thọ',
    pageCount: 5,
    linkedTaskCode: 'NV-2610',
    timeline: [
      seedActivity(ACT_NOTE, 'Văn phòng tiếp nhận qua trục liên thông', '18/08/2026 07:48 · Hệ thống'),
      seedActivity(ACT_NOTE, 'Chuyển Tài chính – Kế toán chủ trì', '18/08/2026 09:10 · Nguyễn Văn Bình'),
      seedActivity(ACT_NOTE, 'Dự thảo báo cáo trình Chủ tịch UBND xã ký', '20/08/2026 16:20 · Đỗ Thanh Hà', 'cur'),
    ],
  },
  {
    arrivalNo: '440',
    refNo: '51/GM-UBND',
    date: '20/08/2026',
    sender: 'UBND huyện Phú Xuyên',
    summary: 'Giấy mời dự Hội nghị sơ kết công tác chuyển đổi số cấp xã 8 tháng đầu năm',
    deadline: '27/08/2026',
    daysLeft: 4,
    department: 'Văn phòng UBND',
    status: 'moi',
    docType: 'Giấy mời',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Chánh Văn phòng Đinh Thị Mai',
    pageCount: 1,
    timeline: [
      seedActivity(ACT_NOTE, 'Văn phòng tiếp nhận qua trục liên thông', '20/08/2026 10:05 · Hệ thống'),
      seedActivity(ACT_NOTE, 'Chờ trình Chủ tịch UBND xã phân công dự', 'Từ 20/08/2026 · Trần Thị Hạnh', 'cur'),
    ],
  },
];

const PETITION_BASE: DocumentBase[] = [
  {
    arrivalNo: 'ĐT-087',
    refNo: 'Đơn kiến nghị',
    date: '09/08/2026',
    sender: 'Ông Nguyễn Văn Thắng — Thôn Đông',
    summary: 'Kiến nghị giải quyết tranh chấp ranh giới thửa đất số 214, tờ bản đồ số 7',
    deadline: '08/09/2026',
    daysLeft: 16,
    department: 'Địa chính – Xây dựng',
    status: 'dangxl',
    docType: 'Đơn kiến nghị',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Người làm đơn: Nguyễn Văn Thắng',
    pageCount: 3,
    timeline: [
      seedActivity(ACT_NOTE, 'Trung tâm Phục vụ hành chính công tiếp nhận', '09/08/2026 08:20 · Ngô Thị Lan'),
      seedActivity(ACT_NOTE, 'Chuyển Văn phòng UBND vào sổ theo dõi', '09/08/2026 10:15 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Chuyển Địa chính – Xây dựng xác minh', '10/08/2026 08:30 · Nguyễn Văn Bình'),
      seedActivity(ACT_NOTE, 'Đang xử lý — đã mời hai bên hoà giải lần 1', 'Từ 16/08/2026 · Lê Minh Tuấn', 'cur'),
    ],
  },
  {
    arrivalNo: 'ĐT-088',
    refNo: 'Đơn phản ánh',
    date: '12/08/2026',
    sender: 'Bà Trần Thị Mến — Tổ dân phố số 2',
    summary: 'Phản ánh hộ kinh doanh lấn chiếm vỉa hè gây cản trở giao thông',
    deadline: '27/08/2026',
    daysLeft: 4,
    department: 'Công an xã',
    status: 'dangxl',
    docType: 'Đơn phản ánh',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Người làm đơn: Trần Thị Mến',
    pageCount: 2,
    timeline: [
      seedActivity(ACT_NOTE, 'Trung tâm Phục vụ hành chính công tiếp nhận', '12/08/2026 09:40 · Ngô Thị Lan'),
      seedActivity(ACT_NOTE, 'Chuyển Công an xã kiểm tra, xử lý', '12/08/2026 15:00 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Đang xử lý — đã lập biên bản nhắc nhở', 'Từ 14/08/2026 · Hoàng Văn Sơn', 'cur'),
    ],
  },
  {
    arrivalNo: 'ĐT-089',
    refNo: 'Đơn đề nghị',
    date: '14/08/2026',
    sender: 'Ông Lê Văn Hoà — Thôn Đoài',
    summary: 'Đề nghị xác nhận tình trạng hôn nhân để hoàn thiện hồ sơ chuyển nhượng quyền sử dụng đất',
    deadline: '19/08/2026',
    daysLeft: -2,
    department: 'Tư pháp – Hộ tịch',
    status: 'dangxl',
    docType: 'Đơn đề nghị',
    confidentiality: 'Thường',
    urgency: 'Khẩn',
    signer: 'Người làm đơn: Lê Văn Hoà',
    pageCount: 2,
    timeline: [
      seedActivity(ACT_NOTE, 'Trung tâm Phục vụ hành chính công tiếp nhận', '14/08/2026 08:05 · Ngô Thị Lan'),
      seedActivity(ACT_NOTE, 'Chuyển Tư pháp – Hộ tịch thụ lý', '14/08/2026 09:30 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Đang xử lý — chờ xác minh nơi cư trú trước đây', 'Từ 15/08/2026 · Phạm Thị Ngọc', 'cur'),
    ],
  },
  {
    arrivalNo: 'ĐT-090',
    refNo: 'Đơn khiếu nại',
    date: '16/08/2026',
    sender: 'Bà Phạm Thị Xuân — Thôn Trung',
    summary: 'Khiếu nại về phương án bồi thường, hỗ trợ khi thu hồi đất làm đường liên thôn',
    deadline: '15/09/2026',
    daysLeft: 23,
    department: 'Văn phòng UBND',
    status: 'choduyet',
    docType: 'Đơn khiếu nại',
    confidentiality: 'Thường',
    urgency: 'Khẩn',
    signer: 'Người làm đơn: Phạm Thị Xuân',
    pageCount: 5,
    timeline: [
      seedActivity(ACT_NOTE, 'Trung tâm Phục vụ hành chính công tiếp nhận', '16/08/2026 08:50 · Ngô Thị Lan'),
      seedActivity(ACT_NOTE, 'Trình Chủ tịch UBND xã xem xét thẩm quyền', '16/08/2026 14:20 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Chờ ban hành quyết định thụ lý giải quyết', 'Từ 18/08/2026 · Nguyễn Văn Bình', 'cur'),
    ],
  },
  {
    arrivalNo: 'ĐT-091',
    refNo: 'Đơn kiến nghị',
    date: '18/08/2026',
    sender: 'Tập thể nhân dân Tổ dân phố số 4',
    summary: 'Kiến nghị nâng cấp hệ thống thoát nước khu dân cư tránh ngập úng mùa mưa',
    deadline: '17/09/2026',
    daysLeft: 25,
    department: 'Địa chính – Xây dựng',
    status: 'moi',
    docType: 'Đơn kiến nghị',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Đại diện: Tổ trưởng Vũ Ngọc Bảo',
    pageCount: 4,
    timeline: [
      seedActivity(ACT_NOTE, 'Trung tâm Phục vụ hành chính công tiếp nhận', '18/08/2026 09:15 · Ngô Thị Lan'),
      seedActivity(ACT_NOTE, 'Chờ phân công bộ phận chủ trì', 'Từ 18/08/2026 · Trần Thị Hạnh', 'cur'),
    ],
  },
  {
    arrivalNo: 'ĐT-092',
    refNo: 'Đơn đề nghị',
    date: '20/08/2026',
    sender: 'Ông Đinh Văn Cường — Thôn Đông',
    summary: 'Đề nghị hỗ trợ kinh phí học nghề cho lao động nông thôn theo chính sách hiện hành',
    deadline: '04/09/2026',
    daysLeft: 12,
    department: 'Văn hoá – Xã hội',
    status: 'dangxl',
    docType: 'Đơn đề nghị',
    confidentiality: 'Thường',
    urgency: 'Thường',
    signer: 'Người làm đơn: Đinh Văn Cường',
    pageCount: 2,
    timeline: [
      seedActivity(ACT_NOTE, 'Trung tâm Phục vụ hành chính công tiếp nhận', '20/08/2026 08:30 · Ngô Thị Lan'),
      seedActivity(ACT_NOTE, 'Chuyển Văn hoá – Xã hội thẩm định điều kiện', '20/08/2026 11:00 · Trần Thị Hạnh'),
      seedActivity(ACT_NOTE, 'Đang xử lý — đối chiếu danh sách lao động', 'Từ 21/08/2026 · Vũ Đức Anh', 'cur'),
    ],
  },
];

/** Gắn kind + deadlineAt, để ocrFields rỗng (OCR chạy sau) */
function withKind(rows: DocumentBase[], kind: 'incoming' | 'petition'): DocumentSeed[] {
  return rows.map((row) => ({
    ...row,
    kind,
    deadlineAt: row.deadline ? endOfVnDay(row.deadline) : undefined,
    ocrFields: [],
  }));
}

/** 8 văn bản đến + 6 đơn thư công dân */
export const DOCUMENT_SEED: DocumentSeed[] = [
  ...withKind(INCOMING_BASE, 'incoming'),
  ...withKind(PETITION_BASE, 'petition'),
];
