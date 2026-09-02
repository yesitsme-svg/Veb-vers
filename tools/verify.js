// Regression gate for a preset. Usage: node tools/verify.js <template-id> [--tilt] [--smoke]
//   seam   : frame(t) vs frame(t+loop) must be pixel-identical for 3 / 7 / 20 mixed-aspect images
//   pops   : consecutive-frame diffs across one beat (4 ms step) — a discrete jump = a flick/pop
//   --tilt : repeat the pop scan under Rotate X/Y ±45 and Card Size 1.6
//   --smoke: every template builds and renders visible cards
// Exit code 1 on any failure, so a sub-agent can rely on it.
const { open, PAGE_HELPERS } = require('./harness');
(async () => {
  const [tpl, ...flags] = process.argv.slice(2);
  if (!tpl) { console.log('usage: node tools/verify.js <template-id> [--tilt] [--smoke]'); process.exit(2); }
  const { browser, page } = await open();
  let fail = 0;
  const scan = (t0, t1, dt, overrides) => page.evaluate(({ t0, t1, dt, overrides, H }) => {
    const { A, grabSmall } = eval(H); Object.assign(A.state, overrides || {}); A.renderFrame();
    let prev = grabSmall(t0); const out = [];
    for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) {
      const cur = grabSmall(t); let big = 0;
      for (let i = 0; i < cur.length; i += 4) if (Math.abs(cur[i] - prev[i]) + Math.abs(cur[i + 1] - prev[i + 1]) + Math.abs(cur[i + 2] - prev[i + 2]) > 90) big++;
      out.push([+t.toFixed(3), big]); prev = cur;
    }
    for (const k of Object.keys(overrides || {})) A.state[k] = k === 'size' || k === 'spacing' ? 1 : 0;
    return out;
  }, { t0, t1, dt, overrides, H: PAGE_HELPERS });
  const judge = (name, rows) => {
    const r = rows.slice(1); // first pair after a settings change is a harness artefact
    const s = r.map(x => x[1]).sort((a, b) => a - b); const med = s[s.length >> 1], max = s[s.length - 1];
    // a pop is an ISOLATED jump: ≥3× both neighbours (smooth acceleration never does that at 4 ms)
    // and at least 2% of the frame (320×h scan) — smaller blips are AA noise
    const p90 = s[Math.floor(s.length * 0.9)];
    const pops = r.filter((x, i) => i > 0 && i < r.length - 1 && x[1] > 2700 && x[1] > 3 * Math.max(r[i - 1][1], r[i + 1][1]) && x[1] > 2 * p90);
    console.log(`${name}: median=${med} max=${max} pops=${pops.length}${pops.length ? ' ' + JSON.stringify(pops.slice(0, 5)) : ''}`);
    if (pops.length) fail++;
  };
  for (const cnt of [3, 7, 20]) {
    await page.evaluate(cnt => window.__app.setTestImages(cnt, true), cnt);
    await page.waitForTimeout(200);
    const r = await page.evaluate(({ tpl, H }) => {
      const { A, grab } = eval(H); if (!A.applyTemplateById(tpl)) return { err: 'no template ' + tpl };
      A.state.playing = false; const loop = A.getActive().loopSeconds;
      const seam = (t0) => { const a = grab(t0).slice(), b = grab(t0 + loop); let d = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 2) d++; return d; };
      const c = []; A.forEachCard(o => { if (o.visible) c.push(o); });
      return { cards: c.length, loop: +loop.toFixed(3), seamA: seam(0.37), seamB: seam(1.23) };
    }, { tpl, H: PAGE_HELPERS });
    if (r.err) { console.log(r.err); process.exit(1); }
    const ok = r.seamA === 0 && r.seamB === 0 && r.cards > 0;
    console.log(`${tpl} imgs=${cnt}: cards=${r.cards} loop=${r.loop}s seam=${r.seamA}/${r.seamB}px ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) fail++;
    if (cnt === 7) {
      const cyc = await page.evaluate(() => { const P = window.__app.state.P; return (P.dur || 0) + (P.hold || 0) || 1.5; });
      judge(`  pops default (one beat, 4ms)`, await scan(2 * cyc, 3 * cyc + 0.1, 0.004));
      if (flags.includes('--tilt')) for (const ov of [{ rotX: 45 }, { rotX: -45 }, { rotY: 45 }, { rotX: 30, rotY: 30 }, { rotX: 45, size: 1.6 }, { spacing: 0.5 }])
        judge(`  pops ${JSON.stringify(ov)}`, await scan(2 * cyc, 3 * cyc + 0.1, 0.004, ov));
    }
  }
  if (flags.includes('--smoke')) {
    await page.evaluate(() => window.__app.setTestImages(0));
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const A = window.__app; const bad = [];
      for (const t of A.templates) { if (!t.id) continue;
        try { A.applyTemplateById(t.id); A.state.playing = false; A.setTime(0.5); A.renderFrame(); const c = []; A.forEachCard(o => { if (o.visible) c.push(o); }); if (!c.length) bad.push(t.id + ':no-cards'); }
        catch (e) { bad.push(t.id + ':' + e.message); } }
      return { n: A.templates.filter(t => t.id).length, bad };
    });
    console.log(`smoke: ${s.n} templates, bad=${JSON.stringify(s.bad)}`);
    if (s.bad.length) fail++;
  }
  await browser.close();
  console.log(fail ? `VERIFY FAILED (${fail})` : 'VERIFY OK');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
