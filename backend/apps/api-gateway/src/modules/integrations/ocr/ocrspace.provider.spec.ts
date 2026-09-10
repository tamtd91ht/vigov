import { ServiceUnavailableException } from '@nestjs/common';
import type { FilesService } from '../../files/files.service';
import type { OcrRuntimeConfig } from './ocr.provider';
import { OcrSpaceProvider, parseAdministrativeDocument, safeFileName } from './ocrspace.provider';

/**
 * Test cho phần suy ra trường từ văn bản OCR đọc được.
 *
 * Chỉ test hàm thuần này, KHÔNG gọi ocr.space thật: dịch vụ ngoài có hạn mức,
 * chạy trong test là vừa chậm vừa hỏng khi mất mạng, mà thứ dễ sai lại nằm ở
 * bộ luật dò chuỗi chứ không ở lời gọi HTTP.
 *
 * Văn bản mẫu dưới đây là văn bản GIẢ, không phải văn bản thật của cơ quan nào.
 */

/** Trích giá trị một trường cho gọn */
function val(fields: ReturnType<typeof parseAdministrativeDocument>, key: string) {
  return fields.find((f) => f.key === key)?.value;
}

describe('parseAdministrativeDocument', () => {
  const MAU = [
    'UBND HUYỆN ĐÔNG ANH',
    'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    'Độc lập - Tự do - Hạnh phúc',
    'Số: 1245/UBND-VP',
    'Đông Anh, ngày 12 tháng 03 năm 2026',
    'V/v triển khai kế hoạch cải cách hành chính năm 2026',
    'Độ khẩn: Khẩn',
  ].join('\n');

  it('đọc được số ký hiệu, ngày ban hành, cơ quan và trích yếu', () => {
    const f = parseAdministrativeDocument(MAU);
    expect(val(f, 'refNo')).toBe('1245/UBND-VP');
    expect(val(f, 'issuedDate')).toBe('12/03/2026');
    expect(val(f, 'sender')).toBe('UBND HUYỆN ĐÔNG ANH');
    expect(val(f, 'summary')).toContain('cải cách hành chính');
    expect(val(f, 'urgency')).toBe('Khẩn');
  });

  it('KHÔNG nhận dòng quốc hiệu làm cơ quan ban hành', () => {
    // Quốc hiệu cũng viết hoa toàn bộ, là cái bẫy rõ nhất của luật "dòng viết hoa"
    const f = parseAdministrativeDocument(MAU);
    expect(val(f, 'sender')).not.toContain('CỘNG HÒA');
  });

  it('trả về đủ 7 trường kể cả khi không đọc được gì', () => {
    const f = parseAdministrativeDocument('');
    expect(f).toHaveLength(7);
    // Trường không dò được phải có độ tin cậy 0 — cán bộ nhìn là biết phải tự nhập
    expect(f.every((x) => x.value === '' && x.confidence === 0)).toBe(true);
  });

  it('không bịa độ tin cậy cao cho trường suy ra bằng luật chuỗi', () => {
    const f = parseAdministrativeDocument(MAU);
    const found = f.filter((x) => x.value !== '');
    expect(found.length).toBeGreaterThan(0);
    // 0.5 là mức cố ý đặt thấp; cao hơn là nói dối người dùng về chất lượng đọc
    expect(found.every((x) => x.confidence <= 0.5)).toBe(true);
  });

  it('đọc được ngày dạng rút gọn 12/03/2026', () => {
    const f = parseAdministrativeDocument('Số: 99/QĐ-UBND\nNgày 05/01/2026');
    expect(val(f, 'issuedDate')).toBe('05/01/2026');
  });

  it('trả đúng thuật ngữ nghiệp vụ dù OCR đọc ra chữ thường ở nhãn', () => {
    // "Độ khẩn:" là NHÃN — giá trị phải chuẩn hoá thành "Khẩn", không phải "khẩn"
    const f = parseAdministrativeDocument('Độ khẩn: khẩn\nđộ mật: mật');
    expect(val(f, 'urgency')).toBe('Khẩn');
    expect(val(f, 'confidentiality')).toBe('Mật');
  });

  it('không hạ cấp "Tuyệt mật" thành "Mật"', () => {
    // Mức bao hàm: dò "mật" trước là mất mức đúng, hậu quả là lộ văn bản mật
    const f = parseAdministrativeDocument('Độ mật: Tuyệt mật');
    expect(val(f, 'confidentiality')).toBe('Tuyệt mật');
  });

  it('không hạ cấp "Thượng khẩn" thành "Khẩn"', () => {
    const f = parseAdministrativeDocument('Độ khẩn: Thượng khẩn');
    expect(val(f, 'urgency')).toBe('Thượng khẩn');
  });

  it('đọc hạn xử lý từ "trước ngày ..."', () => {
    const f = parseAdministrativeDocument(
      'Đông Anh, ngày 12 tháng 03 năm 2026\nbáo cáo kết quả trước ngày 20/03/2026.',
    );
    expect(val(f, 'issuedDate')).toBe('12/03/2026');
    expect(val(f, 'deadline')).toBe('20/03/2026');
  });

  it('KHÔNG coi một ngày bất kỳ trong nội dung là hạn xử lý', () => {
    // Lấy nhầm ngày thường thành hạn là cán bộ bị nhắc sai hạn — tệ hơn bỏ trống
    const f = parseAdministrativeDocument('Số: 9/TB\nCuộc họp tổ chức 05/05/2026.');
    expect(val(f, 'deadline')).toBe('');
  });
});

describe('safeFileName', () => {
  it('KHÔNG gửi tên tệp gốc ra dịch vụ ngoài', () => {
    // Tên bản scan hay chứa số hồ sơ / tên công dân — không được lộ qua tên tệp
    expect(safeFileName('CV so 1245 - Nguyen Van A.png', 'image/png')).toBe('scan.png');
  });

  it('luôn có đuôi tệp, kể cả khi tên gốc không có', () => {
    // Thiếu đuôi là ocr.space trả lỗi E216 — đã vấp khi chạy thử thật
    expect(safeFileName('', 'application/pdf')).toBe('scan.pdf');
    expect(safeFileName('scan-khong-duoi', 'image/jpeg')).toBe('scan.jpg');
  });

  it('không hỏng khi bản ghi cũ thiếu originalName', () => {
    expect(safeFileName(undefined as unknown as string, 'image/png')).toBe('scan.png');
  });
});

/**
 * Test cho phần CẢNH BÁO NGƯỜI DÙNG.
 *
 * Provider này gửi bản scan ra máy chủ nước ngoài. Cách kiểm soát đã chốt là:
 * không chặn theo môi trường (mã không có nhánh `if` production/dev), mà luôn
 * cảnh báo — một dòng `warn` trong nhật ký và một `notice` trả kèm kết quả để
 * giao diện hiện cho cán bộ. Bộ test dưới đây khoá lại đúng hai thứ đó, vì
 * chúng là toàn bộ lớp kiểm soát còn lại.
 */
describe('OcrSpaceProvider — cảnh báo khi dùng', () => {
  /** Lỗi mốc: ném từ FilesService để biết luồng đã chạy tới bước đọc tệp */
  const DEN_BUOC_DOC_TEP = new Error('den-buoc-doc-tep');

  const CAU_HINH: OcrRuntimeConfig = { apiKey: 'khoa-gia-cho-test', endpoint: '' };

  function dungProvider() {
    const files = {
      getContent: () => Promise.reject(DEN_BUOC_DOC_TEP),
    } as unknown as FilesService;
    return new OcrSpaceProvider(files);
  }

  it('ghi một dòng cảnh báo vào nhật ký mỗi lượt gọi', async () => {
    const provider = dungProvider();
    const canhBao = jest.spyOn(provider['logger'], 'warn').mockImplementation(() => undefined);

    await expect(provider.extract('tep-nao-do', CAU_HINH)).rejects.toThrow(DEN_BUOC_DOC_TEP);

    expect(canhBao).toHaveBeenCalledTimes(1);
    expect(canhBao.mock.calls[0][0]).toMatch(/ocr\.space/);

    canhBao.mockRestore();
  });

  it('KHÔNG ghi tên tệp vào nhật ký — tên bản scan hay chứa tên công dân', async () => {
    const provider = dungProvider();
    const canhBao = jest.spyOn(provider['logger'], 'warn').mockImplementation(() => undefined);

    await expect(provider.extract('CV-1245-Nguyen-Van-A.pdf', CAU_HINH)).rejects.toThrow(
      DEN_BUOC_DOC_TEP,
    );

    const dongLog = canhBao.mock.calls[0][0] as string;
    expect(dongLog).not.toMatch(/Nguyen-Van-A/);
    expect(dongLog).not.toMatch(/1245/);

    canhBao.mockRestore();
  });

  it('cảnh báo và hành vi KHÔNG phụ thuộc môi trường', async () => {
    // Chốt lại quyết định: provider không đọc NODE_ENV, không có nhánh if theo
    // môi trường. Hành vi ở nơi kiểm thử và nơi chạy thật phải giống nhau.
    const nguon = require('node:fs').readFileSync(
      require.resolve('./ocrspace.provider.ts'),
      'utf8',
    ) as string;
    const dongMa = nguon
      .split('\n')
      .filter((d) => !d.trimStart().startsWith('*') && !d.trimStart().startsWith('//'));

    expect(dongMa.join('\n')).not.toMatch(/NODE_ENV|'production'/);
  });

  it('báo thiếu khoá API bằng tiếng Việt, có hướng dẫn làm gì tiếp', async () => {
    const provider = dungProvider();

    await expect(provider.extract('tep-nao-do', { apiKey: '', endpoint: '' })).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(provider.extract('tep-nao-do', { apiKey: '', endpoint: '' })).rejects.toThrow(
      /Cấu hình → Tích hợp/,
    );
  });
});
