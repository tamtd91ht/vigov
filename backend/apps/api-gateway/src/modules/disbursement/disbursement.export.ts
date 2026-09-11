import { formatVnDateMs,
  BUDGET_APPROVAL_LABELS,
  BENEFICIARY_TYPE_LABELS,
  DISBURSEMENT_STATE_LABELS,
  SCHEDULE_STATE_LABELS,
  type BudgetApprovalStatus,} from '@vigov/shared';
import type { ListColumn } from '../reports/exporters/list-workbook';

/**
 * Khai báo cột cho tệp Excel danh sách hạng mục giải ngân.
 *
 * Số tiền xuất ra dạng SỐ (không phải chuỗi có chữ "đồng") để người nhận cộng
 * lại được bằng chính Excel và đối chiếu với sổ kế toán. Đơn vị ghi rõ trên tiêu
 * đề cột — viết đơn vị vào từng ô là bảng không tính toán được.
 *
 * KHÔNG có cột số tài khoản hay mã định danh cá nhân: phân hệ này không lưu hai
 * thứ đó (xem chú thích dữ liệu cá nhân ở đầu `budget.schema.ts`).
 */

interface BudgetRow {
  code?: string;
  name?: string;
  purpose?: string;
  expenseType?: string;
  budgetLevel?: string;
  fundingSource?: string;
  program?: string;
  owner?: string;
  beneficiary?: string;
  beneficiaryType?: string;
  year?: number;
  startDate?: number;
  endDate?: number;
  initialPlannedDong?: number;
  plannedDong?: number;
  actualDong?: number;
  remainingDong?: number;
  percent?: number | null;
  daysLeft?: number | null;
  approvalStatus?: string;
  disbursementState?: string;
  scheduleState?: string;
  adjustments?: unknown[];
  entries?: unknown[];
  documents?: unknown[];
}

export const BUDGET_EXPORT_COLUMNS: ListColumn<BudgetRow>[] = [
  { header: 'Mã hạng mục', value: (r) => r.code ?? '', width: 14 },
  { header: 'Tên hạng mục', value: (r) => r.name ?? '', width: 42 },
  { header: 'Nội dung, mục đích chi', value: (r) => r.purpose ?? '', width: 40 },
  { header: 'Loại chi', value: (r) => r.expenseType ?? '', width: 20 },
  { header: 'Cấp ngân sách', value: (r) => r.budgetLevel ?? '', width: 16 },
  { header: 'Nguồn vốn', value: (r) => r.fundingSource ?? '', width: 22 },
  { header: 'Dự án / chương trình', value: (r) => r.program ?? '', width: 26 },
  { header: 'Đơn vị thực hiện', value: (r) => r.owner ?? '', width: 22 },
  { header: 'Đối tượng thụ hưởng', value: (r) => r.beneficiary ?? '', width: 26 },
  {
    header: 'Loại đối tượng',
    value: (r) => BENEFICIARY_TYPE_LABELS[(r.beneficiaryType ?? 'khong-xac-dinh') as never] ?? '',
    width: 18,
  },
  { header: 'Năm ngân sách', value: (r) => r.year ?? '', width: 12, numeric: true },
  { header: 'Từ ngày', value: (r) => (r.startDate ? formatVnDateMs(r.startDate) : ''), width: 12 },
  { header: 'Đến ngày', value: (r) => (r.endDate ? formatVnDateMs(r.endDate) : ''), width: 12 },
  {
    header: 'Dự toán đầu năm (đồng)',
    value: (r) => r.initialPlannedDong ?? 0,
    width: 20,
    numeric: true,
  },
  {
    header: 'Kế hoạch vốn hiện hành (đồng)',
    value: (r) => r.plannedDong ?? 0,
    width: 22,
    numeric: true,
  },
  { header: 'Đã giải ngân (đồng)', value: (r) => r.actualDong ?? 0, width: 20, numeric: true },
  { header: 'Còn lại (đồng)', value: (r) => r.remainingDong ?? 0, width: 20, numeric: true },
  /* Tỷ lệ null nghĩa là CHƯA CÓ kế hoạch vốn — hiện "—" chứ không hiện 0%,
     hai thứ đó khác nhau và người đọc báo cáo phải phân biệt được. */
  {
    header: 'Tỷ lệ giải ngân (%)',
    value: (r) => (r.percent === null || r.percent === undefined ? '—' : r.percent),
    width: 16,
    numeric: true,
  },
  {
    header: 'Số lần điều chỉnh dự toán',
    value: (r) => (r.adjustments ?? []).length,
    width: 16,
    numeric: true,
  },
  { header: 'Số giao dịch', value: (r) => (r.entries ?? []).length, width: 12, numeric: true },
  { header: 'Số hồ sơ', value: (r) => (r.documents ?? []).length, width: 10, numeric: true },
  {
    header: 'Thời hạn còn lại (ngày)',
    value: (r) => {
      if (r.daysLeft === null || r.daysLeft === undefined) return 'Chưa đặt hạn';
      if (r.daysLeft < 0) return `Quá hạn ${Math.abs(r.daysLeft)} ngày`;
      if (r.daysLeft === 0) return 'Đến hạn hôm nay';
      return r.daysLeft;
    },
    width: 20,
  },
  {
    header: 'Trạng thái hồ sơ',
    value: (r) => BUDGET_APPROVAL_LABELS[(r.approvalStatus ?? '') as BudgetApprovalStatus] ?? '',
    width: 18,
  },
  {
    header: 'Mức giải ngân',
    value: (r) => DISBURSEMENT_STATE_LABELS[(r.disbursementState ?? '') as never] ?? '',
    width: 22,
  },
  {
    header: 'Tình trạng tiến độ',
    value: (r) => SCHEDULE_STATE_LABELS[(r.scheduleState ?? '') as never] ?? '',
    width: 20,
  },
];
