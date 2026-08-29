import type { BudgetItem } from "@/types";
import { appConfig } from "@/config/app.config";
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
  const unit = appConfig.currencyUnit;
  const header = [
    "Mã hạng mục",
    "Tên hạng mục",
    "Nguồn vốn",
    "Người phụ trách",
    `Kế hoạch vốn (${unit})`,
    `Đã giải ngân (${unit})`,
    "Tỷ lệ đạt (%)",
    "Trạng thái",
    "Số lần giải ngân",
    "Số vướng mắc",
  ];

  const rows = items.map((it) => [
    it.id,
    it.name,
    it.fundingSource,
    it.owner,
    it.planned.toLocaleString(appConfig.locale, { maximumFractionDigits: 1 }),
    it.actual.toLocaleString(appConfig.locale, { maximumFractionDigits: 1 }),
    itemPercent(it),
    it.delayed ? "Chậm tiến độ" : "Đúng tiến độ",
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
