import {
  SecretDecryptError,
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  maskSecret,
} from './secret-box';

/**
 * Test hộp khoá dùng để lưu bí mật bên thứ 3 vào MongoDB.
 *
 * Thứ cần khoá lại ở đây không phải "mã hoá có chạy không", mà là ba tính chất
 * quyết định việc một bản dump Mongo lọt ra ngoài có dùng được hay không:
 * cùng một khoá mã hai lần phải khác nhau, sửa dữ liệu phải bị phát hiện, và
 * sai bí mật gốc thì không giải mã được.
 *
 * Các chuỗi dưới đây là khoá GIẢ, không phải khoá thật của nhà cung cấp nào.
 */

const GOC = 'bi-mat-goc-gia-de-test-toi-thieu-32-ky-tu';
const KHOA_API = 'K1234567890abcdefghij';

describe('secret-box', () => {
  it('mã hoá rồi giải mã trả lại đúng giá trị ban đầu', () => {
    const đãMã = encryptSecret(KHOA_API, GOC);

    expect(đãMã).not.toContain(KHOA_API);
    expect(decryptSecret(đãMã, GOC)).toBe(KHOA_API);
  });

  it('mã hai lần cùng một khoá cho ra hai chuỗi KHÁC nhau', () => {
    // Mỗi lần mã hoá sinh IV mới. Nếu hai lần cho kết quả giống nhau thì người
    // đọc được bản dump biết hai xã đang dùng chung một khoá — rò rỉ thông tin
    // mà không cần giải mã.
    const lan1 = encryptSecret(KHOA_API, GOC);
    const lan2 = encryptSecret(KHOA_API, GOC);

    expect(lan1).not.toBe(lan2);
    expect(decryptSecret(lan1, GOC)).toBe(decryptSecret(lan2, GOC));
  });

  it('KHÔNG giải mã được khi bí mật gốc khác — bản dump Mongo một mình là vô dụng', () => {
    const đãMã = encryptSecret(KHOA_API, GOC);

    expect(() => decryptSecret(đãMã, 'mot-bi-mat-goc-hoan-toan-khac-32-ky-tu')).toThrow(
      SecretDecryptError,
    );
  });

  it('phát hiện dữ liệu bị sửa trực tiếp trong cơ sở dữ liệu', () => {
    // Thẻ xác thực của GCM: đổi một byte dữ liệu là giải mã thất bại. Nghĩa là
    // không ai đổi được khoá API bằng cách sửa tay trong Mongo.
    const đãMã = encryptSecret(KHOA_API, GOC);
    const phần = đãMã.split(':');
    const dữLiệu = Buffer.from(phần[3], 'base64');
    dữLiệu[0] = dữLiệu[0] ^ 0xff;
    phần[3] = dữLiệu.toString('base64');

    expect(() => decryptSecret(phần.join(':'), GOC)).toThrow(SecretDecryptError);
  });

  it('báo lỗi rõ ràng khi bản ghi không đúng định dạng', () => {
    expect(() => decryptSecret('mot-chuoi-bat-ky', GOC)).toThrow(SecretDecryptError);
    expect(() => decryptSecret('', GOC)).toThrow(SecretDecryptError);
    // Thông báo phải nói cán bộ làm gì tiếp, không phải thuật ngữ kỹ thuật
    expect(() => decryptSecret('sai:dinh:dang:that', GOC)).toThrow(/nhập lại khoá/);
  });

  it('TỪ CHỐI mã hoá khi thiếu bí mật gốc — không mã hoá bằng khoá rỗng', () => {
    // Đường triển khai Docker sinh ra chuỗi rỗng chứ không phải undefined; mã
    // hoá bằng khoá rỗng là mã hoá giả, thà dừng hẳn.
    expect(() => encryptSecret(KHOA_API, '')).toThrow(/JWT_SECRET/);
    expect(() => encryptSecret(KHOA_API, '   ')).toThrow(/JWT_SECRET/);
  });

  it('nhận ra chuỗi đã mã hoá và chuỗi chưa mã hoá', () => {
    expect(isEncryptedSecret(encryptSecret(KHOA_API, GOC))).toBe(true);
    expect(isEncryptedSecret(KHOA_API)).toBe(false);
    expect(isEncryptedSecret('')).toBe(false);
    expect(isEncryptedSecret(undefined)).toBe(false);
  });

  describe('maskSecret', () => {
    it('giữ 4 ký tự cuối để cán bộ đối chiếu đúng khoá mình đã dán', () => {
      expect(maskSecret('K1234567890abcdefghij')).toBe('••••••••ghij');
    });

    it('che HẾT khoá ngắn — giữ 4 trên 6 ký tự là lộ gần hết', () => {
      expect(maskSecret('abc123')).toBe('••••••••');
    });

    it('khoá rỗng thì trả rỗng, không trả dấu che gây tưởng đã có khoá', () => {
      expect(maskSecret('')).toBe('');
    });
  });
});
