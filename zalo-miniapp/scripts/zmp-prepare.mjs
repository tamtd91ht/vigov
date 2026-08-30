/**
 * Chuẩn bị app-config.json cho `zmp deploy` — chạy SAU `vite build`.
 *
 * Vì sao cần script này:
 *
 * Zalo Mini App KHÔNG phục vụ index.html của dự án. Nó dựng trang chủ riêng rồi
 * nạp những tệp được liệt kê trong app-config.json bằng thẻ <script> và <link>
 * cổ điển. `zmp sync-config` sinh được `inline.js` (dựng lại thẻ meta và
 * <div id="root">) và điền `listCSS`, nhưng nó BỎ QUA thẻ <script type="module">
 * mà Vite phát ra — nên bundle chính không bao giờ được liệt kê và app trắng
 * trang. Script này vá đúng chỗ thiếu đó.
 *
 * Thứ tự trong listSyncJS quan trọng: `inline.js` phải chạy trước để tạo
 * <div id="root">, nếu không React không tìm thấy chỗ mount.
 *
 * Điều kiện đi kèm ở vite.config.ts: `codeSplitting: false` để bundle gộp
 * về một tệp không còn lệnh import — thẻ script cổ điển không hiểu ESM.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CONFIG = path.join(ROOT, 'app-config.json');

/** Mã băm trong tên tệp đổi theo mỗi lần build nên phải dò lại, không hardcode */
function findAsset(extension) {
  const dir = path.join(DIST, 'assets');
  const hits = readdirSync(dir).filter((f) => f.endsWith(extension));
  if (hits.length !== 1) {
    throw new Error(
      `Cần đúng 1 tệp ${extension} trong dist/assets, tìm thấy ${hits.length}: ${hits.join(', ')}.\n` +
        `Nhiều hơn 1 tệp .js nghĩa là bundle đã bị tách chunk — kiểm tra ` +
        `codeSplitting trong vite.config.ts.`,
    );
  }
  return `./assets/${hits[0]}`;
}

// 1. Để zmp sinh inline.js (thẻ meta + phần tử gốc) và điền listCSS.
//    Gọi thẳng tệp CLI bằng node thay vì qua npx: trên Windows, spawn "npx.cmd"
//    không kèm shell sẽ lỗi ENOENT.
const zmpCli = path.join(ROOT, 'node_modules', 'zmp-cli', 'index.js');
execFileSync(process.execPath, [zmpCli, 'sync-config', 'dist/index.html', '-r', '#root'], {
  cwd: ROOT,
  stdio: 'inherit',
});

// 2. Bổ sung bundle chính — phần zmp sync-config bỏ sót
const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
const appBundle = findAsset('.js');

config.listSyncJS = ['inline.js', appBundle];
config.listCSS = [findAsset('.css')];
config.listAsyncJS = config.listAsyncJS ?? [];

writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

console.log('\napp-config.json đã sẵn sàng để deploy:');
console.log('  listCSS    :', config.listCSS.join(', '));
console.log('  listSyncJS :', config.listSyncJS.join(', '));
