// Shared browser harness for Motion Grid checks. The CDN is unreachable from the cloud
// sandbox, so three.js comes from node_modules and the demo images from cdn/ (bucket mirror).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const REPO = path.resolve(__dirname, '..');
const THREE = path.join(__dirname, 'node_modules/three/build/three.module.js');   // three's "exports" map hides the subpath from require.resolve
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const PORT = process.env.MG_PORT || '8123';   // MG_PORT=8131 → a second worktree can run its own server

async function open(opts = {}) {
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  page.on('pageerror', e => console.log('PAGE-EXC:', e.message));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(`http://localhost:${PORT}/`)) return route.continue();
    if (url.includes('three.module.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(THREE, 'utf8') });
    const m = url.match(/cloudfront\.net\/images\/motion-grid\/(\d+\.webp)/);
    if (m) return route.fulfill({ contentType: 'image/webp', body: fs.readFileSync(path.join(REPO, 'cdn/images/motion-grid', m[1])) });
    return route.abort();
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { if (!window.__app) return false; const c = []; window.__app.forEachCard(o => c.push(o)); return c.length > 0; }, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  if (opts.ratio) { await page.evaluate(r => { const b = document.querySelector(`#ratios button[data-r="${r}"]`); if (b) b.click(); }, opts.ratio); await page.waitForTimeout(300); }
  return { browser, page };
}
// In-page helper source: grab(t) → RGBA of the stage at time t (deterministic, playback paused)
const PAGE_HELPERS = `(() => {
  const A = window.__app; A.state.playing = false;
  const src = A.renderer.domElement; const W = src.width, H = src.height;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const [cvF, xF] = mk(W, H);
  const grab = (t) => { A.setTime(t); A.renderFrame(); xF.drawImage(src, 0, 0); return xF.getImageData(0, 0, W, H).data; };
  const sw = 320, sh = Math.round(320 * H / W); const [cvS, xS] = mk(sw, sh);
  const grabSmall = (t) => { A.setTime(t); A.renderFrame(); xS.drawImage(src, 0, 0, sw, sh); return xS.getImageData(0, 0, sw, sh).data.slice(); };
  return { A, W, H, grab, grabSmall };
})()`;
module.exports = { open, PAGE_HELPERS, REPO };
