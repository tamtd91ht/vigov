/**
 * Đặt thư mục tạm cho lần chạy e2e (P5-07).
 *
 * mongodb-memory-server dựng dbPath bằng os.tmpdir(). WiredTiger cấp phát trước
 * tệp journal 100MB, nên khi ổ chứa thư mục tạm của hệ điều hành gần đầy, mongod
 * chết ngay lúc khởi động với "No space left on device → fassert() failure" và
 * TOÀN BỘ test e2e đỏ vì lý do không liên quan gì tới mã nguồn.
 *
 * Trỏ thư mục tạm về ngay trong `backend/.tmp-e2e` (cùng ổ với mã nguồn) để lần
 * chạy test không phụ thuộc dung lượng còn trống của ổ hệ điều hành.
 * Thư mục này đã được .gitignore bỏ qua; mongodb-memory-server tự dọn khi dừng.
 *
 * Phải chạy ở `globalSetup` chứ KHÔNG phải `setupFiles`: mỗi tệp test của Jest
 * chạy trong hộp cát có bản sao riêng của process.env, trong khi module lõi `os`
 * vẫn đọc process.env THẬT — sửa trong hộp cát sẽ không có tác dụng.
 */
const fs = require('node:fs');
const path = require('node:path');

module.exports = async () => {
  const tmpDir = path.resolve(__dirname, '..', '..', '.tmp-e2e');
  fs.mkdirSync(tmpDir, { recursive: true });

  // POSIX đọc TMPDIR, Windows đọc TEMP/TMP — đặt cả ba cho chắc
  process.env.TMPDIR = tmpDir;
  process.env.TEMP = tmpDir;
  process.env.TMP = tmpDir;
};
