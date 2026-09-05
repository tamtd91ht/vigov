# -*- coding: utf-8 -*-
"""Sinh bo logo 'ViGov Demo' — khac han logo that (nen hong #E91E8C) de tranh xung dot."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")

NAVY      = (27, 58, 92)      # #1B3A5C - headerColor cua app
NAVY_DARK = (18, 40, 65)      # #122841
AMBER     = (255, 176, 32)    # #FFB020 - bang DEMO
WHITE     = (255, 255, 255)

F_BLACK = r"C:\Windows\Fonts\seguibl.ttf"
F_BOLD  = r"C:\Windows\Fonts\segoeuib.ttf"

SS = 4  # he so ve phong to roi thu nho lai cho muot


def vgradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img.resize((w, h), Image.BILINEAR)


def tracked_text(draw, cx, cy, text, font, fill, tracking):
    """Ve chuoi can giua theo ca hai truc, co gian chu (tracking)."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    a = font.getbbox(text)
    x = cx - total / 2
    y = cy - (a[1] + a[3]) / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking


def rounded_mask(size, radius):
    m = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, size * SS - 1, size * SS - 1], radius=radius * SS, fill=255
    )
    return m.resize((size, size), Image.LANCZOS)


def make_icon(size=512):
    S = size * SS
    img = vgradient((S, S), NAVY, NAVY_DARK)
    d = ImageDraw.Draw(img)

    band_h = round(S * 0.255)
    band_y = S - band_h
    d.rectangle([0, band_y, S, S], fill=AMBER)

    # Monogram VG can giua vung con lai phia tren
    f_vg = ImageFont.truetype(F_BLACK, round(S * 0.40))
    tracked_text(d, S / 2, band_y * 0.50, "VG", f_vg, WHITE, S * 0.012)

    # Chu DEMO trong bang vang
    f_demo = ImageFont.truetype(F_BLACK, round(band_h * 0.50))
    tracked_text(d, S / 2, band_y + band_h / 2, "DEMO", f_demo, NAVY, S * 0.030)

    return img.resize((size, size), Image.LANCZOS)


def make_wordmark(w=1024, h=288):
    W, H = w * SS, h * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Khoi vuong bo goc chua VG
    box = round(H * 0.80)
    bx, by = round(H * 0.10), round(H * 0.10)
    d.rounded_rectangle([bx, by, bx + box, by + box], radius=round(box * 0.22), fill=NAVY)
    f_vg = ImageFont.truetype(F_BLACK, round(box * 0.46))
    tracked_text(d, bx + box / 2, by + box / 2, "VG", f_vg, WHITE, box * 0.02)

    # Chu "ViGov" + the "DEMO"
    x = bx + box + round(H * 0.20)
    f_name = ImageFont.truetype(F_BLACK, round(H * 0.42))
    a = f_name.getbbox("ViGov")
    d.text((x, H / 2 - (a[1] + a[3]) / 2), "ViGov", font=f_name, fill=NAVY)
    x += d.textlength("ViGov", font=f_name) + round(H * 0.14)

    f_tag = ImageFont.truetype(F_BLACK, round(H * 0.26))
    tag_w = d.textlength("DEMO", font=f_tag) + round(H * 0.32)
    tag_h = round(H * 0.44)
    d.rounded_rectangle(
        [x, H / 2 - tag_h / 2, x + tag_w, H / 2 + tag_h / 2],
        radius=round(tag_h * 0.28), fill=AMBER,
    )
    tracked_text(d, x + tag_w / 2, H / 2, "DEMO", f_tag, NAVY, H * 0.03)

    return img.resize((w, h), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)

icon = make_icon(512)
icon.save(os.path.join(OUT, "icon-demo-512.png"))

rounded = icon.convert("RGBA")
rounded.putalpha(rounded_mask(512, round(512 * 0.22)))
rounded.save(os.path.join(OUT, "icon-demo-512-bo-goc.png"))

make_icon(1024).save(os.path.join(OUT, "icon-demo-1024.png"))
make_wordmark().save(os.path.join(OUT, "logo-demo-wordmark.png"))

for n in ("icon-demo-512.png", "icon-demo-512-bo-goc.png", "icon-demo-1024.png", "logo-demo-wordmark.png"):
    p = os.path.join(OUT, n)
    print(n, Image.open(p).size, os.path.getsize(p), "bytes")
