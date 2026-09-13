"""Hi-bit proof: the coin and gem re-authored at 32px native with directional
lighting, a 6-step hue-shifted ramp, a rim-light pass and selout, rendered beside
the current 16px sprites so the STS2-leaning direction is visible instead of
described. Native art, integer-scaled; the painterly read comes from resolution +
value grouping, not from a blur the grid can't hold."""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISPLAY = 256  # every cell shown at 256px so 16px (x16) and 32px (x8) compare fair

INK = "#14120f"
GOLD = ["#3d2408", "#6b3f12", "#a06322", "#d1972f", "#f0c552", "#fff0b0"]
GOLD_RIM = "#fffbe0"
CYAN = ["#0c2f4a", "#164e73", "#2378a3", "#3aa0cf", "#79cdee", "#cbf1ff"]


def rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def coin32():
    """Domed medallion: darkest disc first, each lighter ramp step a smaller
    ellipse biased top-left, so the value bands stack into directional relief."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([2, 2, 29, 29], fill=rgb(INK))
    bands = [([3, 3, 28, 28], GOLD[0]), ([3, 3, 26, 26], GOLD[1]),
             ([3, 3, 24, 24], GOLD[2]), ([4, 4, 22, 22], GOLD[3]),
             ([5, 5, 19, 19], GOLD[4]), ([6, 6, 15, 15], GOLD[5])]
    for box, c in bands:
        d.ellipse(box, fill=rgb(c))
    d.ellipse([9, 9, 23, 23], outline=rgb(GOLD[1]), width=1)  # incised rim relief
    d.arc([3, 3, 28, 28], start=130, end=255, fill=rgb(GOLD_RIM), width=1)  # rim light
    return img


def gem32():
    """Brilliant cut: facets as flat polygons, brightest top-left, darkest
    bottom-right, one spec cluster and a rim-light edge on the lit side."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(16, 4), (28, 14), (16, 30), (4, 14)], fill=rgb(INK))
    facets = [
        ([(16, 5), (23, 13), (16, 17), (9, 13)], CYAN[4]),   # table, faces up
        ([(16, 5), (9, 13), (5, 14)], CYAN[5]),              # upper-left crown, lit
        ([(16, 5), (23, 13), (27, 14)], CYAN[3]),            # upper-right crown
        ([(5, 14), (9, 13), (16, 17), (16, 29)], CYAN[2]),   # lower-left pavilion
        ([(27, 14), (23, 13), (16, 17), (16, 29)], CYAN[1]),  # lower-right, shadow
    ]
    for pts, c in facets:
        d.polygon(pts, fill=rgb(c))
    d.line([(9, 13), (23, 13)], fill=rgb(CYAN[0]), width=1)  # girdle
    d.line([(16, 4), (5, 14)], fill=rgb(CYAN[5]), width=1)   # rim light, lit edge
    for x in (12, 13):  # spec cluster on the table
        for y in (8, 9):
            img.putpixel((x, y), rgb(CYAN[5]))
    return img


def before(name):
    return Image.open(os.path.join(ROOT, "design", "sprites", name + ".png")
                      ).convert("RGBA").resize((DISPLAY, DISPLAY), Image.NEAREST)


def main():
    cells = [
        ("coin  now (16px)", before("numismatist")),
        ("gem  now (16px)", before("jeweler")),
        ("coin  hi-bit (32px)", coin32().resize((DISPLAY, DISPLAY), Image.NEAREST)),
        ("gem  hi-bit (32px)", gem32().resize((DISPLAY, DISPLAY), Image.NEAREST)),
    ]
    margin, gap, label_h = 24, 24, 26
    cols = 2
    w = margin * 2 + cols * DISPLAY + gap
    h = margin * 2 + 2 * (DISPLAY + label_h) + gap
    sheet = Image.new("RGBA", (w, h), rgb("#2b2822"))
    draw = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(cells):
        col, row = i % cols, i // cols
        x = margin + col * (DISPLAY + gap)
        y = margin + row * (DISPLAY + label_h + gap)
        draw.text((x + 2, y), label, fill=rgb("#f4f1ea"))
        sheet.alpha_composite(im, (x, y + label_h))
    out = os.path.join(ROOT, "design", "hibit-proof.png")
    sheet.convert("RGB").save(out)
    print(out)


if __name__ == "__main__":
    main()
