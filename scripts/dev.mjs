/**
 * Khởi chạy song song các server phát triển của ViGov.
 *
 *   npm run dev              → chạy backend + admin-web + zalo-miniapp
 *   npm run dev web zalo     → chỉ chạy những module được liệt kê
 *
 * Viết bằng Node thuần để thư mục gốc không cần cài dependency nào
 * (thêm dependency ở gốc sẽ sinh package-lock.json và làm Next.js
 * suy luận nhầm thư mục gốc workspace).
 *
 * App Flutter không nằm ở đây vì cần chọn thiết bị: dùng `npm run dev:mobile`.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/*
 * Console mặc định của Windows dùng bảng mã cũ (cp437/cp1258) nên chữ tiếng Việt
 * do Node ghi ra bị vỡ thành "─Éang khß╗ƒi chß║íy". Chuyển sang UTF-8 (mã trang 65001).
 * Terminal hiện đại (Windows Terminal, VS Code) đã là UTF-8 nên lệnh này vô hại.
 */
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    // Không đổi được thì vẫn chạy tiếp, chỉ là chữ có dấu hiển thị chưa đẹp
  }
}

/**
 * Chỉ tô màu khi ghi thẳng ra terminal. Khi bị chuyển hướng qua pipe
 * (hoặc chạy trong Windows PowerShell 5.1) mã ANSI hiện thành rác "[33m".
 */
const useColor = process.stdout.isTTY === true;
const paint = (code) => (useColor ? code : '');
const COLORS = {
  api: paint('\x1b[36m'),
  web: paint('\x1b[35m'),
  zalo: paint('\x1b[32m'),
  warn: paint('\x1b[33m'),
  reset: paint('\x1b[0m'),
  dim: paint('\x1b[2m'),
};

const MODULES = {
  api: { dir: 'backend', script: 'start:dev', label: 'api ', url: 'http://localhost:3001/api/v1' },
  // Dùng 3100 thay vì 3000 mặc định của Next: 3000 thường đã bị công cụ khác chiếm,
  // khi đó Next tự nhảy sang 3001 và đụng cổng của backend.
  web: { dir: 'admin-web', script: 'dev', label: 'web ', url: 'http://localhost:3100' },
  zalo: { dir: 'zalo-miniapp', script: 'dev', label: 'zalo', url: 'http://localhost:5173' },
};

const requested = process.argv.slice(2).filter((a) => a in MODULES);
let selected = requested.length > 0 ? requested : Object.keys(MODULES);

/** Module chưa cài dependency thì báo rõ thay vì để npm ném lỗi khó hiểu */
const missing = selected.filter((key) => !existsSync(path.join(ROOT, MODULES[key].dir, 'node_modules')));
if (missing.length > 0) {
  console.error(
    `\nChưa cài dependency cho: ${missing.map((k) => MODULES[k].dir).join(', ')}\n` +
      `Chạy trước:  npm run install:all\n`,
  );
  process.exit(1);
}

/**
 * Đọc địa chỉ MongoDB từ backend/.env — MongoDB có thể nằm ở máy khác,
 * không phải lúc nào cũng là localhost.
 */
function readMongoTarget() {
  const fallback = { host: '127.0.0.1', port: 27017 };
  const envFile = path.join(ROOT, 'backend', '.env');
  if (!existsSync(envFile)) return fallback;
  try {
    const line = readFileSync(envFile, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith('MONGO_URI='));
    if (!line) return fallback;
    const uri = line.slice(line.indexOf('=') + 1).trim();
    // Bỏ phần user:pass@ rồi lấy host:port đầu tiên (đủ dùng cho cả replica set)
    const hostPart = uri.replace(/^mongodb(\+srv)?:\/\//, '').split('@').pop() ?? '';
    const [hostPort] = hostPart.split(/[/?]/);
    const [host, port] = (hostPort ?? '').split(':');
    if (!host) return fallback;
    return { host, port: Number.parseInt(port ?? '27017', 10) || 27017 };
  } catch {
    return fallback;
  }
}

/** Cổng đang có ai đó lắng nghe hay không (dùng để dò MongoDB) */
function isPortOpen(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/*
 * Backend không chạy được nếu thiếu MongoDB — biểu hiện chỉ là dòng
 * "Unable to connect to the database. Retrying (1)..." lặp mãi, dễ tưởng lỗi mã nguồn.
 * Dò trước rồi BỎ QUA riêng backend, vẫn chạy các module còn lại: thiếu cơ sở dữ liệu
 * không phải lý do để chặn người dùng xem giao diện.
 */
let mongoTarget = null;
if (selected.includes('api')) {
  const target = readMongoTarget();
  if (!(await isPortOpen(target.host, target.port))) {
    mongoTarget = target;
    selected = selected.filter((key) => key !== 'api');
  }
}

if (selected.length === 0) {
  console.error(
    `\n${COLORS.warn}Không có module nào để chạy.${COLORS.reset}\n\n` +
      `  Kiểm tra MONGO_URI trong backend/.env rồi thử lại.\n`,
  );
  process.exit(1);
}

console.log('\nĐang khởi chạy môi trường phát triển ViGov:\n');
for (const key of selected) {
  const m = MODULES[key];
  console.log(`  ${COLORS[key]}${m.label}${COLORS.reset}  ${m.dir.padEnd(14)} ${COLORS.dim}${m.url}${COLORS.reset}`);
}

if (mongoTarget) {
  console.log(
    `\n${COLORS.warn}Đã bỏ qua backend: không kết nối được MongoDB ở ${mongoTarget.host}:${mongoTarget.port}.${COLORS.reset}\n` +
      `  Kiểm tra MONGO_URI trong backend/.env, hoặc bật MongoDB cục bộ:\n` +
      `      cd backend && docker compose up -d\n` +
      `  Web Quản trị vẫn xem được giao diện nhờ dữ liệu mẫu (NEXT_PUBLIC_USE_MOCKS=true).`,
  );
}

console.log(`\n${COLORS.dim}Dừng tất cả: Ctrl+C${COLORS.reset}\n`);

const children = [];

for (const key of selected) {
  const m = MODULES[key];
  const child = spawn('npm', ['--prefix', m.dir, 'run', m.script], {
    cwd: ROOT,
    shell: true, // cần trên Windows để tìm được npm.cmd
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefix = `${COLORS[key]}[${m.label}]${COLORS.reset} `;
  const forward = (stream, target) => {
    let buffered = '';
    stream.on('data', (chunk) => {
      buffered += chunk.toString();
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) target.write(prefix + line + '\n');
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`${prefix}đã dừng với mã lỗi ${code}\n`);
    }
  });

  children.push(child);
}

/** Ctrl+C dừng toàn bộ tiến trình con */
const shutdown = () => {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
