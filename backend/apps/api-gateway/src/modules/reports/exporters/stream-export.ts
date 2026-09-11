import type { Response } from 'express';
import type { Workbook } from 'exceljs';
import type { AuditService } from '../../audit/audit.service';
import type { JwtPayload } from '@vigov/shared';

/**
 * Gửi workbook về client và GHI VẾT lần xuất đó.
 *
 * VÌ SAO PHẢI GHI VẾT TAY: `AuditInterceptor` chỉ ghi các request POST/PATCH/
 * PUT/DELETE. Xuất tệp là `GET` nên interceptor bỏ qua — mà đây đúng là thao
 * tác cần truy được nhất: một tệp Excel mang cả bảng dữ liệu ra khỏi hệ thống.
 * Luật: `rules/critical/nhat-ky-thao-tac.md` và `skills/bao-cao-va-xuat-file`.
 *
 * Vết ghi số lượng bản ghi và bộ lọc đã dùng, KHÔNG ghi nội dung bản ghi — nhật
 * ký không phải chỗ nhân bản dữ liệu cá nhân.
 */
export async function streamExcelExport(options: {
  res: Response;
  workbook: Workbook;
  fileName: string;
  audit: AuditService;
  actor?: JwtPayload;
  /** Tên tài nguyên ghi vào nhật ký, ví dụ 'tasks/export' */
  resource: string;
  /** Số bản ghi trong tệp */
  rowCount: number;
  /** Bộ lọc đã áp dụng — chỉ tên và giá trị lọc, không có dữ liệu bản ghi */
  filters: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  const { res, workbook, fileName, audit, actor, resource, rowCount, filters, ip } = options;

  await audit.record({
    actor: actor?.username ?? 'không rõ',
    action: 'EXPORT',
    resource,
    resourceId: fileName,
    after: { rowCount, filters },
    ip,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  // filename* theo RFC 5987 để tên tệp có dấu tiếng Việt không bị hỏng; giữ
  // thêm `filename=` thuần ASCII cho trình duyệt cũ
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  await workbook.xlsx.write(res);
  res.end();
}
