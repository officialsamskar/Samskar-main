# Samskar website

Static single-page site for Samskar. No build step.

## Files
- `index.html` — the website
- `404.html` — shown for unknown pages
- `images/` — logo and service images
- `icon-192.png`, `icon-512.png` — app and home-screen icons
- `og-image.jpg` — preview image for WhatsApp, Instagram and Google links (1200x630)
- `site.webmanifest` — lets phones add the site to the home screen
- `robots.txt`, `sitemap.xml` — help Google find the site
- `vercel.json` — caching and security headers

## Deploy (Vercel + GitHub)
1. Copy every file and the `images` folder into the root of the GitHub repo.
2. Commit and push. Vercel redeploys automatically.
3. Framework preset: **Other**. Leave Build Command and Output Directory empty.

If the site moves to a new domain, update the address in `index.html`
(canonical, og:url, og:image, schema), `robots.txt` and `sitemap.xml`.
