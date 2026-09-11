import type { ListColumn } from '../reports/exporters/list-workbook';

/**
 * Khai báo cột cho tệp Excel danh sách phản ánh.
 *
 * ⚠ HAI TRƯỜNG BỊ CỐ Ý BỎ RA KHỎI TỆP XUẤT:
 *
 *  - `description` (nội dung phản ánh) — đây là NỘI DUNG ĐƠN THƯ, thuộc nhóm dữ
 *    liệu nhạy cảm: người dân hay viết kèm tên, số điện thoại, việc làm của
 *    người khác. Tệp Excel đi ra khỏi hệ thống, gửi qua thư điện tử, in ra —
 *    không có đường thu hồi. Cần đọc nội dung thì mở phiếu trên hệ thống, ở đó
 *    có phân quyền và có ghi vết ai xem.
 *  - Số điện thoại đầy đủ — cột dưới đây nhận `citizenPhone` ĐÃ CHE từ
 *    `toStaffView`, đúng chính sách của API. Tệp xuất không có ngoại lệ.
 *
 * → `rules/critical/du-lieu-ca-nhan.md` · `skills/bao-cao-va-xuat-file` MUST #4
 */

/** Nhãn trạng thái — khớp status.config.ts của admin-web */
export const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  received: 'Mới tiếp nhận',
  processing: 'Đang xử lý',
  resolved: 'Đã xử lý xong',
};

export const WITHDRAW_STATUS_LABELS: Record<string, string> = {
  none: '',
  pending: 'Chờ duyệt thu hồi',
  approved: 'Đã thu hồi',
  rejected: 'Từ chối thu hồi',
};

const CHANNEL_LABELS: Record<string, string> = {
  app: 'Ứng dụng công dân',
  zalo: 'Zalo Mini App',
  web: 'Cổng thông tin',
};

/** Một dòng phản ánh sau khi đã qua `toStaffView` (số điện thoại đã che) */
interface FeedbackRow {
  code?: string;
  title?: string;
  categoryKey?: string;
  categoryLabel?: string;
  location?: string;
  area?: string;
  status?: string;
  channel?: string;
  citizenName?: string;
  /** ĐÃ CHE dạng 098•••321 — không bao giờ là số đầy đủ */
  citizenPhone?: string;
  assignee?: string;
  department?: string;
  sentAt?: string;
  rating?: number;
  withdrawStatus?: string;
  linkedTaskCode?: string;
  createdAt?: Date | string;
}

function vnDate(value?: Date | string): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const vn = new Date(d.getTime() + 7 * 60 * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(vn.getUTCDate())}/${p(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
}

/**
 * @param categoryLabel tra nhãn lĩnh vực từ mã; nơi gọi truyền vào vì danh mục
 *   lĩnh vực nằm trong cơ sở dữ liệu (phân hệ Cấu hình), không phải hằng số.
 */
export function feedbackExportColumns(
  categoryLabel: (key: string) => string,
): ListColumn<FeedbackRow>[] {
  return [
    { header: 'Mã phiếu', value: (r) => r.code ?? '', width: 14 },
    { header: 'Tiêu đề phản ánh', value: (r) => r.title ?? '', width: 46 },
    {
      header: 'Lĩnh vực',
      value: (r) => r.categoryLabel ?? categoryLabel(r.categoryKey ?? ''),
      width: 22,
    },
    { header: 'Địa điểm', value: (r) => r.location ?? '', width: 34 },
    { header: 'Khu vực', value: (r) => r.area ?? '', width: 18 },
    {
      header: 'Trạng thái',
      value: (r) => FEEDBACK_STATUS_LABELS[r.status ?? ''] ?? r.status ?? '',
      width: 18,
    },
    { header: 'Bộ phận xử lý', value: (r) => r.department ?? '', width: 22 },
    { header: 'Người xử lý', value: (r) => r.assignee ?? '', width: 20 },
    { header: 'Người gửi', value: (r) => r.citizenName ?? '', width: 20 },
    // Số đã che sẵn từ toStaffView — cột này KHÔNG bao giờ chứa số đầy đủ
    { header: 'Số điện thoại (đã che)', value: (r) => r.citizenPhone ?? '', width: 18 },
    {
      header: 'Kênh gửi',
      value: (r) => CHANNEL_LABELS[r.channel ?? ''] ?? r.channel ?? '',
      width: 18,
    },
    { header: 'Ngày tiếp nhận', value: (r) => r.sentAt || vnDate(r.createdAt), width: 16 },
    // Chưa đánh giá là 0 sao — hiện rỗng thay vì "0" để không nhầm là đánh giá kém
    {
      header: 'Đánh giá (sao)',
      value: (r) => (r.rating && r.rating > 0 ? r.rating : ''),
      width: 13,
      numeric: true,
    },
    { header: 'Nhiệm vụ liên kết', value: (r) => r.linkedTaskCode ?? '', width: 16 },
    {
      header: 'Thu hồi',
      value: (r) => WITHDRAW_STATUS_LABELS[r.withdrawStatus ?? 'none'] ?? '',
      width: 18,
    },
  ];
}
