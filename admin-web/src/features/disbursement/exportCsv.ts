import type { BudgetItem } from "@/types";
import { itemPercent } from "./percent";

/**
 * Kết xuất danh sách hạng mục giải ngân ra CSV (BOM UTF-8 để Excel đọc đúng
 * tiếng Việt) và tải xuống bằng Blob + URL.createObjectURL.
 * Ghi chú: kết xuất chuẩn Excel (.xlsx, biểu mẫu báo cáo) thực hiện ở P3 (#27).
 */

/** Bọc giá trị ô CSV — luôn quote để an toàn với dấu phẩy / xuống dòng */
function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function exportDisbursementCsv(items: BudgetItem[], year: number): void {
  const header = [
    "Mã hạng mục",
    "Tên hạng mục",
    "Nguồn vốn",
    "Người phụ trách",
    "Kế hoạch vốn (đồng)",
    "Đã giải ngân (đồng)",
    "Tỷ lệ đạt (%)",
    "Tình trạng tiến độ",
    "Số lần giải ngân",
    "Số vướng mắc",
  ];

  const rows = items.map((it) => [
    it.id,
    it.name,
    it.fundingSource,
    it.owner,
    /* Xuất SỐ THÔ (đồng) chứ không định dạng: người nhận cộng lại được bằng
       chính Excel và đối chiếu với sổ kế toán. Đơn vị ghi ở tiêu đề cột. */
    it.plannedDong,
    it.actualDong,
    itemPercent(it) ?? "",
    it.scheduleLabel ?? "",
    it.entries.length,
    it.obstacles.length,
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

  // BOM UTF-8 để Excel nhận đúng bảng mã khi mở trực tiếp
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `giai-ngan-${year}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
