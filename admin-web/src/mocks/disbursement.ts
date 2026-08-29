import type { BudgetItem } from "@/types";

/**
 * Mock phân hệ Ngân sách / Giải ngân — port từ mockup đã duyệt (vigov-prototype.html).
 * Nguồn thật: API kế hoạch vốn + sổ giải ngân (P3).
 */

/**
 * Cấu hình năm ngân sách (mock cục bộ).
 * Câu hỏi mở #5: hệ thống theo dõi đa kỳ ngân sách (nhiều năm, chuyển nguồn) hay
 * chỉ năm hiện hành? Tạm thời chỉ năm hiện hành có dữ liệu.
 */
export const budgetYearConfig = {
  /** Năm ngân sách đang vận hành */
  current: 2026,
  /** Các năm có thể chọn — các năm cũ chưa có dữ liệu ở Phase 1 */
  years: [2026, 2025, 2024],
};

/** Số liệu tổng hợp giải ngân toàn xã */
export interface DisbursementSummary {
  /** Tổng kế hoạch vốn (tỷ đồng) */
  totalPlanned: number;
  /** Tổng đã giải ngân (tỷ đồng) */
  totalActual: number;
  /** Tỷ lệ giải ngân (%) */
  percent: number;
  /** Số hạng mục chậm tiến độ */
  delayedCount: number;
}

/** Số liệu tổng hợp giải ngân toàn xã (mock — nguồn thật: API thống kê) */
export const disbursementSummary: DisbursementSummary = {
  totalPlanned: 12.5, // tỷ đồng
  totalActual: 8.5, // tỷ đồng
  percent: 68,
  delayedCount: 2,
};

/** Danh sách hạng mục đầu tư — 5 hạng mục năm 2026 */
export const budgetItems: BudgetItem[] = [
  {
    id: "HM-01",
    name: "Đường giao thông Thôn Đông",
    fundingSource: "Ngân sách xã",
    fundingColor: "var(--blue)",
    owner: "Lê Minh Tuấn",
    planned: 3.7,
    actual: 3.2,
    delayed: false,
    entries: [
      {
        date: "12/03/2026",
        content: "Tạm ứng hợp đồng thi công đợt 1",
        amount: "1,10 tỷ",
        vendor: "Công ty TNHH Xây dựng Phú Thành",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 041/2026",
      },
      {
        date: "28/05/2026",
        content: "Thanh toán khối lượng hoàn thành đợt 1",
        amount: "1,25 tỷ",
        vendor: "Công ty TNHH Xây dựng Phú Thành",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 118/2026",
      },
      {
        date: "30/07/2026",
        content: "Thanh toán khối lượng hoàn thành đợt 2",
        amount: "0,85 tỷ",
        vendor: "Công ty TNHH Xây dựng Phú Thành",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 176/2026",
      },
    ],
    comments: [
      {
        authorName: "Lê Minh Tuấn",
        authorInitials: "LT",
        authorColor: "#3B82C4",
        time: "02/08/2026 09:15",
        content: "Khối lượng thi công đạt 88%, dự kiến nghiệm thu toàn tuyến trong tháng 9/2026.",
      },
      {
        authorName: "Đỗ Thanh Hà",
        authorInitials: "ĐH",
        authorColor: "#E67E22",
        time: "05/08/2026 14:40",
        content: "Đề nghị nhà thầu bổ sung hồ sơ nghiệm thu đợt 2 để hoàn thiện thủ tục thanh toán.",
      },
      {
        authorName: "Nguyễn Văn Bình",
        authorInitials: "NB",
        authorColor: "#1B3A5C",
        time: "06/08/2026 08:05",
        content: "Đồng ý. Giao Địa chính – Xây dựng đôn đốc nhà thầu hoàn thiện trước 15/8/2026.",
      },
    ],
    obstacles: [
      { content: "Nhà thầu chậm nộp hồ sơ nghiệm thu khối lượng đợt 2", owner: "Lê Minh Tuấn", deadline: "15/08/2026" },
      { content: "Còn 2 hộ chưa bàn giao mặt bằng đoạn cuối tuyến", owner: "Hoàng Văn Sơn", deadline: "30/08/2026" },
    ],
  },
  {
    id: "HM-02",
    name: "Nhà văn hoá xã",
    fundingSource: "Ngân sách huyện",
    fundingColor: "var(--purple)",
    owner: "Đỗ Thanh Hà",
    planned: 4.2,
    actual: 1.1,
    delayed: true,
    entries: [
      {
        date: "20/04/2026",
        content: "Chi phí khảo sát, lập báo cáo kinh tế – kỹ thuật",
        amount: "0,18 tỷ",
        vendor: "Công ty CP Tư vấn Đại Việt",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 072/2026",
      },
      {
        date: "15/06/2026",
        content: "Tạm ứng hợp đồng thi công phần móng",
        amount: "0,92 tỷ",
        vendor: "Công ty TNHH Xây dựng Hoàng Long",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 135/2026",
      },
    ],
    comments: [
      {
        authorName: "Đỗ Thanh Hà",
        authorInitials: "ĐH",
        authorColor: "#E67E22",
        time: "01/08/2026 10:20",
        content: "Hạng mục mới giải ngân 26% kế hoạch, chậm so với tiến độ đề ra khoảng 8 tuần.",
      },
      {
        authorName: "Lê Minh Tuấn",
        authorInitials: "LT",
        authorColor: "#3B82C4",
        time: "03/08/2026 15:35",
        content:
          "Vướng mắc: thủ tục điều chỉnh thiết kế phần mái đang chờ Phòng Kinh tế – Hạ tầng huyện thẩm định, nhà thầu phải dừng thi công từ 20/7/2026.",
      },
      {
        authorName: "Nguyễn Văn Bình",
        authorInitials: "NB",
        authorColor: "#1B3A5C",
        time: "04/08/2026 08:50",
        content:
          "Giao Tài chính – Kế toán làm việc trực tiếp với Phòng Kinh tế – Hạ tầng huyện trong tuần này, báo cáo Chủ tịch UBND xã trước ngày 12/8/2026.",
      },
    ],
    obstacles: [
      { content: "Chờ thẩm định hồ sơ điều chỉnh thiết kế phần mái", owner: "Đỗ Thanh Hà", deadline: "12/08/2026" },
      { content: "Chưa bố trí đủ vốn đối ứng của ngân sách xã", owner: "Trần Thị Hạnh", deadline: "25/08/2026" },
    ],
  },
  {
    id: "HM-03",
    name: "Nâng cấp Trạm y tế xã",
    fundingSource: "Chương trình mục tiêu quốc gia",
    fundingColor: "var(--green)",
    owner: "Vũ Đức Anh",
    planned: 2.4,
    actual: 2.1,
    delayed: false,
    entries: [
      {
        date: "10/02/2026",
        content: "Tạm ứng thi công cải tạo khối nhà chính",
        amount: "0,70 tỷ",
        vendor: "Công ty TNHH Xây dựng Tân Tiến",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 022/2026",
      },
      {
        date: "18/05/2026",
        content: "Thanh toán khối lượng hoàn thành",
        amount: "0,95 tỷ",
        vendor: "Công ty TNHH Xây dựng Tân Tiến",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 104/2026",
      },
      {
        date: "05/07/2026",
        content: "Mua sắm trang thiết bị y tế",
        amount: "0,45 tỷ",
        vendor: "Công ty CP Thiết bị Y tế Hà Nội",
        by: "Vũ Đức Anh",
        voucherNo: "UNC 152/2026",
      },
    ],
    comments: [
      {
        authorName: "Vũ Đức Anh",
        authorInitials: "VA",
        authorColor: "#27AE60",
        time: "28/07/2026 09:00",
        content: "Đã hoàn thành cải tạo khối nhà chính, đang lắp đặt trang thiết bị.",
      },
      {
        authorName: "Đỗ Thanh Hà",
        authorInitials: "ĐH",
        authorColor: "#E67E22",
        time: "29/07/2026 11:25",
        content: "Vướng mắc: một số thiết bị nhập về chậm so với hợp đồng 3 tuần.",
      },
      {
        authorName: "Trần Thị Hạnh",
        authorInitials: "TH",
        authorColor: "#E91E8C",
        time: "30/07/2026 08:15",
        content: "Đề nghị nhà cung cấp cam kết mốc bàn giao cụ thể, hoàn thành trước 20/8/2026.",
      },
    ],
    obstacles: [
      { content: "Thiết bị y tế chuyên dụng về chậm so với hợp đồng", owner: "Vũ Đức Anh", deadline: "20/08/2026" },
      { content: "Chưa hoàn thiện hồ sơ quyết toán giai đoạn 1", owner: "Đỗ Thanh Hà", deadline: "31/08/2026" },
    ],
  },
  {
    id: "HM-04",
    name: "Hệ thống chiếu sáng công cộng",
    fundingSource: "Ngân sách xã",
    fundingColor: "var(--blue)",
    owner: "Lê Minh Tuấn",
    planned: 1.2,
    actual: 1.1,
    delayed: false,
    entries: [
      {
        date: "14/03/2026",
        content: "Mua sắm 240 bộ đèn LED chiếu sáng",
        amount: "0,62 tỷ",
        vendor: "Công ty CP Thiết bị điện Thăng Long",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 048/2026",
      },
      {
        date: "22/06/2026",
        content: "Chi phí lắp đặt, đấu nối",
        amount: "0,48 tỷ",
        vendor: "Hợp tác xã Dịch vụ điện Đại Thắng",
        by: "Lê Minh Tuấn",
        voucherNo: "UNC 141/2026",
      },
    ],
    comments: [
      {
        authorName: "Lê Minh Tuấn",
        authorInitials: "LT",
        authorColor: "#3B82C4",
        time: "25/07/2026 16:10",
        content: "Đã lắp đặt xong 228/240 bộ đèn trên 12 tuyến đường thôn.",
      },
      {
        authorName: "Đỗ Thanh Hà",
        authorInitials: "ĐH",
        authorColor: "#E67E22",
        time: "26/07/2026 08:45",
        content: "Vướng mắc: 12 bộ còn lại phụ thuộc tiến độ giải phóng mặt bằng đường liên thôn.",
      },
      {
        authorName: "Nguyễn Văn Bình",
        authorInitials: "NB",
        authorColor: "#1B3A5C",
        time: "26/07/2026 15:00",
        content: "Chấp thuận lắp đặt sau khi bàn giao mặt bằng, không kéo dài quá 30/9/2026.",
      },
    ],
    obstacles: [
      { content: "12 bộ đèn chờ mặt bằng tuyến Đông – Trung", owner: "Lê Minh Tuấn", deadline: "30/09/2026" },
      { content: "Chưa ký biên bản bàn giao quản lý cho các thôn", owner: "Vũ Đức Anh", deadline: "10/09/2026" },
    ],
  },
  {
    id: "HM-05",
    name: "Kênh mương nội đồng Thôn Đoài",
    fundingSource: "Vốn sự nghiệp nông nghiệp",
    fundingColor: "var(--orange)",
    owner: "Đỗ Thanh Hà",
    planned: 1.0,
    actual: 0.2,
    delayed: true,
    entries: [
      {
        date: "08/05/2026",
        content: "Chi phí khảo sát, thiết kế bản vẽ thi công",
        amount: "0,12 tỷ",
        vendor: "Công ty CP Tư vấn Đại Việt",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 096/2026",
      },
      {
        date: "19/07/2026",
        content: "Tạm ứng thi công đoạn K0+000 – K0+350",
        amount: "0,08 tỷ",
        vendor: "Hợp tác xã Nông nghiệp Đại Thắng",
        by: "Đỗ Thanh Hà",
        voucherNo: "UNC 164/2026",
      },
    ],
    comments: [
      {
        authorName: "Đỗ Thanh Hà",
        authorInitials: "ĐH",
        authorColor: "#E67E22",
        time: "10/08/2026 09:30",
        content: "Hạng mục mới đạt 20% kế hoạch vốn, chậm so với tiến độ khoảng 10 tuần.",
      },
      {
        authorName: "Vũ Đức Anh",
        authorInitials: "VA",
        authorColor: "#27AE60",
        time: "11/08/2026 10:05",
        content: "Vướng mắc: phải chờ hết vụ lúa mùa mới thi công được đoạn qua cánh đồng Thôn Đoài.",
      },
      {
        authorName: "Nguyễn Văn Bình",
        authorInitials: "NB",
        authorColor: "#1B3A5C",
        time: "11/08/2026 16:20",
        content: "Giao Tài chính – Kế toán xây dựng lại tiến độ chi tiết, bảo đảm giải ngân tối thiểu 80% trong năm 2026.",
      },
    ],
    obstacles: [
      { content: "Chờ thu hoạch vụ lúa mùa mới thi công được", owner: "Vũ Đức Anh", deadline: "20/09/2026" },
      { content: "Điều chỉnh tiến độ giải ngân trình UBND huyện", owner: "Đỗ Thanh Hà", deadline: "05/09/2026" },
    ],
  },
];
