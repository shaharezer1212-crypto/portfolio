// Offline renderer: serves the film folder, drives film.js frame by frame in
// headless Chromium and writes JPEG frames.
//   node render.cjs --three <path to three.module.js> --out <dir> [--start 0 --end 1500 --fps 30] [--stills 1,5,12]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '..');
const THREE_FILE = arg('three');
const OUT = arg('out', path.join(ROOT, 'frames'));
const FPS = +arg('fps', 30), START = +arg('start', 0), END = +arg('end', 1500);
const STILLS = arg('stills', '');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ path: THREE_FILE, contentType: 'text/javascript' }));
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
  await page.waitForFunction(() => window.__ready);
  await page.evaluate(() => window.__ready);
  console.log('nano', JSON.stringify(await page.evaluate(() => window.__nanoStats)));

  const shoot = async (t, file) => {
    await page.evaluate(t => { window.__frame(t); return new Promise(r => requestAnimationFrame(() => r())); }, t);
    await page.screenshot({ path: file, type: 'jpeg', quality: 95 });
  };
  const t0 = Date.now();
  if (STILLS) {
    for (const s of STILLS.split(',')) await shoot(+s, path.join(OUT, `still_${(+s).toFixed(2).padStart(5, '0')}.jpg`));
  } else {
    for (let i = START; i < END; i++) {
      await shoot(i / FPS, path.join(OUT, `f_${String(i).padStart(5, '0')}.jpg`));
      if ((i - START) % 50 === 49) console.log(`${i + 1 - START}/${END - START} frames, ${((Date.now() - t0) / (i + 1 - START)).toFixed(0)} ms/frame`);
    }
  }
  console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
