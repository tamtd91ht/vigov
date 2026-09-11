import type { ListColumn } from '../reports/exporters/list-workbook';

/**
 * Khai báo cột cho tệp Excel danh sách nhiệm vụ.
 *
 * Tách khỏi controller để chỗ này chỉ còn là bảng "cột nào lấy trường nào" —
 * thêm cột thì sửa một mảng, không đụng vào luồng HTTP.
 *
 * KHÔNG có cột nào chứa dữ liệu cá nhân công dân: nhiệm vụ là việc nội bộ giữa
 * các bộ phận, `assignee` là tên cán bộ (đã có tài khoản, không phải công dân).
 */

/** Nhãn tiếng Việt của trạng thái và mức ưu tiên — khớp status.config.ts của admin-web */
export const TASK_STATUS_LABELS: Record<string, string> = {
  moi: 'Mới giao',
  dang: 'Đang thực hiện',
  cho: 'Chờ duyệt',
  qua: 'Quá hạn',
  xong: 'Hoàn thành',
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  cao: 'Cao',
  tb: 'Trung bình',
  thap: 'Thấp',
};

const SOURCE_LABELS: Record<string, string> = {
  vb: 'Văn bản đến',
  pa: 'Phản ánh của người dân',
  hop: 'Kết luận họp',
};

/** Một dòng nhiệm vụ đọc từ Mongo (bản lean) */
interface TaskRow {
  code?: string;
  title?: string;
  assignee?: string;
  department?: string;
  status?: string;
  priority?: string;
  progress?: number;
  deadline?: string;
  sourceType?: string;
  sourceLabel?: string;
  collaborators?: string[];
  createdAt?: Date | string;
}

/** `dd/MM/yyyy` theo giờ Việt Nam từ một mốc thời gian của Mongo */
function vnDate(value?: Date | string): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const vn = new Date(d.getTime() + 7 * 60 * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(vn.getUTCDate())}/${p(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
}

export const TASK_EXPORT_COLUMNS: ListColumn<TaskRow>[] = [
  { header: 'Mã nhiệm vụ', value: (r) => r.code ?? '', width: 14 },
  { header: 'Tên nhiệm vụ', value: (r) => r.title ?? '', width: 46 },
  { header: 'Bộ phận chủ trì', value: (r) => r.department ?? '', width: 22 },
  { header: 'Người thực hiện', value: (r) => r.assignee ?? '', width: 20 },
  {
    header: 'Phối hợp',
    value: (r) => (r.collaborators ?? []).join(', '),
    width: 24,
  },
  {
    header: 'Mức ưu tiên',
    value: (r) => TASK_PRIORITY_LABELS[r.priority ?? ''] ?? r.priority ?? '',
    width: 14,
  },
  {
    header: 'Trạng thái',
    value: (r) => TASK_STATUS_LABELS[r.status ?? ''] ?? r.status ?? '',
    width: 16,
  },
  // Tiến độ 0 phải hiện "0%", không được để trống — xem skills/bao-cao-va-xuat-file
  { header: 'Tiến độ', value: (r) => `${r.progress ?? 0}%`, width: 10, numeric: true },
  { header: 'Hạn xử lý', value: (r) => r.deadline ?? '', width: 13 },
  { header: 'Ngày giao', value: (r) => vnDate(r.createdAt), width: 13 },
  {
    header: 'Nguồn nhiệm vụ',
    value: (r) => {
      const kind = SOURCE_LABELS[r.sourceType ?? ''] ?? '';
      return [kind, r.sourceLabel].filter(Boolean).join(': ');
    },
    width: 30,
  },
];
