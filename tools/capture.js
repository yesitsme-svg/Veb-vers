// Frames to look at. Usage: node tools/capture.js <template-id> <t0> <t1> <steps> [ratio] [json-overrides]
//   e.g. node tools/capture.js push-row 1.9 4.0 8 3:4 '{"rotX":25,"size":1.4}'
// Writes tools/out/<template>/fNNN_<t>.png plus a contact sheet sheet.png, and dump.json with
// per-card position / renderOrder / uOpacity / uFade at t0.
const { open, PAGE_HELPERS } = require('./harness');
const fs = require('fs'); const path = require('path');
(async () => {
  const [tpl, t0s, t1s, stepsS, ratio, ovS] = process.argv.slice(2);
  if (!tpl) { console.log('usage: node tools/capture.js <template-id> <t0> <t1> <steps> [ratio] [json-overrides]'); process.exit(2); }
  const t0 = +t0s, t1 = +t1s, steps = +stepsS || 1, ov = ovS ? JSON.parse(ovS) : {};
  const out = path.join(__dirname, 'out', tpl); fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await open({ ratio: ratio && ratio !== '-' ? ratio : null });
  if (process.env.MG_IMGS) { await page.evaluate(n => window.__app.setTestImages(n, true), +process.env.MG_IMGS); await page.waitForTimeout(300); }   // MG_IMGS=7 → the mixed-aspect test deck used by verify.js
  const ok = await page.evaluate(({ tpl, ov }) => { const A = window.__app; const r = A.applyTemplateById(tpl); A.state.playing = false; Object.assign(A.state, ov); return r; }, { tpl, ov });
  if (!ok) { console.log('no template', tpl); process.exit(1); }
  const files = [];
  for (let k = 0; k < steps; k++) {
    const t = t0 + (t1 - t0) * (steps === 1 ? 0 : k / (steps - 1));
    const d = await page.evaluate(t => { const A = window.__app; A.setTime(t); A.renderFrame(); return A.renderer.domElement.toDataURL('image/png'); }, t);
    const f = path.join(out, `f${String(k).padStart(3, '0')}_${t.toFixed(3)}.png`); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); files.push(f);
  }
  const dump = await page.evaluate(({ t, H }) => { const { A } = eval(H); A.setTime(t); A.renderFrame(); const rows = [];
    A.forEachCard(o => rows.push({ slot: o.userData && o.userData.slot, visible: o.visible, x: +o.position.x.toFixed(3), y: +o.position.y.toFixed(3), z: +o.position.z.toFixed(3), renderOrder: +(+o.renderOrder).toFixed(3), uOpacity: +o.material.uniforms.uOpacity.value.toFixed(3), uFade: +o.material.uniforms.uFade.value.toFixed(3) }));
    return rows; }, { t: t0, H: PAGE_HELPERS });
  fs.writeFileSync(path.join(out, 'dump.json'), JSON.stringify(dump, null, 1));
  await browser.close();
  // contact sheet via python/PIL (thumbnails 300px wide, 4 per row)
  const { execSync } = require('child_process');
  try { execSync(`python3 - <<'EOF'\nfrom PIL import Image\nimport glob,os\nfs=sorted(glob.glob(${JSON.stringify(out + '/f*.png')}))\nth=[]\nfor f in fs:\n    i=Image.open(f); i.thumbnail((300,400)); th.append(i)\nW=max(i.width for i in th); H=max(i.height for i in th); cols=min(4,len(th)); rows=(len(th)+cols-1)//cols\ns=Image.new('RGB',(cols*(W+8),rows*(H+8)),(40,40,40))\nfor k,i in enumerate(th): s.paste(i,((k%cols)*(W+8),(k//cols)*(H+8)))\ns.save(${JSON.stringify(out + '/sheet.png')})\nEOF`); } catch (e) { console.log('sheet skipped:', e.message.split('\n')[0]); }
  console.log(`wrote ${files.length} frames + dump.json + sheet.png → ${out}`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
