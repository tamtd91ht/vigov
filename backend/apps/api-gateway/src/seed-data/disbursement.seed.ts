/**
 * Dữ liệu seed phân hệ Ngân sách – Giải ngân (WBS #5)
 * — port từ admin-web/src/mocks/disbursement.ts (5 hạng mục HM-01…HM-05).
 * Mock dùng `id` còn schema dùng `code`; thêm `year: 2026` theo năm ngân sách
 * đang vận hành (budgetYearConfig.current).
 */
import type { BudgetItem, DisbursementEntry, DisbursementRequest } from '@vigov/shared';
import { endOfVnDay, parseVnDateTime, seedComment, vnDay } from './seed.util';

/**
 * Bản ghi seed — các mảng lồng nhau chỉ khai những trường có ý nghĩa cho dữ
 * liệu demo; phần còn lại do Mongoose điền mặc định lúc tạo (fileIds rỗng,
 * recordedAt là thời điểm chạy seed…).
 */
export type BudgetItemSeed = Omit<Partial<BudgetItem>, 'entries' | 'requests'> & {
  code: string;
  entries?: Partial<DisbursementEntry>[];
  requests?: Partial<DisbursementRequest>[];
};

/** Năm ngân sách của bộ dữ liệu demo */
export const BUDGET_YEAR = 2026;

export const BUDGET_ITEM_SEED: BudgetItemSeed[] = [
  {
    code: 'HM-01',
    name: 'Đường giao thông Thôn Đông',
    fundingSource: 'Ngân sách xã',
    fundingColor: 'var(--blue)',
    owner: 'Lê Minh Tuấn',
    year: BUDGET_YEAR,
    initialPlannedDong: 3_700_000_000,
    plannedDong: 3_700_000_000,
    actualDong: 3_200_000_000,
    approvalStatus: 'da-duyet',
    entries: [
      {
        date: vnDay('12/03/2026'),
        content: 'Tạm ứng hợp đồng thi công đợt 1',
        type: 'chi',
        amountDong: 1_100_000_000,
        vendor: 'Công ty TNHH Xây dựng Phú Thành',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 041/2026',
      },
      {
        date: vnDay('28/05/2026'),
        content: 'Thanh toán khối lượng hoàn thành đợt 1',
        type: 'chi',
        amountDong: 1_250_000_000,
        vendor: 'Công ty TNHH Xây dựng Phú Thành',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 118/2026',
      },
      {
        date: vnDay('30/07/2026'),
        content: 'Thanh toán khối lượng hoàn thành đợt 2',
        type: 'chi',
        amountDong: 850_000_000,
        vendor: 'Công ty TNHH Xây dựng Phú Thành',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 176/2026',
      },
    ],
    comments: [
      seedComment('Khối lượng thi công đạt 88%, dự kiến nghiệm thu toàn tuyến trong tháng 9/2026.', '02/08/2026 09:15'),
      seedComment('Đề nghị nhà thầu bổ sung hồ sơ nghiệm thu đợt 2 để hoàn thiện thủ tục thanh toán.', '05/08/2026 14:40'),
      seedComment('Đồng ý. Giao Địa chính – Xây dựng đôn đốc nhà thầu hoàn thiện trước 15/8/2026.', '06/08/2026 08:05'),
    ],
    obstacles: [
      { content: 'Nhà thầu chậm nộp hồ sơ nghiệm thu khối lượng đợt 2', owner: 'Lê Minh Tuấn', deadline: endOfVnDay('15/08/2026') },
      { content: 'Còn 2 hộ chưa bàn giao mặt bằng đoạn cuối tuyến', owner: 'Hoàng Văn Sơn', deadline: endOfVnDay('30/08/2026') },
    ],
    requests: [
      {
        code: 'DN-01',
        amountDong: 450_000_000,
        content: 'Thanh toán khối lượng hoàn thành đợt 3',
        vendor: 'Công ty TNHH Xây dựng Phú Thành',
        status: 'pending',
        requestedBy: 'Vũ Đức Anh',
        requestedAt: parseVnDateTime('24/08/2026 09:15'),
        decidedBy: '',
        rejectReason: '',
        voucherNo: '',
      },
    ],
  },
  {
    code: 'HM-02',
    name: 'Nhà văn hoá xã',
    fundingSource: 'Ngân sách huyện',
    fundingColor: 'var(--purple)',
    owner: 'Đỗ Thanh Hà',
    year: BUDGET_YEAR,
    initialPlannedDong: 4_200_000_000,
    plannedDong: 4_200_000_000,
    actualDong: 1_100_000_000,
    approvalStatus: 'da-duyet',
    entries: [
      {
        date: vnDay('20/04/2026'),
        content: 'Chi phí khảo sát, lập báo cáo kinh tế – kỹ thuật',
        type: 'chi',
        amountDong: 180_000_000,
        vendor: 'Công ty CP Tư vấn Đại Việt',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 072/2026',
      },
      {
        date: vnDay('15/06/2026'),
        content: 'Tạm ứng hợp đồng thi công phần móng',
        type: 'chi',
        amountDong: 920_000_000,
        vendor: 'Công ty TNHH Xây dựng Hoàng Long',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 135/2026',
      },
    ],
    comments: [
      seedComment('Hạng mục mới giải ngân 26% kế hoạch, chậm so với tiến độ đề ra khoảng 8 tuần.', '01/08/2026 10:20'),
      seedComment('Vướng mắc: thủ tục điều chỉnh thiết kế phần mái đang chờ Phòng Kinh tế – Hạ tầng huyện thẩm định, nhà thầu phải dừng thi công từ 20/7/2026.', '03/08/2026 15:35'),
      seedComment('Giao Tài chính – Kế toán làm việc trực tiếp với Phòng Kinh tế – Hạ tầng huyện trong tuần này, báo cáo Chủ tịch UBND xã trước ngày 12/8/2026.', '04/08/2026 08:50'),
    ],
    obstacles: [
      { content: 'Chờ thẩm định hồ sơ điều chỉnh thiết kế phần mái', owner: 'Đỗ Thanh Hà', deadline: endOfVnDay('12/08/2026') },
      { content: 'Chưa bố trí đủ vốn đối ứng của ngân sách xã', owner: 'Trần Thị Hạnh', deadline: endOfVnDay('25/08/2026') },
    ],
    requests: [
      {
        code: 'DN-01',
        amountDong: 800_000_000,
        content: 'Tạm ứng thi công phần móng và khung nhà',
        vendor: 'Công ty CP Xây lắp Hồng Hà',
        status: 'approved',
        requestedBy: 'Đỗ Thanh Hà',
        requestedAt: parseVnDateTime('18/08/2026 10:40'),
        decidedBy: 'Nguyễn Văn Bình',
        decidedAt: parseVnDateTime('20/08/2026 15:20'),
        rejectReason: '',
        voucherNo: '',
      },
      {
        code: 'DN-02',
        amountDong: 600_000_000,
        content: 'Thanh toán chi phí điều chỉnh thiết kế phần mái',
        vendor: 'Công ty CP Tư vấn Đại Việt',
        status: 'rejected',
        requestedBy: 'Đỗ Thanh Hà',
        requestedAt: parseVnDateTime('12/08/2026 08:05'),
        decidedBy: 'Nguyễn Văn Bình',
        decidedAt: parseVnDateTime('13/08/2026 16:45'),
        rejectReason:
          'Hồ sơ điều chỉnh thiết kế chưa được thẩm định. Bổ sung kết quả thẩm định rồi trình lại.',
        voucherNo: '',
      },
    ],
  },
  {
    code: 'HM-03',
    name: 'Nâng cấp Trạm y tế xã',
    fundingSource: 'Chương trình mục tiêu quốc gia',
    fundingColor: 'var(--green)',
    owner: 'Vũ Đức Anh',
    year: BUDGET_YEAR,
    initialPlannedDong: 2_400_000_000,
    plannedDong: 2_400_000_000,
    actualDong: 2_100_000_000,
    approvalStatus: 'da-duyet',
    entries: [
      {
        date: vnDay('10/02/2026'),
        content: 'Tạm ứng thi công cải tạo khối nhà chính',
        type: 'chi',
        amountDong: 700_000_000,
        vendor: 'Công ty TNHH Xây dựng Tân Tiến',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 022/2026',
      },
      {
        date: vnDay('18/05/2026'),
        content: 'Thanh toán khối lượng hoàn thành',
        type: 'chi',
        amountDong: 950_000_000,
        vendor: 'Công ty TNHH Xây dựng Tân Tiến',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 104/2026',
      },
      {
        date: vnDay('05/07/2026'),
        content: 'Mua sắm trang thiết bị y tế',
        type: 'chi',
        amountDong: 450_000_000,
        vendor: 'Công ty CP Thiết bị Y tế Hà Nội',
        by: 'Vũ Đức Anh',
        voucherNo: 'UNC 152/2026',
      },
    ],
    comments: [
      seedComment('Đã hoàn thành cải tạo khối nhà chính, đang lắp đặt trang thiết bị.', '28/07/2026 09:00'),
      seedComment('Vướng mắc: một số thiết bị nhập về chậm so với hợp đồng 3 tuần.', '29/07/2026 11:25'),
      seedComment('Đề nghị nhà cung cấp cam kết mốc bàn giao cụ thể, hoàn thành trước 20/8/2026.', '30/07/2026 08:15'),
    ],
    obstacles: [
      { content: 'Thiết bị y tế chuyên dụng về chậm so với hợp đồng', owner: 'Vũ Đức Anh', deadline: endOfVnDay('20/08/2026') },
      { content: 'Chưa hoàn thiện hồ sơ quyết toán giai đoạn 1', owner: 'Đỗ Thanh Hà', deadline: endOfVnDay('31/08/2026') },
    ],
    requests: [
      {
        code: 'DN-01',
        amountDong: 950_000_000,
        content: 'Thanh toán thiết bị y tế đợt 1',
        vendor: 'Công ty TNHH Thiết bị Y tế Hà Nội',
        status: 'pending',
        requestedBy: 'Vũ Đức Anh',
        requestedAt: parseVnDateTime('22/08/2026 16:30'),
        decidedBy: '',
        rejectReason: '',
        voucherNo: '',
      },
    ],
  },
  {
    code: 'HM-04',
    name: 'Hệ thống chiếu sáng công cộng',
    fundingSource: 'Ngân sách xã',
    fundingColor: 'var(--blue)',
    owner: 'Lê Minh Tuấn',
    year: BUDGET_YEAR,
    initialPlannedDong: 1_200_000_000,
    plannedDong: 1_200_000_000,
    actualDong: 1_100_000_000,
    approvalStatus: 'da-duyet',
    entries: [
      {
        date: vnDay('14/03/2026'),
        content: 'Mua sắm 240 bộ đèn LED chiếu sáng',
        type: 'chi',
        amountDong: 620_000_000,
        vendor: 'Công ty CP Thiết bị điện Thăng Long',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 048/2026',
      },
      {
        date: vnDay('22/06/2026'),
        content: 'Chi phí lắp đặt, đấu nối',
        type: 'chi',
        amountDong: 480_000_000,
        vendor: 'Hợp tác xã Dịch vụ điện Đại Thắng',
        by: 'Lê Minh Tuấn',
        voucherNo: 'UNC 141/2026',
      },
    ],
    comments: [
      seedComment('Đã lắp đặt xong 228/240 bộ đèn trên 12 tuyến đường thôn.', '25/07/2026 16:10'),
      seedComment('Vướng mắc: 12 bộ còn lại phụ thuộc tiến độ giải phóng mặt bằng đường liên thôn.', '26/07/2026 08:45'),
      seedComment('Chấp thuận lắp đặt sau khi bàn giao mặt bằng, không kéo dài quá 30/9/2026.', '26/07/2026 15:00'),
    ],
    obstacles: [
      { content: '12 bộ đèn chờ mặt bằng tuyến Đông – Trung', owner: 'Lê Minh Tuấn', deadline: endOfVnDay('30/09/2026') },
      { content: 'Chưa ký biên bản bàn giao quản lý cho các thôn', owner: 'Vũ Đức Anh', deadline: endOfVnDay('10/09/2026') },
    ],
    requests: [
      {
        code: 'DN-01',
        amountDong: 350_000_000,
        content: 'Thanh toán vật tư kênh mương đợt cuối',
        vendor: 'Công ty TNHH Vật liệu Xây dựng Sông Đà',
        status: 'approved',
        requestedBy: 'Hoàng Văn Sơn',
        requestedAt: parseVnDateTime('21/08/2026 11:20'),
        decidedBy: 'Nguyễn Văn Bình',
        decidedAt: parseVnDateTime('22/08/2026 09:10'),
        rejectReason: '',
        voucherNo: '',
      },
    ],
  },
  {
    code: 'HM-05',
    name: 'Kênh mương nội đồng Thôn Đoài',
    fundingSource: 'Vốn sự nghiệp nông nghiệp',
    fundingColor: 'var(--orange)',
    owner: 'Đỗ Thanh Hà',
    year: BUDGET_YEAR,
    initialPlannedDong: 1_000_000_000,
    plannedDong: 1_000_000_000,
    actualDong: 200_000_000,
    approvalStatus: 'da-duyet',
    entries: [
      {
        date: vnDay('08/05/2026'),
        content: 'Chi phí khảo sát, thiết kế bản vẽ thi công',
        type: 'chi',
        amountDong: 120_000_000,
        vendor: 'Công ty CP Tư vấn Đại Việt',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 096/2026',
      },
      {
        date: vnDay('19/07/2026'),
        content: 'Tạm ứng thi công đoạn K0+000 – K0+350',
        type: 'chi',
        amountDong: 80_000_000,
        vendor: 'Hợp tác xã Nông nghiệp Đại Thắng',
        by: 'Đỗ Thanh Hà',
        voucherNo: 'UNC 164/2026',
      },
    ],
    comments: [
      seedComment('Hạng mục mới đạt 20% kế hoạch vốn, chậm so với tiến độ khoảng 10 tuần.', '10/08/2026 09:30'),
      seedComment('Vướng mắc: phải chờ hết vụ lúa mùa mới thi công được đoạn qua cánh đồng Thôn Đoài.', '11/08/2026 10:05'),
      seedComment('Giao Tài chính – Kế toán xây dựng lại tiến độ chi tiết, bảo đảm giải ngân tối thiểu 80% trong năm 2026.', '11/08/2026 16:20'),
    ],
    obstacles: [
      { content: 'Chờ thu hoạch vụ lúa mùa mới thi công được', owner: 'Vũ Đức Anh', deadline: endOfVnDay('20/09/2026') },
      { content: 'Điều chỉnh tiến độ giải ngân trình UBND huyện', owner: 'Đỗ Thanh Hà', deadline: endOfVnDay('05/09/2026') },
    ],
    requests: [],
  },
];
