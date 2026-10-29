"""Screenshot built pages with headless Chrome (dev QA only).

    python _src/tools/shoot.py OUT_DIR index.html [about.html ...] [--w 1440] [--mobile]

Serves the project root, scrolls each page to trigger reveal animations,
then saves full-page shots and prints any console errors.
"""
import http.server
import os
import sys
import threading
import time
from functools import partial
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    args = sys.argv[1:]
    out = args.pop(0)
    width = 1440
    mobile = "--mobile" in args
    if "--w" in args:
        i = args.index("--w"); width = int(args[i + 1]); del args[i:i + 2]
    args = [a for a in args if not a.startswith("--")]
    os.makedirs(out, exist_ok=True)
    srv = serve()
    port = srv.server_address[1]
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        ctx = b.new_context(viewport={"width": 390 if mobile else width, "height": 844 if mobile else 900},
                            device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
        for page_name in args:
            pg = ctx.new_page()
            errs = []
            pg.on("console", lambda m: m.type in ("error", "warning") and errs.append(m.text))
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"http://127.0.0.1:{port}/{page_name}", wait_until="networkidle")
            h = pg.evaluate("document.documentElement.scrollHeight")
            y = 0
            while y < h:
                pg.mouse.wheel(0, 500); y += 500; time.sleep(0.12)
                h = pg.evaluate("document.documentElement.scrollHeight")
            time.sleep(2.2)
            pg.evaluate("window.scrollTo(0, 0)"); time.sleep(1.2)
            tag = page_name.replace(".html", "") + ("-m" if mobile else f"-{width}")
            pg.screenshot(path=os.path.join(out, tag + ".png"), full_page=True)
            print(tag, "height", h, "errors:", errs or "none")
            pg.close()
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
