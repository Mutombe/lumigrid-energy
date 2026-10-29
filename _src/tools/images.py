"""Convert source photos into web-ready WebP files in assets/img.

    python _src/tools/images.py

Files named stock-<istock id>-*.webp come from iStock comps (watermarked).
Replace them with the licensed downloads, keeping the same filename.
"""
import os
from PIL import Image, ImageOps

DL = r"C:\Users\PC\Downloads\lumigrid"
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "assets", "img")
JOBS = os.path.join(ROOT, "_src", "jobs")

PHOTOS = {
    # source file                                         -> output name, max width
    "a690ab84-4d48-41d8-84ca-a9675dda0f43.jpg":              ("hero-harare", 2400),
    "1-1.png":                                               ("install-commercial-roof", 900),
    "2-1.png":                                               ("install-roof-tech", 900),
    "Untitled-711-x-450-px-4.png":                           ("install-tile-roof", 900),
    "6a5ab63d619cea6270943999_Property Developer Finance jpg.jpg": ("new-builds", 1600),
    "SNAP_NEW_LANDING_PAGE_BANNER_MAR2018.jpg":              ("harare-suburbs", 1920),
    "electric-farm-with-panels-producing-clean-ecologic-energy-1024x683.jpg": ("solar-farm-fence", 1024),
    "image-up.png":                                          ("mounting-drill", 600),
    "istockphoto-1302659815-612x612.jpg":                    ("harare-city", 612),
    "solar-power-field-1024x701.jpg":                        ("solar-field-green", 1024),
    "vTgfLwZ.jpeg":                                          ("home-hillside", 1800),
    "istockphoto-1130758764-2048x2048.jpg": ("stock-1130758764-farm-inverters", 1600),
    "istockphoto-1197590704-2048x2048.jpg": ("stock-1197590704-inverter-room", 1400),
    "istockphoto-1362872948-2048x2048.jpg": ("stock-1362872948-home-panels", 1600),
    "istockphoto-1402475274-2048x2048.jpg": ("stock-1402475274-panels-crops", 1600),
    "istockphoto-1448607390-2048x2048.jpg": ("stock-1448607390-roof-technician", 1600),
    "istockphoto-1462151309-2048x2048.jpg": ("stock-1462151309-hands-seedling", 1400),
    "istockphoto-1463617670-2048x2048.jpg": ("stock-1463617670-engineers-sunset", 1600),
    "istockphoto-1490061322-2048x2048.jpg": ("stock-1490061322-hybrid-inverter", 1400),
    "istockphoto-1620576275-2048x2048.jpg": ("stock-1620576275-wall-batteries", 1600),
    "istockphoto-1676495583-2048x2048.jpg": ("stock-1676495583-agrivoltaic", 1600),
    "istockphoto-1718847029-2048x2048.jpg": ("stock-1718847029-agri-rows", 1600),
    "istockphoto-1742670724-2048x2048.jpg": ("stock-1742670724-inverter-battery", 1400),
    "istockphoto-2045558460-2048x2048.jpg": ("stock-2045558460-seedling", 1400),
    "istockphoto-2160078175-2048x2048.jpg": ("stock-2160078175-farmers", 1600),
    "istockphoto-2162813543-2048x2048.jpg": ("stock-2162813543-trackers", 1400),
    "istockphoto-2172501561-2048x2048.jpg": ("stock-2172501561-bess-yard", 1600),
    "istockphoto-2199726093-2048x2048.jpg": ("stock-2199726093-green-building", 1400),
    "istockphoto-2209090636-2048x2048.jpg": ("stock-2209090636-panel-carry", 1800),
    "istockphoto-2211089749-2048x2048.jpg": ("stock-2211089749-home-battery", 1400),
    "istockphoto-2222813649-2048x2048.jpg": ("stock-2222813649-panels-trees", 1600),
    "istockphoto-2231745593-2048x2048.jpg": ("stock-2231745593-panels-sky", 1600),
    "istockphoto-2246916593-2048x2048.jpg": ("stock-2246916593-sunset-farm", 2200),
    "istockphoto-2254411341-2048x2048.jpg": ("stock-2254411341-roof-golden", 1600),
    "istockphoto-2260659216-2048x2048.jpg": ("stock-2260659216-sun-sky", 1800),
    "istockphoto-2269681156-2048x2048.jpg": ("stock-2269681156-green-map", 1400),
    "istockphoto-2271995989-2048x2048.jpg": ("stock-2271995989-battery-cabinet", 1400),
    "istockphoto-2286461738-2048x2048.jpg": ("stock-2286461738-technician-panels", 1600),
    "istockphoto-2294102962-2048x2048.jpg": ("stock-2294102962-battery-rack", 1400),
    "istockphoto-909265570-2048x2048.jpg":  ("stock-909265570-string-inverters", 1400),
}


def save(im, name, maxw, q=80):
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    path = os.path.join(OUT, name + ".webp")
    im.save(path, "WEBP", quality=q, method=6)
    print(f"{name:45s} {im.size}  {os.path.getsize(path)//1024} KB")


def main():
    os.makedirs(os.path.join(OUT, "projects"), exist_ok=True)
    for src, (name, w) in PHOTOS.items():
        save(Image.open(os.path.join(DL, src)), name, w)
    for i, f in enumerate(sorted(os.listdir(JOBS)), 1):
        save(Image.open(os.path.join(JOBS, f)), f"projects/job-{i:02d}", 1000, 82)

    # logo: trim transparent margins
    logo = Image.open(os.path.join(DL, "2a9cca44-41a4-4d8e-b4d7-8cdcd59e2991_removalai_preview.png")).convert("RGBA")
    logo = logo.crop(logo.getbbox())
    logo.save(os.path.join(OUT, "logo.png"))
    mark = logo.crop((0, 0, logo.width, int(logo.height * 0.66)))
    mark = mark.crop(mark.getbbox())
    mark.save(os.path.join(OUT, "logo-mark.png"))
    print("logo", logo.size, "mark", mark.size)


if __name__ == "__main__":
    main()
