"""Launch checklist, proven rather than assumed.

    python _src/tools/qa.py            # full report
    python _src/tools/qa.py --quick    # skip hero sizes and copy measurement

Checks: console errors, failed requests, horizontal overflow (1280 and 390),
internal links and assets, CSS url()s, stretched images, hero fit at six
viewports, copy that wraps on mobile only, long mobile paragraphs, banned
characters and words, no-JS rendering, and the mobile menu.
"""
import os
import re
import sys
import time
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(__file__))
from shoot import serve  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PAGES = ["index.html", "about.html", "services.html", "projects.html", "savings.html", "contact.html"]
BANNED_WORDS = ["seamless", "robust", "leverage", "elevate", "unlock", "bespoke", "cutting edge", "cutting-edge",
                "comprehensive", "tailored", "holistic", "not just", "world-class", "state-of-the-art", "game-changer"]
HERO_SIZES = [(1440, 900), (1366, 768), (1280, 720), (1280, 640), (1440, 1080), (390, 844)]
QUICK = "--quick" in sys.argv
fails = []


def fail(msg):
    fails.append(msg)
    print("  FAIL", msg)


class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ("href", "src") and v and not re.match(r"(https?:|mailto:|tel:|#|data:)", v):
                self.refs.append(v.split("#")[0].split("?")[0])


def static_checks():
    print("== static")
    for p in PAGES:
        html = open(os.path.join(ROOT, p), encoding="utf8").read()
        r = Refs(); r.feed(html)
        for ref in set(r.refs):
            if ref and not os.path.exists(os.path.join(ROOT, ref)):
                fail(f"{p}: missing {ref}")
        text = re.sub(r"<(script|style)[^>]*>.*?</\1>|<[^>]+>", " ", html, flags=re.S)
        for ch, name in (("—", "em dash"),):
            if ch in text:
                fail(f"{p}: {text.count(ch)} {name}")
        low = text.lower()
        for w in BANNED_WORDS:
            if w in low:
                fail(f"{p}: banned word '{w}'")
    css = open(os.path.join(ROOT, "assets/css/style.css"), encoding="utf8").read()
    for u in re.findall(r"url\(['\"]?([^)'\"]+)", css):
        if not u.startswith(("data:", "#", "http")) and not os.path.exists(os.path.join(ROOT, "assets/css", u)):
            fail(f"css url missing {u}")


SCROLL_ALL = """async () => { let max = 0; for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); max = Math.max(max, scrollY); } scrollTo(0, 0); return max; }"""

LINES = """() => {
  const out = {};
  document.querySelectorAll('main p, main li, main h3, main h4, main .btn, main .tag, main .chip, main figcaption b, main dt, main dd, main label, main .stat__l').forEach((el, i) => {
    if (el.closest('[aria-hidden="true"], .marquee, .chart, .qcard[aria-hidden="true"]')) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const inner = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const key = el.tagName + ':' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
    out[key] = Math.max(1, Math.round(inner / lh));
  });
  return out;
}"""


def browser_checks():
    srv = serve(); port = srv.server_address[1]
    base = f"http://127.0.0.1:{port}/"
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        print("== runtime")
        lines = {}
        for w, mob in ((1280, False), (390, True)):
            ctx = b.new_context(viewport={"width": w, "height": 844 if mob else 800}, is_mobile=mob, has_touch=mob)
            for pg_name in PAGES:
                pg = ctx.new_page()
                errs, bad = [], []
                pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("requestfailed", lambda r: "google.com/maps" not in r.url and bad.append(r.url))
                pg.on("response", lambda r: r.status >= 400 and bad.append(f"{r.status} {r.url}"))
                pg.goto(base + pg_name, wait_until="networkidle")
                pg.mouse.move(w / 2, 300)
                for _ in range(80):
                    pg.mouse.wheel(0, 500); pg.wait_for_timeout(60)
                    if pg.evaluate("scrollY + innerHeight >= document.documentElement.scrollHeight - 2"): break
                reached = pg.evaluate("scrollY"); pg.wait_for_timeout(800)
                if errs: fail(f"{pg_name}@{w}: console {errs[:2]}")
                if bad: fail(f"{pg_name}@{w}: requests {bad[:2]}")
                sw = pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
                if sw[0] > sw[1]: fail(f"{pg_name}@{w}: overflow {sw}")
                stretched = pg.evaluate("""() => [...document.images].filter(i => i.naturalWidth && i.getBoundingClientRect().width > 2 && getComputedStyle(i).objectFit === 'fill')
                  .filter(i => { const r = i.getBoundingClientRect(); return Math.abs(r.width / r.height - i.naturalWidth / i.naturalHeight) > 0.03; }).map(i => i.src.split('/').pop())""")
                if stretched: fail(f"{pg_name}@{w}: stretched {stretched}")
                hidden = pg.evaluate("[...document.querySelectorAll('[data-reveal]:not(.is-in), [data-unveil]:not(.is-in)')].map(e => e.className.split(' ')[0] + '@' + Math.round(e.getBoundingClientRect().top + scrollY))")
                if hidden: fail(f"{pg_name}@{w}: {len(hidden)} never revealed {hidden[:4]} js={pg.evaluate('[document.documentElement.className, window.__lgReady, document.body.scrollHeight]')} reached={reached}")
                if not QUICK:
                    lines[(pg_name, w)] = pg.evaluate(LINES)
                pg.close()
            ctx.close()

        if not QUICK:
            print("== copy fit")
            for pg_name in PAGES:
                d, m = lines[(pg_name, 1280)], lines[(pg_name, 390)]
                for k, n in m.items():
                    if k.startswith(("H3", "H4")) and False:
                        continue
                    if k in d and d[k] == 1 and n >= 2 and not k.startswith(("P:", "LI:")) or (k in d and d[k] == 1 and n >= 2 and len(k) < 60):
                        fail(f"{pg_name}: wraps on mobile only ({n} lines) {k}")
                    if k.startswith("P:") and n > 4:
                        fail(f"{pg_name}: {n} lines at 390 {k}")

            print("== hero fit")
            for w, h in HERO_SIZES:
                ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=w < 500, has_touch=w < 500)
                pg = ctx.new_page(); pg.goto(base + "index.html", wait_until="networkidle"); time.sleep(.4)
                bottom = pg.evaluate("""() => { const els = [...document.querySelectorAll('.hero__cards > *')].filter(e => getComputedStyle(e).display !== 'none'); return Math.max(...els.map(e => e.getBoundingClientRect().bottom)); }""")
                ok = bottom <= h
                print(f"  {w}x{h}: hero bottom {bottom:.0f} {'ok' if ok else ''}")
                if not ok: fail(f"hero overflows at {w}x{h} ({bottom:.0f} > {h})")
                ctx.close()

        print("== no-JS")
        ctx = b.new_context(java_script_enabled=False, viewport={"width": 1280, "height": 800})
        for pg_name in PAGES:
            pg = ctx.new_page(); pg.goto(base + pg_name, wait_until="load")
            hidden = pg.evaluate("[...document.querySelectorAll('[data-reveal],[data-split],[data-unveil]')].filter(e => getComputedStyle(e).opacity === '0').length")
            if hidden: fail(f"{pg_name}: {hidden} elements hidden without JS")
            pg.close()
        ctx.close()

        print("== mobile menu")
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.goto(base + "index.html", wait_until="networkidle")
        pg.click("[data-menu-toggle]"); time.sleep(.9)
        st = pg.evaluate("[document.querySelector('[data-menu]').classList.contains('is-open'), getComputedStyle(document.body).overflow]")
        if not (st[0] and st[1] == "hidden"): fail(f"menu open/lock failed {st}")
        pg.keyboard.press("Escape"); time.sleep(.9)
        st = pg.evaluate("[document.querySelector('[data-menu]').hidden, getComputedStyle(document.body).overflow]")
        if not (st[0] and st[1] != "hidden"): fail(f"menu close failed {st}")
        ctx.close()
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    static_checks()
    browser_checks()
    print(f"\n{len(fails)} failure(s)")
