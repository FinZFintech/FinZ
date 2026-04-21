# finz.finance — Marketing Website

Static, mobile-first, SEO-optimised marketing site for **FinZ Finance Private Limited** — an RBI-registered NBFC-MFI.

## Stack

- Pure HTML5, CSS3 and vanilla JavaScript. No framework, no build step required.
- Google Fonts (Inter, Manrope) loaded via CDN.
- Single stylesheet: `assets/css/main.css`. Single JS file: `assets/js/main.js`.

## Directory layout

```
website/
├── index.html                       Home
├── about.html                       About
├── rates-and-fees.html              Rates, fees, charges
├── fair-practices-code.html         FPC
├── grievance-redressal.html         Three-tier escalation + RBI Ombudsman
├── lending-partners.html            Co-lending / sourcing partner disclosure
├── collection-agencies.html         All 10 empanelled agencies
├── policies.html                    Downloadable policies (EN + vernacular)
├── kfs.html                         Sample Key Fact Statement
├── privacy-policy.html              Privacy Policy (DPDP Act compliant)
├── terms.html                       Website T&Cs
├── contact.html                     Contact + enquiry form
├── products/
│   ├── education-loan.html
│   ├── higher-education-loan.html
│   └── employee-loan.html
├── assets/
│   ├── css/main.css
│   ├── js/main.js
│   ├── images/                      Drop logo.png, favicon.png, apple-touch-icon.png, og-banner.png
│   └── policies/                    Drop all policy PDFs here (see filename conventions in policies.html)
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── README.md
└── TODO.md
```

## Previewing

All internal links and asset paths are **relative**, so you can preview the site anywhere without a server.

**Option 1 — Open HTML files directly in a browser.** Works from `file://` — just double-click `index.html`, or drag-drop into a browser tab. Click through the navigation freely. Google Fonts load because they are loaded over `https://`.

**Option 2 — Local HTTP server** (closer to production behaviour):

```bash
cd finz-website
python3 -m http.server 8080
# open http://localhost:8080
```

or:

```bash
npx serve .
```

## Deployment

Any static host works: Cloudflare Pages, Netlify, Vercel, GitHub Pages, Nginx/Apache, S3+CloudFront. Point your host at the root of this folder and map the domain.

This website is maintained in its **own git repository**, separate from the FinZ mobile app.

## Running into placeholders?

All `{{PLACEHOLDER}}` tokens and to-be-filled items are tracked in [TODO.md](./TODO.md). Search the codebase with:

```bash
grep -rn "{{" .
```

## Mobile / responsiveness

- Mobile-first CSS with breakpoints at 960 px (primary nav), 900 px (hero grid), and 720 px (content).
- Tables use `overflow-x: auto` wrappers for horizontal scroll on narrow screens.
- Navigation collapses to a hamburger menu below 960 px.
- Images use `max-width: 100%`.
- Font sizes scale fluidly via `clamp()`.

## SEO

- Every page has unique `<title>`, `<meta description>`, `<link rel="canonical">`, Open Graph and Twitter tags.
- `schema.org` JSON-LD (FinancialService) on the homepage; ContactPage on contact.html.
- `sitemap.xml` and `robots.txt` at the root.
- Semantic HTML5 landmarks: `<header>`, `<nav>`, `<main>` (via sections), `<footer>`.
- Heading hierarchy: one `<h1>` per page.

## Accessibility

- Colour contrast checked against WCAG AA on the default palette.
- Skip-to-content pattern available via focus styles.
- All interactive elements keyboard-reachable.
- Form inputs have associated `<label>` elements.
- ARIA roles on nav / regions where semantic HTML is insufficient.

## Regulatory compliance built-in

- Compliance ribbon on every page showing CoR number + CIN.
- RBI disclosure statement in the footer of every page.
- Dedicated Fair Practices Code, Grievance Redressal, Lending Partners, Collection Agencies and KFS pages.
- Cooling-off period, penal charge and APR treatment called out explicitly per RBI April-2023 / April-2024 circulars.

## Brand

Colours derived from the FinZ logo:

| Token            | Hex       | Usage                            |
|------------------|-----------|----------------------------------|
| `--navy`         | `#1A1B5E` | Primary dark, headings           |
| `--navy-dark`    | `#111248` | Footer background                |
| `--teal`         | `#14A9B0` | Primary accent, buttons, links   |
| `--teal-dark`    | `#0E878D` | Button hover                     |
| `--accent`       | `#F8B400` | Highlight pills                  |

To change the palette, edit the `:root` variables in `assets/css/main.css`.

## What's NOT in this site yet

Admin-controlled CMS capabilities (editing pages from a dashboard, user-facing loan application flow, live KFS generation). These are planned for a later phase per the original scope.

## Initialising the git repo

On a machine where your signing key is configured:

```bash
cd finz-website
git init -b main
git add -A
git commit -m "Initial commit: FinZ Finance marketing website"
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```
