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

## Deployment

1. **Any static host works**: Cloudflare Pages, Netlify, Vercel, GitHub Pages, Nginx/Apache, S3+CloudFront.
2. Map the domain `finz.finance` to the hosting provider.
3. The current production site (a React Native Expo app deployed via `vercel.json`) is unrelated to this website. If the apex (`https://finz.finance`) is currently serving the Expo build, you'll need to split routing — e.g. keep the marketing site on the apex and move the app to `app.finz.finance` (or vice versa). See TODO.md for routing recommendations.

### Quick local preview

```bash
cd website
python3 -m http.server 8080
# open http://localhost:8080
```

or:

```bash
npx serve .
```

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

## How to move this folder into its own git repo (later)

When you want a clean separate GitHub repository (e.g. `finzfintech/finz-website`), from the **app repo root**:

```bash
git subtree split --prefix=website -b website-only
# then push the new branch to the fresh repo:
git remote add website git@github.com:finzfintech/finz-website.git
git push website website-only:main
```

History is preserved. The app repo keeps its own history untouched.
