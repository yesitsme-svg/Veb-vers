#!/usr/bin/env python3
"""Reference video → numbers. Usage: python3 tools/analyze-ref.py <video.mp4> <name> [--axis x|y|both] [--thr 18]

Writes tools/out/ref-<name>/:
  frames/rNNN.png   every frame at 30 fps
  sheet.png         contact sheet (every 8th frame)
  runs.json         per frame: bright runs along the centre row (x) and centre column (y)
  report.txt        rest states (positions frozen ≥5 frames), beat starts, gaps, card sizes, motion profile
Runs are [start,end] pixel spans where the mean brightness in a 80px band exceeds --thr (cards on a dark bg).
Dark bands INSIDE an image also split a run — check the contact sheet before trusting a gap.
"""
import sys, os, json, glob, subprocess
import numpy as np
from PIL import Image

args = sys.argv[1:]
if len(args) < 2: print(__doc__); sys.exit(2)
video, name = args[0], args[1]
axis = args[args.index('--axis') + 1] if '--axis' in args else 'both'
thr = float(args[args.index('--thr') + 1]) if '--thr' in args else 18
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'out', 'ref-' + name); fr = os.path.join(out, 'frames'); os.makedirs(fr, exist_ok=True)
ff = None
try:
    ff = subprocess.check_output(['node', '-e', "console.log(require('@ffmpeg-installer/ffmpeg').path)"], cwd=here).decode().strip()
except Exception: ff = 'ffmpeg'
if not glob.glob(fr + '/r*.png'):
    subprocess.check_call([ff, '-loglevel', 'error', '-i', video, '-vf', 'fps=30', fr + '/r%03d.png'])
fs = sorted(glob.glob(fr + '/r*.png'))
im0 = Image.open(fs[0]); W, H = im0.size
print(f'{len(fs)} frames, {W}x{H}')

def runs1d(v):
    on = v > thr; r = []; s = None
    for i, o in enumerate(on):
        if o and s is None: s = i
        if not o and s is not None: r.append([s, i]); s = None
    if s is not None: r.append([s, len(on)])
    return r

data = []
for f in fs:
    a = np.asarray(Image.open(f).convert('L'))
    row = a[H // 2 - 40:H // 2 + 40, :].mean(axis=0) if axis in ('x', 'both') else None
    col = a[:, W // 2 - 40:W // 2 + 40].mean(axis=1) if axis in ('y', 'both') else None
    data.append({'x': runs1d(row) if row is not None else None, 'y': runs1d(col) if col is not None else None})
json.dump({'W': W, 'H': H, 'fps': 30, 'frames': data}, open(out + '/runs.json', 'w'))

# contact sheet
th = []
for f in fs[::8][:40]:
    i = Image.open(f); i.thumbnail((216, 270)); th.append(i)
tw, thh = th[0].size; cols = 5; rows = (len(th) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * thh))
for k, i in enumerate(th): sheet.paste(i, ((k % cols) * tw, (k // cols) * thh))
sheet.save(out + '/sheet.png')

rep = [f'{video}\n{len(fs)} frames @30fps, {W}x{H}\n']
for ax in (['x', 'y'] if axis == 'both' else [axis]):
    seq = [d[ax] for d in data]
    rep.append(f'=== axis {ax} (runs along the centre {"row" if ax == "x" else "column"}) ===')
    # rest frames: identical runs for >=5 consecutive frames
    rests = []; i = 0
    while i < len(seq):
        j = i
        while j + 1 < len(seq) and seq[j + 1] == seq[i]: j += 1
        if j - i + 1 >= 5: rests.append((i, j, seq[i]))
        i = j + 1
    rep.append(f'rest states (frame from-to, runs): ')
    for a, b, r in rests: rep.append(f'  f{a:03d}-{b:03d}  {r}')
    if len(rests) >= 2:
        beats = [rests[k + 1][0] - rests[k][0] for k in range(len(rests) - 1)]
        rep.append(f'beat lengths (frames between rest starts): {beats}  → avg {np.mean(beats) / 30:.2f}s')
        holds = [b - a + 1 for a, b, _ in rests]
        rep.append(f'hold lengths (frames): {holds} → avg {np.mean(holds) / 30:.2f}s; motion ≈ {(np.mean(beats) - np.mean(holds)) / 30:.2f}s')
    # gaps and sizes in rest states
    for a, b, r in rests[:6]:
        sizes = [e - s for s, e in r]; gaps = [r[k + 1][0] - r[k][1] for k in range(len(r) - 1)]
        rep.append(f'  f{a:03d}: sizes {sizes}  gaps {gaps}')
    # motion profile of the first full beat: track the leading edge of the run nearest the centre
    if len(rests) >= 2:
        a0, b0 = rests[0][1], rests[1][0]
        rep.append(f'motion profile f{a0}-{b0}: per-frame edge positions of every run')
        for fi in range(a0, min(b0 + 1, a0 + 70)):
            rep.append(f'  f{fi:03d} ' + ' '.join(f'{s}-{e}' for s, e in seq[fi]))
    rep.append('')
open(out + '/report.txt', 'w').write('\n'.join(rep))
print('\n'.join(rep[:40]))
print(f'→ {out}/report.txt, runs.json, sheet.png')
