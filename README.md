# Lumigrid Energy website

Static, dependency-free site: HTML, one stylesheet and two scripts. Any static host will serve it (Netlify, Vercel, cPanel, S3).

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home: hero, about, marquee, bento stats, services, 3D "three ways", sector cards, project rail, stats, CTA banner, testimonial wheel, FAQ |
| `about.html` | Story, mission/vision/promise, values, Zimbabwe coverage map, process timeline |
| `services.html` | Six services, four products (3D), 24-hour energy chart, packages, process, FAQ |
| `projects.html` | Filterable gallery of real Lumigrid jobs with lightbox, coverage map |
| `savings.html` | Savings calculator with a 10-year cost chart and WhatsApp hand-off |
| `contact.html` | Quote form (sends via WhatsApp or email), contact cards, Google map |

## Editing and building

Edit the sources in `_src/`, not the root HTML files, then rebuild:

```
python _src/build.py
```

- `_src/pages/*.html` hold each page's body, with front matter for title, description and nav.
- `_src/partials/` holds the shared pieces: header, footer, FAQ, CTA banner, stats, testimonials, sectors, coverage map, icons.
- `{{> name}}` includes a partial.

Other tools:

- `python _src/tools/images.py` regenerates every WebP in `assets/img` from the source photos.
- `python _src/tools/render3d.py [names]` re-renders the 3D objects.
- `python _src/tools/shoot.py OUT index.html --mobile` takes QA screenshots. It needs Playwright and Chrome.
- `python _src/tools/qa.py` runs the launch checklist: console errors, failed requests, horizontal overflow at 1280 and 390, missing links and assets, CSS `url()`s, stretched images, hero fit at six viewport sizes, copy that wraps only on phones, long paragraphs, em dashes and stock words, rendering without JavaScript, and the mobile menu. `--quick` skips the copy and hero measurements.

## Design system (`assets/css/style.css`)

| Token | Value | Use |
|---|---|---|
| `--amber` | `#F0B030` | Brand amber, sampled from the logo sun. Primary buttons and accents |
| `--amber-3` | `#D6911A` | Serif italic accents, hover states |
| `--sky` | `#1098D8` | Brand sky blue, sampled from the logo panels |
| `--ink` / `--black` | `#111214` / `#0A0A0B` | Text, dark cards, footer |
| `--cream` | `#F8F4EC` | Page background (warm paper, as in the reference) |
| `--font` | Geist (self-hosted in `assets/fonts/`) | UI and headings |
| `--serif` | Caveat (handwritten) | Accent words ("Every Month") |
| `--ease` | `cubic-bezier(.22,.8,.2,1)` | All motion |

Chart series colours are amber `#B87A0E` and sky `#0B7BC0`. They passed the dataviz validator on white for lightness, chroma, colour-blind separation and 3:1 contrast. Keep charts on light cards.

### Motion

- `data-reveal`: fade and rise on scroll.
- `data-split`: word-by-word headline rise.
- `data-unveil`: a curtain lifts off a photo.
- `data-fill`: the statement text darkens word by word as you scroll.
- `data-parallax`: images drift on scroll.
- `data-count`: number counters.

Reveals run 700ms with 24px of travel and an 85ms word stagger, and every animation moves transforms or opacity only. All motion stops under `prefers-reduced-motion`.

If `main.js` fails to load, an inline failsafe removes the hidden pre-animation state on `load`, so content never stays invisible. Without JavaScript at all, every section renders in place.

### Patterns

One system in `style.css` (`.pat`) draws every pattern. A pattern (`--pm`) is intersected with a soft fade anchored to a corner, then painted in `currentColor` at low opacity. Add one with a span:

```html
<span class="pat pat--cells pat--tr" style="--pc:var(--amber);--pw:70%;--po:.2" aria-hidden="true"></span>
```

- Kinds: `cells` (solar panel), `hex` (battery cells), `rings` (orbit), `rays` (sun), `dots` (halftone), `waves` (water), `plus` (drafting grid).
- Anchors: `tr`, `tl`, `br`, `bl`, `c`.
- Variables: `--pc` colour, `--pw` width, `--po` opacity.

Each pattern matches what it sits on: cells on solar cards, honeycomb on storage, rings on monitoring and around the hero objects, waves on water, rays on featured and open items, halftone and rings in the footer.

### Hero carousel

The centre hero card rotates through three slides with their own designs: installs (photo, faces, count), live output (gauge and sparkline) and client rating. The progress bars are the timer. A bar's fill animation ends, and that advances the slide, so hovering or keyboard focus pauses both together. Phones swipe between slides.

### Grounds

Sections alternate between paper, a dark band with a faint grid (`.band--dark.tex-grid`, the process timeline) and an amber band with hatching (`.band--amber.tex-hatch`, the marquee). The stats sit on a dotted ground (`.tex-dots`).

## Icons

Icons are [Phosphor](https://phosphoricons.com) (`@phosphor-icons/core@2.1.1`), inlined as SVG partials in `_src/partials/i-*.html`, in three weights:

- **Duotone** for feature and service icons.
- **Regular** for UI controls: arrows, carets, close, plus, back to top.
- **Fill** for stars, the play button and social logos.

Swap one by replacing the SVG in its partial.

## 3D objects (`assets/img/3d/`)

These are ray-marched from signed distance functions in numpy (`_src/tools/render3d.py`), with studio lighting, Fresnel rims, ambient occlusion and premultiplied-alpha edges. The materials are amber metal, sky lacquer, pearl, graphite, solar cell and emissive amber.

| Object | Represents | Used on |
|---|---|---|
| `obj-panel` | Solar generation | Bento card, "Three ways", products, Services hero |
| `obj-battery` | Lithium storage | "Three ways", products, calculator, Contact hero |
| `obj-orb` | Grid and monitoring | "Three ways", Vision card, Savings hero |
| `obj-ring` | The logo's sun arc | Home about, About hero |
| `obj-ribbon` | Energy loop (inverter) | Products, Promise card |
| `obj-hex` | Protection cell | Products, Projects hero |

## Before launch: confirm with Lumigrid

Search the sources for `PLACEHOLDER` to find these.

1. **Stats.** Placeholder figures: 5+ years, 350+ systems, 1.2 MW, 80% savings. They appear in `_src/partials/stats.html` and in the hero card.
2. **Testimonials.** All six reviews, their stock faces, the hero rating slide and the 4.9 rating in `_src/partials/wheel.html` are placeholders. Replace them with real clients' words, with their permission.
3. **Email.** `info@lumigridenergy.co.zw` is assumed. Confirm the real address.
4. **Office hours** are assumed.
5. **Service towns** on the coverage map (`_src/partials/coverage.html`).
6. **Calculator pricing.** The constants at the top of `assets/js/charts.js` (`A = {...}`) are indicative. Set them to Lumigrid's current prices.
7. **Package contents** on Services (3, 5 and 10 kVA).

## Image licensing

- `assets/img/stock-<id>-*.webp` are **iStock comp images with visible watermarks**. License each one on iStock using the ID in the filename, then rerun `images.py` with the licensed files (same filenames).
- `assets/img/projects/job-*.webp` are Lumigrid's own installation photos, taken from their public tender-board profile.
- The remaining photos come from the client's folder without watermarks. Confirm usage rights for any that are not Lumigrid's own.
- `assets/img/faces/*.webp` are portraits from [Pexels](https://www.pexels.com) (free licence, no attribution required): photos 15929275, 1804452, 19355372, 12348737, 16047707 and 12672215. They stand in for clients on the placeholder testimonials. Replace them with real clients' photos, with consent, along with the quotes.
