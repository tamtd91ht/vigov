/**
 * Kiểm tra loại tệp tải lên theo BA TẦNG độc lập.
 *
 * VÌ SAO BA TẦNG, KHÔNG PHẢI MỘT:
 *
 * MIME (`file.mimetype`) do TRÌNH DUYỆT KHAI, không phải máy chủ đo. Kẻ xấu
 * dựng một multipart bằng tay và khai `application/pdf` cho một tệp `.exe` là
 * qua được mọi kiểm tra dựa trên MIME. Đuôi tệp cũng do client gửi, đổi được
 * y hệt. Nội dung thật thì không đổi được — nên tầng thứ ba đọc mấy byte đầu.
 *
 *   1. MIME       — chặn sớm, cho thông báo lỗi dễ hiểu
 *   2. Đuôi tệp   — bắt trường hợp đổi MIME nhưng giữ đuôi (và ngược lại)
 *   3. Magic bytes— bắt trường hợp đổi CẢ HAI; đây là tầng duy nhất không nói dối được
 *
 * Cả ba phải cùng đồng ý thì tệp mới được nhận.
 *
 * BỐI CẢNH VIGOV: tệp ở đây là hồ sơ hành chính do cán bộ tải lên và ảnh hiện
 * trường do người dân gửi, lưu trên chính tên miền API. Một tệp HTML chứa script
 * lọt vào rồi được mở qua link đọc tệp là stored XSS ngay trên tên miền của cơ
 * quan nhà nước — người dùng đang đăng nhập mở phải là mất phiên.
 */

import { UnsupportedMediaTypeException } from '@nestjs/common';
import * as path from 'node:path';

/**
 * Đuôi tệp bị CHẶN với mọi mục đích.
 *
 * Danh sách này là lưới chắn thứ hai, KHÔNG phải cơ chế chính: cơ chế chính là
 * danh sách trắng ở `ALLOWED_EXTENSIONS_BY_PURPOSE`. Giữ nó vì danh sách trắng
 * có thể được nới trong tương lai, và khi đó vẫn không được phép nới trúng
 * những đuôi dưới đây.
 *
 * Gồm ba nhóm: thực thi trực tiếp trên máy người dùng (.exe .msi .bat …),
 * chạy trong trình duyệt khi mở link (.html .svg .js), và chạy phía máy chủ
 * nếu kho tệp vô tình được phục vụ bởi một web server có PHP/ASP (.php .jsp).
 */
export const BLOCKED_EXTENSIONS: readonly string[] = [
  // Thực thi trên Windows
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.cpl', '.hta',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1', '.psm1', '.lnk', '.reg',
  // Thực thi trên Unix / đa nền tảng
  '.sh', '.bash', '.zsh', '.run', '.bin', '.app', '.deb', '.rpm', '.dmg', '.jar',
  // Chạy trong trình duyệt khi mở trực tiếp
  '.html', '.htm', '.xhtml', '.shtml', '.svg', '.mhtml', '.xht',
  // Chạy phía máy chủ
  '.php', '.php3', '.php4', '.php5', '.phtml', '.asp', '.aspx', '.jsp', '.jspx',
  '.cgi', '.pl', '.py', '.rb',
];

/**
 * ⚠ QUYẾT ĐỊNH CÓ Ý THỨC (10/09/2026): Office CÓ MACRO được phép tải lên.
 *
 * `.docm .xlsm .pptm .dotm .xltm .potm` từng nằm trong BLOCKED_EXTENSIONS ở trên.
 * Khách yêu cầu mở cho mọi định dạng Office vì cán bộ xã đang dùng biểu mẫu
 * Excel/Word có macro trong công việc thật.
 *
 * RỦI RO ĐÃ ĐƯỢC CHẤP NHẬN: macro Office là đường lây mã độc phổ biến nhất
 * trong môi trường hành chính — người nhận mở tệp rồi bấm "Enable Content"
 * theo quán tính. Hệ thống KHÔNG quét được macro bên trong.
 *
 * Vì vậy phần bù đắp phải giữ nguyên, KHÔNG được nới thêm:
 *   · Tệp nghiệp vụ luôn `isPrivate = true` — chỉ mở được bằng link ký ngắn hạn.
 *   · Route đọc tệp trả `Content-Disposition: attachment` cho định dạng này,
 *     nên trình duyệt tải về chứ không mở tại chỗ.
 *   · Magic bytes vẫn kiểm: tệp thực thi đổi tên thành .xlsm vẫn bị chặn.
 *
 * Nếu về sau có sự cố mã độc qua đường này, đây là chỗ đọc lại để đảo quyết định.
 */

/**
 * Đuôi tệp được phép cho mục đích `other` — tài liệu hành chính đính kèm.
 *
 * DANH SÁCH TRẮNG, không phải danh sách đen: mặc định đóng theo quy ước của dự
 * án. Danh sách đen luôn thiếu — mỗi định dạng thực thi mới xuất hiện là một lỗ
 * hổng, và không ai nhớ cập nhật. Danh sách trắng thì sai theo hướng an toàn:
 * cán bộ gặp định dạng lạ sẽ báo, và ta thêm vào sau khi cân nhắc.
 */
export const ALLOWED_EXTENSIONS_BY_PURPOSE: Record<string, readonly string[]> = {
  other: [
    // Tài liệu — Office đủ mọi biến thể (kể cả bản có macro và bản mẫu),
    // theo yêu cầu của khách 10/09/2026; xem khối chú thích phía trên.
    '.pdf', '.rtf', '.txt', '.csv',
    '.doc', '.docx', '.docm', '.dot', '.dotx', '.dotm',
    '.xls', '.xlsx', '.xlsm', '.xlsb', '.xlt', '.xltx', '.xltm',
    '.ppt', '.pptx', '.pptm', '.pps', '.ppsx', '.ppsm', '.pot', '.potx', '.potm',
    '.odt', '.ods', '.odp', '.odg', '.odf',
    // Ảnh
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.bmp', '.tif', '.tiff',
    // Nén — khách đã chốt cho phép (cán bộ hay gửi nhiều văn bản một lượt).
    // LƯU Ý: hệ thống KHÔNG quét được nội dung bên trong tệp nén, nên một tệp
    // thực thi giấu trong .zip vẫn vào được kho. Rủi ro này đã được chấp nhận
    // có ý thức; nó chỉ nguy hiểm khi người nhận giải nén và chạy.
    '.zip', '.rar', '.7z',
  ],
};

/**
 * Chữ ký byte đầu tệp (magic bytes) theo đuôi tệp.
 *
 * Chỉ khai cho những định dạng có chữ ký ỔN ĐỊNH. Định dạng không có chữ ký
 * đáng tin (.txt, .csv, .rtf) cố ý KHÔNG khai — kiểm chúng bằng magic bytes sẽ
 * sinh ra từ chối nhầm, mà chúng cũng không thực thi được.
 *
 * `offset` khác 0 dùng cho định dạng có phần đầu thay đổi (ví dụ .tif little/big
 * endian đã tách thành hai chữ ký riêng).
 */
interface MagicSignature {
  readonly bytes: readonly number[];
  readonly offset?: number;
}

const MAGIC_BY_EXTENSION: Record<string, readonly MagicSignature[]> = {
  '.pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  '.jpg': [{ bytes: [0xff, 0xd8, 0xff] }],
  '.jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  '.png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  '.gif': [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
  '.bmp': [{ bytes: [0x42, 0x4d] }], // BM
  '.tif': [{ bytes: [0x49, 0x49, 0x2a, 0x00] }, { bytes: [0x4d, 0x4d, 0x00, 0x2a] }],
  '.tiff': [{ bytes: [0x49, 0x49, 0x2a, 0x00] }, { bytes: [0x4d, 0x4d, 0x00, 0x2a] }],
  // RIFF....WEBP — kiểm cả "RIFF" ở đầu lẫn "WEBP" ở byte thứ 8
  '.webp': [{ bytes: [0x52, 0x49, 0x46, 0x46] }],
  // ftyp ở offset 4, dùng chung cho HEIC/HEIF và MP4
  '.heic': [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  '.heif': [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  /* Office hiện đại và OpenDocument đều là ZIP bên trong: PK\x03\x04.
     Bản CÓ MACRO (.docm/.xlsm/.pptm) cũng vậy — chữ ký không phân biệt được
     có macro hay không, nên tầng này chỉ khẳng định "đúng là tệp Office",
     không nói được "an toàn". */
  '.docx': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.docm': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.dotx': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.dotm': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.xlsx': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.xlsm': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.xltx': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.xltm': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.pptx': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.pptm': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.ppsx': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.ppsm': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.potx': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.potm': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.odt': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.ods': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.odp': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  /* Office cũ (OLE Compound File) — .xlsb cũng dùng khuôn này ở một số bản */
  '.dot': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  '.xlt': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  '.pot': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  '.pps': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  '.zip': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }, { bytes: [0x50, 0x4b, 0x05, 0x06] }],
  // Office cũ (OLE Compound File)
  '.doc': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  '.xls': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  '.ppt': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  '.rar': [{ bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] }], // Rar!
  '.7z': [{ bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] }],
};

/**
 * Chữ ký của các định dạng NGUY HIỂM — chặn dù đuôi tệp và MIME trông vô hại.
 *
 * Đây là tầng bắt được kẻ đổi CẢ đuôi lẫn MIME: một tệp `bao-cao.pdf` khai
 * `application/pdf` nhưng nội dung mở đầu bằng `MZ` thì đó là tệp thực thi
 * Windows, không phải PDF.
 */
const DANGEROUS_MAGIC: readonly { bytes: readonly number[]; label: string }[] = [
  { bytes: [0x4d, 0x5a], label: 'tệp thực thi Windows' }, // MZ
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: 'tệp thực thi Linux' }, // \x7FELF
  { bytes: [0xca, 0xfe, 0xba, 0xbe], label: 'tệp thực thi macOS hoặc Java' },
  { bytes: [0xce, 0xfa, 0xed, 0xfe], label: 'tệp thực thi macOS' },
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], label: 'tệp thực thi macOS' },
  { bytes: [0x23, 0x21], label: 'tập lệnh shell' }, // #!
];

/** Nội dung mở đầu bằng các chuỗi này là HTML — mở link là chạy script */
const HTML_PREFIXES: readonly string[] = ['<!doctype html', '<html', '<?xml', '<svg', '<script'];

/** Số byte đầu cần đọc để nhận diện; đủ cho mọi chữ ký khai ở trên */
const MAGIC_PROBE_BYTES = 64;

/** Buffer có khớp một chữ ký không */
function matchesSignature(buffer: Buffer, sig: MagicSignature): boolean {
  const offset = sig.offset ?? 0;
  if (buffer.length < offset + sig.bytes.length) return false;
  return sig.bytes.every((byte, i) => buffer[offset + i] === byte);
}

/** Lấy đuôi tệp dạng chữ thường từ tên gốc */
export function extensionOf(originalName: string): string {
  return path.extname(originalName ?? '').toLowerCase();
}

/**
 * Chặn đuôi tệp nguy hiểm — áp dụng cho MỌI mục đích, kể cả khi danh sách
 * trắng của mục đích đó có nới ra sau này.
 */
export function assertExtensionNotBlocked(originalName: string): void {
  const ext = extensionOf(originalName);
  if (!ext) return; // không có đuôi thì để tầng magic bytes xử lý

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new UnsupportedMediaTypeException(
      `Không thể tải lên tệp "${ext}" vì định dạng này có thể thực thi mã. ` +
        `Nếu cần gửi nội dung đó, vui lòng nén lại hoặc chuyển sang PDF.`,
    );
  }

  /* Đuôi kép kiểu "bao-cao.pdf.exe": người dùng chỉ thấy phần đầu nếu hệ điều
     hành đang ẩn phần mở rộng, nên đây là mẹo lừa rất hay gặp. Đuôi cuối đã
     được kiểm ở trên; ở đây chặn thêm trường hợp một đuôi nguy hiểm nằm giữa. */
  const parts = (originalName ?? '').toLowerCase().split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    if (BLOCKED_EXTENSIONS.includes(`.${parts[i]}`)) {
      throw new UnsupportedMediaTypeException(
        `Tên tệp chứa phần mở rộng ".${parts[i]}" không được phép. Vui lòng đổi tên tệp rồi thử lại.`,
      );
    }
  }
}

/**
 * Kiểm đuôi tệp có nằm trong danh sách trắng của mục đích không.
 * Mục đích không khai danh sách trắng thì bỏ qua (đã có kiểm MIME riêng).
 */
export function assertExtensionAllowed(purpose: string, originalName: string): void {
  const allowed = ALLOWED_EXTENSIONS_BY_PURPOSE[purpose];
  if (!allowed) return;

  const ext = extensionOf(originalName);
  if (!ext) {
    throw new UnsupportedMediaTypeException(
      'Tệp không có phần mở rộng nên không xác định được định dạng. Vui lòng đặt tên tệp kèm đuôi, ví dụ ".pdf".',
    );
  }

  if (!allowed.includes(ext)) {
    throw new UnsupportedMediaTypeException(
      `Định dạng "${ext}" không được chấp nhận. Chỉ nhận: ${allowed.join(', ')}.`,
    );
  }
}

/**
 * Kiểm NỘI DUNG THẬT của tệp — tầng duy nhất client không nói dối được.
 *
 * Hai việc:
 *   1. Nội dung có phải định dạng nguy hiểm không, bất kể đuôi tệp khai gì.
 *   2. Nội dung có khớp với đuôi tệp đã khai không (nếu định dạng đó có chữ ký).
 */
export function assertContentMatchesExtension(buffer: Buffer, originalName: string): void {
  if (!buffer || buffer.length === 0) return;

  const head = buffer.subarray(0, MAGIC_PROBE_BYTES);

  // 1. Nội dung nguy hiểm — chặn bất kể đuôi tệp
  for (const danger of DANGEROUS_MAGIC) {
    if (matchesSignature(head, { bytes: danger.bytes })) {
      throw new UnsupportedMediaTypeException(
        `Nội dung tệp là ${danger.label}, không phải tài liệu. Tệp bị từ chối vì lý do an toàn.`,
      );
    }
  }

  /* HTML/SVG nhận diện bằng văn bản đầu tệp chứ không bằng byte cố định: chúng
     có thể mở đầu bằng khoảng trắng, BOM hay chú thích. Bỏ BOM rồi so tiền tố. */
  const text = head.toString('utf8').replace(/^﻿/, '').trimStart().toLowerCase();
  if (HTML_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    throw new UnsupportedMediaTypeException(
      'Nội dung tệp là HTML hoặc SVG — hai định dạng chạy được script khi mở. Tệp bị từ chối vì lý do an toàn.',
    );
  }

  // 2. Nội dung có khớp đuôi tệp không
  const ext = extensionOf(originalName);
  const expected = MAGIC_BY_EXTENSION[ext];
  if (!expected) return; // định dạng không có chữ ký đáng tin — bỏ qua có chủ ý

  if (!expected.some((sig) => matchesSignature(head, sig))) {
    throw new UnsupportedMediaTypeException(
      `Nội dung tệp không khớp với phần mở rộng "${ext}". ` +
        `Tệp có thể đã bị đổi tên hoặc hỏng — vui lòng kiểm tra lại.`,
    );
  }

  /* WEBP: "RIFF" ở đầu dùng chung cho cả .wav và .avi, nên phải kiểm thêm
     nhãn "WEBP" ở byte thứ 8 mới chắc. */
  if ((ext === '.webp') && head.length >= 12 && head.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new UnsupportedMediaTypeException(
      'Nội dung tệp không phải ảnh WEBP hợp lệ. Vui lòng kiểm tra lại tệp.',
    );
  }
}
