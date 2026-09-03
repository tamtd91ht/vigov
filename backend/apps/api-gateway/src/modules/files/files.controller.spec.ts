import { parseRange } from './files.controller';

/**
 * parseRange là điểm dễ sai nhất của việc phát video: mọi con số nó trả ra đi
 * thẳng vào header Content-Range và Content-Length. Lệch một byte thì trình
 * phát treo khi tua, hoặc cắt hụt khung hình cuối — mà lỗi chỉ lộ ra trên thiết
 * bị thật, không lộ ở màn hình lập trình viên.
 *
 * Quy ước RFC 9110: khoảng tính CẢ HAI ĐẦU, `bytes=0-0` là đúng 1 byte.
 */
describe('parseRange', () => {
  const SIZE = 1000;

  describe('trả nguyên tệp (null)', () => {
    it('không có header Range', () => {
      expect(parseRange(undefined, SIZE)).toBeNull();
    });

    it('đơn vị không phải bytes — ta chỉ phục vụ bytes', () => {
      expect(parseRange('items=0-99', SIZE)).toBeNull();
    });

    it('nhiều khoảng — cần multipart/byteranges, ta làm ngơ theo RFC', () => {
      expect(parseRange('bytes=0-9,20-29', SIZE)).toBeNull();
    });

    it('cú pháp rỗng cả hai đầu', () => {
      expect(parseRange('bytes=-', SIZE)).toBeNull();
    });

    it('tệp rỗng thì không có khoảng nào hợp lệ', () => {
      expect(parseRange('bytes=0-10', 0)).toBeNull();
    });
  });

  describe('khoảng hợp lệ', () => {
    it('bytes=0-499 lấy 500 byte đầu', () => {
      expect(parseRange('bytes=0-499', SIZE)).toEqual({ start: 0, end: 499 });
    });

    it('bytes=0-0 lấy đúng 1 byte — biên dễ lệch nhất', () => {
      expect(parseRange('bytes=0-0', SIZE)).toEqual({ start: 0, end: 0 });
    });

    it('bytes=500- lấy từ 500 tới hết tệp', () => {
      expect(parseRange('bytes=500-', SIZE)).toEqual({ start: 500, end: 999 });
    });

    it('bytes=-500 lấy 500 byte CUỐI (trình phát đọc chỉ mục moov của MP4)', () => {
      expect(parseRange('bytes=-500', SIZE)).toEqual({ start: 500, end: 999 });
    });

    it('hậu tố lớn hơn tệp thì lấy trọn tệp, không âm', () => {
      expect(parseRange('bytes=-5000', SIZE)).toEqual({ start: 0, end: 999 });
    });

    it('đuôi vượt quá tệp thì cắt về byte cuối, không phải lỗi', () => {
      expect(parseRange('bytes=900-99999', SIZE)).toEqual({ start: 900, end: 999 });
    });

    it('xin đúng byte cuối cùng', () => {
      expect(parseRange('bytes=999-999', SIZE)).toEqual({ start: 999, end: 999 });
    });

    it('bỏ qua khoảng trắng thừa quanh header', () => {
      expect(parseRange('  bytes=10-20  ', SIZE)).toEqual({ start: 10, end: 20 });
    });
  });

  describe('phải trả 416', () => {
    it('bắt đầu ngay sau byte cuối', () => {
      expect(parseRange('bytes=1000-1099', SIZE)).toBe('invalid');
    });

    it('bắt đầu vượt xa kích thước tệp', () => {
      expect(parseRange('bytes=5000-6000', SIZE)).toBe('invalid');
    });

    it('đầu lớn hơn cuối', () => {
      expect(parseRange('bytes=300-100', SIZE)).toBe('invalid');
    });

    it('hậu tố bằng 0 — không xin byte nào cả', () => {
      expect(parseRange('bytes=-0', SIZE)).toBe('invalid');
    });
  });
});
