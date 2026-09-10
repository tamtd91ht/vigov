/**
 * Hoàn thiện `dist/` thành gói deploy được cho Zalo Mini App — chạy SAU `vite build`.
 *
 * Vì sao cần script này:
 *
 * Zalo Mini App KHÔNG phục vụ index.html của dự án. Nó dựng trang chủ riêng rồi
 * nạp những tệp được liệt kê trong app-config.json bằng thẻ <script> và <link>
 * cổ điển. Thiếu hai mảnh:
 *
 *   1. `inline.js` — dựng lại thẻ meta và <div id="root"> trên trang của Zalo.
 *   2. `listSyncJS` phải trỏ tới bundle chính. `zmp sync-config` BỎ QUA thẻ
 *      <script type="module"> mà Vite phát ra, nên tự nó không bao giờ điền
 *      bundle vào — app trắng trang.
 *
 * `vite build` dọn sạch outDir, nên hai mảnh trên biến mất sau mỗi lần build.
 * Vì thế script này nằm trong `npm run build` chứ không đứng riêng: dist sau
 * build luôn ở trạng thái deploy được, không có cửa sổ nào để lỡ tay deploy
 * một thư mục thiếu inline.js.
 *
 * Thứ tự trong listSyncJS quan trọng: `inline.js` phải chạy trước để tạo
 * <div id="root">, nếu không React không tìm thấy chỗ mount.
 *
 * Điều kiện đi kèm ở vite.config.ts: `codeSplitting: false` để bundle gộp về
 * một tệp không còn lệnh import — thẻ script cổ điển không hiểu ESM.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CONFIG = path.join(ROOT, 'app-config.json');
const INLINE = path.join(DIST, 'inline.js');

/**
 * Bản demo hay bản chính thức — đọc đúng thứ tự Vite nạp cấu hình:
 * biến môi trường sẵn có (CI, Docker) > .env.local > .env.
 *
 * Cần ở đây vì app.title trong app-config.json là tiêu đề Zalo dựng, nằm ngoài
 * bundle nên `import.meta.env` không với tới. Không có mảnh này thì đổi
 * VITE_DEMO_MODE vẫn còn sót một chỗ mang tên bản kia, và đó là loại sai sót
 * chỉ lộ ra khi hồ sơ đã nằm trên bàn xét duyệt.
 */
function isDemoBuild() {
  if (process.env.VITE_DEMO_MODE !== undefined) return process.env.VITE_DEMO_MODE !== 'false';
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name);
    if (!existsSync(file)) continue;
    const hit = readFileSync(file, 'utf8').match(/^\s*VITE_DEMO_MODE\s*=\s*(\S*)/m);
    if (hit) return hit[1] !== 'false';
  }
  return true; // mặc định giống src/config/app.config.ts
}

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

/**
 * Sinh inline.js từ dist/index.html mà không cần zmp-cli.
 *
 * Dùng làm phương án dự phòng: `zmp sync-config` cần zmp-cli chạy được, mà
 * trong image Docker (stage build của Dockerfile) không có phiên đăng nhập.
 * Nội dung sinh ra giống hệt bản của zmp-cli — chép các thẻ <meta> sang trang
 * của Zalo rồi tạo phần tử gốc. KHÔNG chép <title>: tiêu đề lấy từ
 * app-config.json (app.title), chép thêm sẽ đá nhau.
 */
function generateInlineJs() {
  const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'));
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];

  const lines = metas.map((tag) => {
    // Chuẩn hoá về thẻ tự đóng cho khớp dạng zmp-cli phát ra
    const selfClosed = tag.replace(/\s*\/?>$/, '/>');
    return `document.head.innerHTML += \`${selfClosed}\`;`;
  });
  lines.push('document.body.innerHTML += `<div id="root" />`;');

  writeFileSync(INLINE, `${lines.join('\n')}\n`, 'utf8');
}

// 1. Ưu tiên để zmp-cli sinh inline.js (bám sát định dạng nền tảng mong đợi).
//    Gọi thẳng tệp CLI bằng node thay vì qua npx: trên Windows, spawn "npx.cmd"
//    không kèm shell sẽ lỗi ENOENT.
const zmpCli = path.join(ROOT, 'node_modules', 'zmp-cli', 'index.js');
try {
  execFileSync(process.execPath, [zmpCli, 'sync-config', 'dist/index.html', '-r', '#root'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
} catch (err) {
  console.warn(`\n⚠ zmp sync-config không chạy được (${err.message}) — tự sinh inline.js.`);
}

// 2. Dù đi đường nào cũng phải có inline.js, nếu không app trắng trang
if (!existsSync(INLINE)) generateInlineJs();

// 3. Bổ sung bundle chính — phần zmp sync-config luôn bỏ sót
const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
config.listSyncJS = ['inline.js', findAsset('.js')];
config.listCSS = [findAsset('.css')];
config.listAsyncJS = config.listAsyncJS ?? [];

// 3b. Tiêu đề Zalo dựng phải nói đúng bản đang phát hành. Chỉ thêm/bớt chữ
//     "Demo" vào tên có sẵn để không phải chép tên app vào hai chỗ.
const baseTitle = config.app.title.replace(/^ViGov Demo\b/, 'ViGov');
config.app.title = isDemoBuild() ? baseTitle.replace(/^ViGov\b/, 'ViGov Demo') : baseTitle;

writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

// 3c. Chốt chặn: bundle phải nhúng được VITE_API_BASE_URL thật.
//
//     VÌ SAO KIỂM TRÊN BUNDLE CHỨ KHÔNG KIỂM process.env: thứ đem đi deploy là
//     tệp .js này, không phải biến môi trường. Vite nhúng VITE_* lúc build, nên
//     một lần build thiếu .env.local là bundle nuốt trọn giá trị mặc định
//     `http://localhost:3001/api/v1` — mà `.env.local` KHÔNG nằm trong git, nên
//     chỉ cần đổi máy hoặc dọn thư mục là mất mà không ai nhận ra.
//
//     Hậu quả đã xảy ra thật (bản build 10/09/2026): trong webview Zalo,
//     localhost là chính chiếc điện thoại của người dân, không có máy chủ nào ở
//     đó. App báo "Không kết nối được máy chủ" ở màn liên kết số điện thoại.
//     Bundle hỏng nhìn y hệt bundle tốt, chỉ lộ ra sau khi đã deploy lên Zalo.
//
//     CÁCH NHẬN BIẾT: app.config.ts gọi envText(import.meta.env.X, 'mặc định'),
//     Vite thay import.meta.env.X bằng hằng chuỗi khi biến có giá trị, và bằng
//     `void 0` khi biến trống. Nên phải soi ĐỐI SỐ THỨ NHẤT, không soi cả tệp:
//     chuỗi mặc định 'http://localhost:3001/api/v1' luôn có mặt trong bundle
//     với tư cách đối số thứ hai, kể cả ở một bản build hoàn toàn đúng.
const bundlePath = path.join(DIST, findAsset('.js').replace('./', ''));
const bundleText = readFileSync(bundlePath, 'utf8');
const apiCall = bundleText.match(/baseUrl:\s*\w+\(\s*(void 0|`([^`]*)`)/);
if (!apiCall) {
  console.warn(
    '\n⚠ Không dò được baseUrl trong bundle để kiểm tra — app.config.ts có thể đã đổi cấu trúc.\n' +
      '  Hãy tự xác nhận bundle trỏ đúng backend trước khi deploy.',
  );
} else {
  const embedded = apiCall[1] === 'void 0' ? '' : apiCall[2];
  if (embedded === '' || /^https?:\/\/(localhost|127\.0\.0\.1)\b/.test(embedded)) {
    const shown = embedded === '' ? '(trống — rơi về mặc định localhost)' : `"${embedded}"`;
    throw new Error(
      `Bundle KHÔNG dùng được trong Zalo: VITE_API_BASE_URL lúc build là ${shown}.\n` +
        `Webview Zalo chặn http://, và localhost là chính điện thoại của người dân ` +
        `chứ không phải máy chủ.\n` +
        `Cách sửa: cp .env.example .env.local rồi đặt VITE_API_BASE_URL trỏ tới ` +
        `backend HTTPS công khai, sau đó build lại.`,
    );
  }
  console.log('  API        :', embedded);
}

// 4. Chốt chặn: mọi tệp được liệt kê phải thực sự nằm trong dist.
//    Deploy một app-config trỏ vào tệp không tồn tại = trang trắng, và triệu
//    chứng đó nhìn y hệt lỗi mã nguồn nên rất tốn thời gian truy.
const missing = [...config.listSyncJS, ...config.listCSS, ...config.listAsyncJS].filter(
  (rel) => !existsSync(path.join(DIST, rel)),
);
if (missing.length > 0) {
  throw new Error(`app-config.json trỏ tới tệp không có trong dist: ${missing.join(', ')}`);
}

console.log('\napp-config.json đã sẵn sàng để deploy:');
console.log('  listCSS    :', config.listCSS.join(', '));
console.log('  listSyncJS :', config.listSyncJS.join(', '));
