import { UnsupportedMediaTypeException } from '@nestjs/common';
import {
  assertContentMatchesExtension,
  assertExtensionAllowed,
  assertExtensionNotBlocked,
  extensionOf,
} from './file-type.guard';

/**
 * Kho tệp của ViGov chứa hồ sơ hành chính do cán bộ tải lên và ảnh hiện trường
 * do người dân gửi, phục vụ ngay trên tên miền API. Một tệp thực thi hoặc một
 * tệp HTML chứa script lọt vào rồi được mở qua link đọc tệp là sự cố thật:
 * stored XSS trên tên miền của cơ quan nhà nước, người dùng đang đăng nhập mở
 * phải là mất phiên.
 *
 * MIME và đuôi tệp đều do CLIENT khai nên đổi được. Bộ test này khoá hành vi
 * của cả ba tầng chặn, đặc biệt là các trường hợp cố ý nói dối.
 */

/** Dựng buffer bắt đầu bằng các byte cho trước, phần đuôi là số 0 */
const bufferStartingWith = (...bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(32)]);

const PDF = bufferStartingWith(0x25, 0x50, 0x44, 0x46); // %PDF
const PNG = bufferStartingWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bufferStartingWith(0xff, 0xd8, 0xff);
const ZIP = bufferStartingWith(0x50, 0x4b, 0x03, 0x04); // cũng là .docx/.xlsx
const WINDOWS_EXE = bufferStartingWith(0x4d, 0x5a); // MZ
const LINUX_ELF = bufferStartingWith(0x7f, 0x45, 0x4c, 0x46);

describe('extensionOf', () => {
  it('trả về đuôi tệp dạng chữ thường', () => {
    expect(extensionOf('Báo cáo.PDF')).toBe('.pdf');
  });

  it('trả về chuỗi rỗng khi tên tệp không có đuôi', () => {
    expect(extensionOf('bao-cao')).toBe('');
  });
});

describe('assertExtensionNotBlocked — chặn đuôi tệp nguy hiểm', () => {
  /* Nhóm này là thứ trực tiếp gây hại cho máy cán bộ khi họ tải về rồi mở. */
  it.each([
    ['virus.exe', 'tệp thực thi Windows'],
    ['script.bat', 'tệp lệnh batch'],
    ['script.cmd', 'tệp lệnh cmd'],
    ['payload.ps1', 'tập lệnh PowerShell'],
    ['app.jar', 'tệp Java'],
    ['setup.msi', 'trình cài đặt Windows'],
    ['fake.scr', 'screensaver — thực chất là tệp thực thi'],
    ['macro.vbs', 'VBScript'],
    ['shortcut.lnk', 'lối tắt Windows'],
    ['page.hta', 'ứng dụng HTML'],
    ['run.sh', 'tập lệnh shell'],
  ])('chặn %s (%s)', (name) => {
    expect(() => assertExtensionNotBlocked(name)).toThrow(UnsupportedMediaTypeException);
  });

  /* Nhóm này chạy script NGAY TRONG TRÌNH DUYỆT khi mở link đọc tệp — đây mới
     là nhóm gây stored XSS trên chính tên miền API. */
  it.each(['trang.html', 'trang.htm', 'anh.svg', 'tai-lieu.xhtml'])(
    'chặn %s vì chạy được script trong trình duyệt',
    (name) => {
      expect(() => assertExtensionNotBlocked(name)).toThrow(UnsupportedMediaTypeException);
    },
  );

  /* Chạy phía máy chủ nếu kho tệp vô tình được phục vụ bởi web server có PHP. */
  it.each(['shell.php', 'shell.phtml', 'page.jsp', 'page.aspx'])(
    'chặn %s vì chạy được phía máy chủ',
    (name) => {
      expect(() => assertExtensionNotBlocked(name)).toThrow(UnsupportedMediaTypeException);
    },
  );

  /**
   * QUYẾT ĐỊNH CÓ Ý THỨC 10/09/2026: Office có macro ĐƯỢC PHÉP.
   *
   * Trước đó .docm/.xlsm/.pptm bị chặn. Khách yêu cầu mở vì cán bộ xã dùng biểu
   * mẫu Excel/Word có macro trong công việc thật. Test này khoá quyết định đó
   * lại — ai siết lại phải đọc SECURITY.md phát hiện C-03 trước khi đổi.
   */
  it.each(['.docm', '.xlsm', '.pptm', '.dotm', '.xltm', '.potm'])(
    'CHO PHÉP Office có macro %s (quyết định của khách, không phải sơ suất)',
    (ext) => {
      expect(() => assertExtensionNotBlocked(`bieu-mau${ext}`)).not.toThrow();
    },
  );

  /**
   * Đuôi kép là mẹo lừa hay gặp nhất: Windows mặc định ẩn phần mở rộng đã biết,
   * nên người dùng chỉ thấy "bao-cao.pdf" trong khi tệp thật là .exe.
   */
  describe('đuôi kép', () => {
    it('chặn bao-cao.pdf.exe (đuôi cuối nguy hiểm)', () => {
      expect(() => assertExtensionNotBlocked('bao-cao.pdf.exe')).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('chặn cả khi đuôi nguy hiểm nằm GIỮA: bao-cao.exe.pdf', () => {
      expect(() => assertExtensionNotBlocked('bao-cao.exe.pdf')).toThrow(
        UnsupportedMediaTypeException,
      );
    });
  });

  it('cho qua tài liệu hành chính thông thường', () => {
    for (const name of ['Tờ trình số 12.pdf', 'Phụ lục.docx', 'Danh sách.xlsx', 'Ảnh.jpg']) {
      expect(() => assertExtensionNotBlocked(name)).not.toThrow();
    }
  });

  it('không chặn tệp không có đuôi — để tầng magic bytes xử lý', () => {
    expect(() => assertExtensionNotBlocked('tep-khong-duoi')).not.toThrow();
  });
});

describe('assertExtensionAllowed — danh sách trắng cho tài liệu đính kèm', () => {
  it.each([
    '.pdf', '.rtf', '.txt', '.csv',
    '.doc', '.docx', '.docm', '.dot', '.dotx', '.dotm',
    '.xls', '.xlsx', '.xlsm', '.xlsb', '.xlt', '.xltx', '.xltm',
    '.ppt', '.pptx', '.pptm', '.pps', '.ppsx', '.ppsm', '.pot', '.potx', '.potm',
    '.odt', '.ods', '.odp', '.odg', '.odf',
    '.jpg', '.png', '.zip', '.rar', '.7z',
  ])('cho phép %s', (ext) => {
    expect(() => assertExtensionAllowed('other', `tai-lieu${ext}`)).not.toThrow();
  });

  /* Mặc định đóng: định dạng lạ bị từ chối kể cả khi không nằm trong danh sách
     đen — đó là điểm khác biệt giữa danh sách trắng và danh sách đen. */
  it.each(['.iso', '.dll', '.apk', '.torrent'])('từ chối %s vì không có trong danh sách trắng', (ext) => {
    expect(() => assertExtensionAllowed('other', `tep${ext}`)).toThrow(UnsupportedMediaTypeException);
  });

  it('từ chối tệp không có đuôi vì không xác định được định dạng', () => {
    expect(() => assertExtensionAllowed('other', 'tep-khong-duoi')).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('bỏ qua mục đích chưa khai danh sách trắng (đã có kiểm MIME riêng)', () => {
    expect(() => assertExtensionAllowed('feedback', 'anh.jpg')).not.toThrow();
  });
});

describe('assertContentMatchesExtension — đọc nội dung thật', () => {
  /**
   * Đây là lý do tồn tại của cả tầng thứ ba: hai tầng trên đều dựa vào thứ
   * client khai, tầng này đọc byte thật nên không nói dối được.
   */
  describe('tệp thực thi giả dạng tài liệu', () => {
    it('chặn tệp .exe đổi tên thành .pdf', () => {
      expect(() => assertContentMatchesExtension(WINDOWS_EXE, 'bao-cao.pdf')).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('chặn tệp thực thi Linux đổi tên thành .docx', () => {
      expect(() => assertContentMatchesExtension(LINUX_ELF, 'phu-luc.docx')).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('chặn tập lệnh shell (#!) đổi tên thành .txt', () => {
      const script = Buffer.from('#!/bin/bash\nrm -rf /\n', 'utf8');
      expect(() => assertContentMatchesExtension(script, 'ghi-chu.txt')).toThrow(
        UnsupportedMediaTypeException,
      );
    });
  });

  describe('HTML và SVG giả dạng tài liệu', () => {
    it.each([
      ['<!DOCTYPE html><script>alert(1)</script>', 'HTML đầy đủ'],
      ['<html><body onload="alert(1)">', 'thẻ html'],
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'SVG có script'],
      ['<script>fetch("/api/v1/users")</script>', 'chỉ có thẻ script'],
    ])('chặn %s (%s) dù đặt tên .txt', (content) => {
      expect(() => assertContentMatchesExtension(Buffer.from(content, 'utf8'), 'ghi-chu.txt')).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('chặn cả khi có khoảng trắng và BOM ở đầu', () => {
      const sneaky = Buffer.from('﻿   \n\t<html><script>alert(1)</script>', 'utf8');
      expect(() => assertContentMatchesExtension(sneaky, 'ghi-chu.txt')).toThrow(
        UnsupportedMediaTypeException,
      );
    });
  });

  describe('nội dung khớp đuôi tệp', () => {
    it.each([
      [PDF, 'bao-cao.pdf'],
      [PNG, 'anh.png'],
      [JPEG, 'anh.jpg'],
      [ZIP, 'ho-so.zip'],
      [ZIP, 'phu-luc.docx'],
    ])('cho qua khi nội dung đúng là định dạng đã khai (%#)', (buffer, name) => {
      expect(() => assertContentMatchesExtension(buffer, name)).not.toThrow();
    });

    it('chặn khi nội dung là PNG nhưng đuôi khai .pdf', () => {
      expect(() => assertContentMatchesExtension(PNG, 'bao-cao.pdf')).toThrow(
        UnsupportedMediaTypeException,
      );
    });
  });

  describe('định dạng không có chữ ký đáng tin', () => {
    /* .txt/.csv/.rtf không có magic bytes ổn định. Cố ý KHÔNG kiểm để tránh từ
       chối nhầm — chúng cũng không thực thi được. */
    it('cho qua tệp .txt nội dung thuần văn bản', () => {
      const text = Buffer.from('Kính gửi Ủy ban nhân dân xã,\n', 'utf8');
      expect(() => assertContentMatchesExtension(text, 'don-thu.txt')).not.toThrow();
    });

    it('cho qua tệp .csv', () => {
      const csv = Buffer.from('ho_ten,so_dien_thoai\n', 'utf8');
      expect(() => assertContentMatchesExtension(csv, 'danh-sach.csv')).not.toThrow();
    });
  });

  /**
   * Đây là ca quan trọng nhất sau khi mở Office có macro: cho phép .xlsm KHÔNG
   * có nghĩa là cho phép mọi thứ đặt tên .xlsm. Một tệp thực thi đổi tên thành
   * biểu mẫu Excel vẫn phải bị chặn ở tầng nội dung.
   */
  describe('mở Office có macro không làm yếu tầng magic bytes', () => {
    it('chặn tệp thực thi Windows đổi tên thành .xlsm', () => {
      expect(() => assertContentMatchesExtension(WINDOWS_EXE, 'bieu-mau.xlsm')).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('chặn HTML đổi tên thành .docm', () => {
      const html = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
      expect(() => assertContentMatchesExtension(html, 'bao-cao.docm')).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('cho qua tệp .xlsm thật (bên trong là ZIP như mọi Office hiện đại)', () => {
      expect(() => assertContentMatchesExtension(ZIP, 'bieu-mau.xlsm')).not.toThrow();
    });

    it('chặn .xlsm có nội dung không phải Office', () => {
      expect(() => assertContentMatchesExtension(PDF, 'bieu-mau.xlsm')).toThrow(
        UnsupportedMediaTypeException,
      );
    });
  });

  it('bỏ qua buffer rỗng — dung lượng đã được kiểm ở nơi khác', () => {
    expect(() => assertContentMatchesExtension(Buffer.alloc(0), 'tep.pdf')).not.toThrow();
  });

  it('chặn WEBP giả: có RIFF ở đầu nhưng thiếu nhãn WEBP', () => {
    // "RIFF" + 4 byte kích thước + "WAVE" — đây là tệp âm thanh, không phải ảnh
    const fakeWebp = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE', 'ascii'),
      Buffer.alloc(16),
    ]);
    expect(() => assertContentMatchesExtension(fakeWebp, 'anh.webp')).toThrow(
      UnsupportedMediaTypeException,
    );
  });
});
