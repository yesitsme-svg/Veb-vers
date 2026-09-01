# Motion Grid

Free browser tool: motion templates that turn mockups into animated showcases.
Live: https://wannathis.one/online-tools/motion-grid/app

## Files

```
index.html                     the whole app — single self-contained file (253 KB)
cdn/images/motion-grid/        source assets — mirror of the CDN bucket (see below)
  01..20.webp                  the 20 demo images shown in the picker
  og.png                       1200x630 social preview
```

## Deploy — read this first

**Only `index.html` gets deployed.** It has zero relative dependencies: every font,
image and script is loaded from an absolute CDN URL. Drop that one file at
`/online-tools/motion-grid/app` and the tool works.

**The `cdn/` folder is NOT deployed with the app.** It is a local mirror of what
already lives in the CloudFront bucket, kept here as the source of truth. The path
inside `cdn/` is exactly the path in the bucket:

```
cdn/images/motion-grid/01.webp  ->  https://d2pas86kykpvmq.cloudfront.net/images/motion-grid/01.webp
cdn/images/motion-grid/og.png   ->  https://d2pas86kykpvmq.cloudfront.net/images/motion-grid/og.png
```

So: never rename anything on upload — copy `cdn/` into the bucket root as is.
Those files are already uploaded and unchanged, so a normal deploy touches nothing here.

Cache: `s-maxage=300` — changes go live within ~5 min.

## Adding a demo image

Two steps, both required, or the image silently 404s:

1. Put the file in `cdn/images/motion-grid/` (e.g. `21.webp`) and upload it to the
   same path in the bucket.
2. Bump `length:20` in the `DEMO_URLS` line of `index.html`:

```js
const DEMO_URLS = Array.from({length:20},(_,i)=>
  `https://d2pas86kykpvmq.cloudfront.net/images/motion-grid/${String(i+1).padStart(2,'0')}.webp`);
```

## Running it locally

```
python3 -m http.server 8000    # then http://localhost:8000
```

Open it as a `file://` URL instead and the video export dies on CORS. Use a server.

## SEO / head — do not drop these

The `<head>` was hand-tuned after an earlier archive was cut, and these lines were
lost once already. Keep them:

- `<link rel="canonical" href="https://wannathis.one/online-tools/motion-grid/app">`
- `og:url` — same `/app` URL (must match canonical)
- `<link rel="icon" ...favicon_v3.png>` and `<link rel="apple-touch-icon" ...webclip_v2.png>`
- `<link rel="sitemap" ...sitemap.xml>`
- `og:image` / `twitter:image` -> `images/motion-grid/og.png`
- title: `Free Motion Templates | WANNATHIS.ONE`

There is a separate marketing landing at `/online-tools/motion-grid` (no `/app`).
It is a page inside the main Nuxt site, **not** part of this repo — don't touch it from here.

## Third-party scripts in the head

DataFast analytics, Google Tag Manager (`GTM-WXFVD29`), Rewardful (`f09e09`).
Site-wide tracking — keep them.

## Versioning

- `main` is the working branch. Commit and push freely — nothing auto-deploys,
  pushing to `main` never touches the live site.
- **Do not create tags or releases.** A tag means "this version is approved for
  production", and that call belongs to the repo owner alone. Tagging on your own
  destroys the only signal that tells the deployer what to ship. If you think a
  version is ready, say so — don't tag it.
- Production is deployed from a **tag**, never from "latest commit".

## Notes

- The app is **desktop-only** — phones hit a full-screen `#mobileGate` notice.
- Video export runs `@ffmpeg/core@0.12.6` from unpkg, in-browser (WASM). Nothing is
  uploaded anywhere.
