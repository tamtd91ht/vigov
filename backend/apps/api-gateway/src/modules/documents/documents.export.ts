import type { ListColumn } from '../reports/exporters/list-workbook';
import { formatVnDateMs } from '@vigov/shared';

/**
 * Khai báo cột cho tệp Excel sổ văn bản đến / đơn thư.
 *
 * Bảng này là dạng SỔ VĂN BẢN ĐẾN — thứ tự cột đặt theo sổ giấy đang dùng ở bộ
 * phận một cửa: số đến, ngày đến, số ký hiệu, ngày văn bản, cơ quan ban hành,
 * trích yếu, rồi mới đến phần điều hành (bộ phận, hạn, trạng thái).
 *
 * KHÔNG có cột nội dung đầy đủ và không có tệp scan — bảng biểu chỉ để tra cứu
 * và đối chiếu, muốn đọc văn bản thì mở trên hệ thống (có phân quyền, có vết).
 */

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  moi: 'Mới tiếp nhận',
  dangxl: 'Đang xử lý',
  choduyet: 'Chờ duyệt',
  xong: 'Đã hoàn thành',
};

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  incoming: 'Văn bản đến',
  petition: 'Đơn thư',
};

interface DocumentRow {
  arrivalNo?: string;
  refNo?: string;
  date?: number;
  sender?: string;
  summary?: string;
  docType?: string;
  kind?: string;
  department?: string;
  status?: string;
  deadline?: number;
  daysLeft?: number;
  confidentiality?: string;
  urgency?: string;
  signer?: string;
  pageCount?: number;
  createdAt?: number;
}

function vnDate(ms?: number): string {
  return ms === undefined || ms === null ? '' : formatVnDateMs(ms);
}

export const DOCUMENT_EXPORT_COLUMNS: ListColumn<DocumentRow>[] = [
  { header: 'Số đến', value: (r) => r.arrivalNo ?? '', width: 12 },
  { header: 'Ngày đến', value: (r) => vnDate(r.createdAt), width: 13 },
  { header: 'Số, ký hiệu', value: (r) => r.refNo ?? '', width: 18 },
  { header: 'Ngày văn bản', value: (r) => vnDate(r.date), width: 14 },
  { header: 'Cơ quan ban hành', value: (r) => r.sender ?? '', width: 32 },
  { header: 'Trích yếu nội dung', value: (r) => r.summary ?? '', width: 50 },
  { header: 'Loại văn bản', value: (r) => r.docType ?? '', width: 16 },
  {
    header: 'Phân loại',
    value: (r) => DOCUMENT_KIND_LABELS[r.kind ?? ''] ?? r.kind ?? '',
    width: 14,
  },
  { header: 'Độ mật', value: (r) => r.confidentiality ?? '', width: 12 },
  { header: 'Độ khẩn', value: (r) => r.urgency ?? '', width: 12 },
  { header: 'Người ký', value: (r) => r.signer ?? '', width: 20 },
  { header: 'Số trang', value: (r) => r.pageCount ?? '', width: 10, numeric: true },
  { header: 'Bộ phận xử lý', value: (r) => r.department ?? '', width: 22 },
  { header: 'Hạn xử lý', value: (r) => vnDate(r.deadline), width: 13 },
  /* Số ngày còn lại: 0 nghĩa là ĐẾN HẠN HÔM NAY, khác hẳn với "chưa có hạn".
     Giá trị âm là đã quá hạn — ghi rõ chữ để người đọc bảng không phải suy. */
  {
    header: 'Còn lại (ngày)',
    value: (r) => {
      if (r.daysLeft === undefined || r.daysLeft === null) return '';
      if (r.daysLeft < 0) return `Quá hạn ${Math.abs(r.daysLeft)} ngày`;
      if (r.daysLeft === 0) return 'Đến hạn hôm nay';
      return r.daysLeft;
    },
    width: 18,
  },
  {
    header: 'Trạng thái',
    value: (r) => DOCUMENT_STATUS_LABELS[r.status ?? ''] ?? r.status ?? '',
    width: 18,
  },
];
