import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Hộp khoá — mã hoá / giải mã bí mật của bên thứ 3 trước khi lưu vào MongoDB.
 *
 * VÌ SAO CẦN: khoá API của nhà cung cấp (OCR, đọc thẻ căn cước, GIS, ZNS) nay
 * cấu hình được từ trang Cấu hình, nghĩa là nó nằm trong cơ sở dữ liệu chứ
 * không chỉ trong biến môi trường. Bản `mongodump` được sao chép đi nhiều nơi
 * (máy sao lưu, máy lập trình viên khi dựng lại dữ liệu để tìm lỗi). Lưu khoá
 * dạng rõ là một bản dump lọt ra ngoài đủ để dùng khoá của khách.
 *
 * KHOÁ MÃ HOÁ SUY RA TỪ `JWT_SECRET`, KHÔNG NẰM TRONG MÃ NGUỒN. Đặt khoá cứng
 * trong mã thì ai đọc được mã nguồn là giải mã được — vô nghĩa. Suy ra bằng
 * HKDF nên trong tệp này chỉ có thuật toán và hai nhãn KHÔNG bí mật; kẻ có bản
 * dump mà không có tệp môi trường thì không giải mã được gì.
 *
 * HỆ QUẢ PHẢI BIẾT: đổi `JWT_SECRET` là mọi bí mật đã lưu KHÔNG giải mã được
 * nữa. Đó là đánh đổi có chủ ý — không sinh thêm một khoá riêng để quản lý và
 * để quên. Nơi gọi phải bắt `SecretDecryptError` và yêu cầu nhập lại khoá, chứ
 * không được để lỗi làm sập luồng nghiệp vụ. Xem SECURITY.md.
 *
 * Vì sao HKDF chứ không dùng thẳng `JWT_SECRET` làm khoá AES: `JWT_SECRET` là
 * chuỗi người đặt, độ dài và độ ngẫu nhiên tuỳ ý, còn AES-256 cần đúng 32 byte.
 * HKDF cũng tách vai trò: khoá ký token và khoá mã hoá bí mật là hai khoá khác
 * nhau dù cùng gốc, nên lộ một cái không tự động lộ cái kia.
 */

/** Nhãn phiên bản đứng đầu chuỗi đã mã hoá — để sau này đổi thuật toán vẫn đọc được bản cũ */
const VERSION = 'v1';

const ALGORITHM = 'aes-256-gcm';

/** GCM chuẩn dùng IV 12 byte; mỗi lần mã hoá sinh IV mới, không bao giờ dùng lại */
const IV_BYTES = 12;

/** AES-256 cần đúng 32 byte khoá */
const KEY_BYTES = 32;

/**
 * Muối và nhãn của HKDF. Đây KHÔNG phải bí mật — chúng chỉ tách khoá mã hoá
 * khỏi khoá ký token dù hai bên cùng suy từ `JWT_SECRET`. Đổi hai giá trị này
 * là mọi bí mật đã lưu không giải mã được, nên coi như hằng số cố định.
 */
const HKDF_SALT = 'vigov-secret-box-v1';
const HKDF_INFO = 'vigov-integration-secret';

/** Số ký tự cuối còn hiện khi che bí mật để trả ra giao diện */
const MASK_VISIBLE_TAIL = 4;

/**
 * Không giải mã được: sai khoá gốc (`JWT_SECRET` đã đổi), dữ liệu bị sửa, hoặc
 * bản ghi cũ ở định dạng khác. Nơi gọi phải xử lý bằng cách yêu cầu nhập lại
 * bí mật — KHÔNG được bỏ qua im lặng, vì im lặng nghĩa là tính năng hỏng mà
 * không ai biết vì sao.
 */
export class SecretDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretDecryptError';
  }
}

/** Suy khoá AES 32 byte từ bí mật gốc của hệ thống */
function deriveKey(masterSecret: string): Buffer {
  const master = (masterSecret ?? '').trim();
  if (!master) {
    // Chuỗi rỗng làm khoá là mã hoá giả — thà dừng hẳn còn hơn lưu bí mật
    // bằng một khoá ai cũng đoán được
    throw new Error(
      'Thiếu bí mật gốc để mã hoá cấu hình tích hợp. Kiểm tra JWT_SECRET trong tệp môi trường.',
    );
  }
  return Buffer.from(hkdfSync('sha256', master, HKDF_SALT, HKDF_INFO, KEY_BYTES));
}

/**
 * Mã hoá một bí mật để lưu vào cơ sở dữ liệu.
 * Trả về chuỗi `v1:<iv>:<thẻ xác thực>:<dữ liệu>`, các phần mã hoá base64.
 */
export function encryptSecret(plain: string, masterSecret: string): string {
  const key = deriveKey(masterSecret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(
    ':',
  );
}

/**
 * Giải mã bí mật đọc từ cơ sở dữ liệu.
 * Thẻ xác thực của GCM bảo đảm dữ liệu bị sửa một byte cũng không giải mã được
 * — nghĩa là không ai đổi được khoá API bằng cách sửa trực tiếp trong Mongo.
 */
export function decryptSecret(stored: string, masterSecret: string): string {
  const parts = (stored ?? '').split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretDecryptError(
      'Bí mật đã lưu không đúng định dạng mong đợi. Vui lòng nhập lại khoá trong trang Cấu hình.',
    );
  }

  const [, ivB64, tagB64, dataB64] = parts;
  try {
    const decipher = createDecipheriv(ALGORITHM, deriveKey(masterSecret), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Không kèm nguyên văn lỗi của thư viện mã hoá vào thông báo: nó là thuật
    // ngữ kỹ thuật, và người đọc là cán bộ ở trang Cấu hình
    throw new SecretDecryptError(
      'Không giải mã được khoá đã lưu. Thường là do JWT_SECRET đã đổi kể từ lần lưu khoá. ' +
        'Vui lòng nhập lại khoá trong trang Cấu hình.',
    );
  }
}

/** Chuỗi có phải dạng đã mã hoá của hộp khoá này hay không */
export function isEncryptedSecret(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.split(':').length === 4 && value.startsWith(`${VERSION}:`);
}

/**
 * Che bí mật để trả ra giao diện: giữ 4 ký tự cuối cho cán bộ đối chiếu đúng
 * khoá mình đã dán, che phần còn lại.
 *
 * Bí mật ngắn (dưới 8 ký tự) thì che HẾT — giữ lại 4 trên 6 ký tự là lộ gần
 * hết khoá.
 */
export function maskSecret(plain: string): string {
  const value = plain ?? '';
  if (value.length === 0) return '';
  if (value.length < 8) return '••••••••';
  return `••••••••${value.slice(-MASK_VISIBLE_TAIL)}`;
}
