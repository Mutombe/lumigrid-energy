"""Assemble the static site.

    python _src/build.py

Each page in _src/pages/*.html starts with a front-matter block:

    ---
    title: About Lumigrid Energy
    description: One sentence for search engines.
    nav: about
    ---

The body is wrapped in _src/partials/layout.html. Inside any page or partial,
{{> name}} inserts _src/partials/name.html (or name.svg), and {{key}} inserts a
front-matter value. Output is written to the project root.
"""
import os
import re

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
PARTIALS = os.path.join(SRC, "partials")
PAGES = os.path.join(SRC, "pages")

NAV = [
    ("index", "index.html", "Home"),
    ("about", "about.html", "About"),
    ("services", "services.html", "Services"),
    ("projects", "projects.html", "Projects"),
    ("savings", "savings.html", "Savings"),
    ("contact", "contact.html", "Contact"),
]


def partial(name):
    for ext in (".html", ".svg"):
        path = os.path.join(PARTIALS, name + ext)
        if os.path.exists(path):
            return open(path, encoding="utf8").read()
    raise FileNotFoundError(name)


def render(text, ctx, depth=0):
    if depth > 6:
        raise RecursionError("partials nested too deeply")
    text = re.sub(r"\{\{>\s*([\w-]+)\s*\}\}", lambda m: render(partial(m.group(1)), ctx, depth + 1), text)
    return re.sub(r"\{\{\s*([\w-]+)\s*\}\}", lambda m: str(ctx.get(m.group(1), m.group(0))), text)


def nav_links(active, cls):
    out = []
    for key, href, label in NAV:
        cur = ' aria-current="page"' if key == active else ""
        out.append(f'<a class="{cls}" href="{href}"{cur}>{label}</a>')
    return "\n".join(out)


def main():
    layout = partial("layout")
    for fname in sorted(os.listdir(PAGES)):
        raw = open(os.path.join(PAGES, fname), encoding="utf8").read()
        m = re.match(r"---\n(.*?)\n---\n", raw, re.S)
        ctx = dict(line.split(": ", 1) for line in m.group(1).splitlines())
        ctx.setdefault("body_class", "")
        ctx.setdefault("scripts", "")
        ctx["nav_links"] = nav_links(ctx.get("nav"), "nav__link")
        ctx["menu_links"] = nav_links(ctx.get("nav"), "menu__link")
        ctx["body"] = raw[m.end():]
        html = render(layout, ctx)
        html = render(html, ctx)  # second pass for tokens inside the body
        with open(os.path.join(ROOT, fname), "w", encoding="utf8", newline="\n") as f:
            f.write(html)
        print("built", fname)


if __name__ == "__main__":
    main()
