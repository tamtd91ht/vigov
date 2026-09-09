import { decodeMultipartFilename } from './files.service';

/**
 * Tên tệp là thứ cán bộ nhìn thấy trong cột "Tệp đính kèm" và là tên tệp lưu ra
 * ổ đĩa khi tải về. Busboy (thư viện Multer dùng bên dưới) đọc `filename` của
 * multipart theo Latin-1, nên tên tiếng Việt tới tay ta dưới dạng chữ rác; sai
 * ở đây là sai vĩnh viễn vì tên được ghi thẳng vào Mongo.
 */
describe('decodeMultipartFilename', () => {
  /** Mô phỏng đúng cách Busboy trao tên tệp: từng byte UTF-8 thành một ký tự */
  const asBusboy = (name: string) => Buffer.from(name, 'utf8').toString('latin1');

  describe('tên tiếng Việt', () => {
    it('dựng lại đúng tên có dấu', () => {
      expect(decodeMultipartFilename(asBusboy('Phụ lục biên bản.docx'))).toBe(
        'Phụ lục biên bản.docx',
      );
    });

    it('dựng lại đúng tên có cả dấu và khoảng trắng, số', () => {
      expect(decodeMultipartFilename(asBusboy('Tờ trình số 12 – Địa chính.pdf'))).toBe(
        'Tờ trình số 12 – Địa chính.pdf',
      );
    });

    it('giữ nguyên đuôi tệp sau khi giải mã', () => {
      expect(decodeMultipartFilename(asBusboy('Báo cáo.xlsx')).endsWith('.xlsx')).toBe(true);
    });
  });

  describe('tên không cần sửa', () => {
    it('tên thuần ASCII đi qua nguyên vẹn', () => {
      expect(decodeMultipartFilename('bien-ban-2026.pdf')).toBe('bien-ban-2026.pdf');
    });

    it('cắt khoảng trắng hai đầu', () => {
      expect(decodeMultipartFilename('  a.pdf  ')).toBe('a.pdf');
    });

    /*
     * Busboy có thể đổi mặc định sang UTF-8 ở bản sau. Lúc đó tên tới đây đã
     * đúng, giải mã thêm một lượt nữa là làm hỏng chính thứ vừa đúng.
     */
    it('KHÔNG giải mã lần hai khi tên đã đúng UTF-8', () => {
      expect(decodeMultipartFilename('Phụ lục biên bản.docx')).toBe('Phụ lục biên bản.docx');
    });

    it('chuỗi byte không phải UTF-8 thì giữ nguyên, không sinh ký tự thay thế', () => {
      // 0xFF không mở đầu chuỗi UTF-8 hợp lệ nào
      const raw = `bien-ban-${String.fromCharCode(0xff)}.pdf`;
      expect(decodeMultipartFilename(raw)).toBe(raw);
    });
  });

  describe('không có tên', () => {
    it('undefined → chuỗi rỗng để nơi gọi tự đặt tên mặc định', () => {
      expect(decodeMultipartFilename(undefined)).toBe('');
    });

    it('chuỗi rỗng và chuỗi chỉ có khoảng trắng đều → rỗng', () => {
      expect(decodeMultipartFilename('')).toBe('');
      expect(decodeMultipartFilename('   ')).toBe('');
    });
  });
});
