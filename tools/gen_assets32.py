"""Hi-bit port of the relic set: every primitive re-authored at 32px native with
directional lighting, a 6-step hue-shifted ramp per material, selout (the outline
takes the ramp's darkest hued tone, never flat black) and a rim-light pass. Colour
still carries identity, rarity is the bottom pip count. Roster + shape + material
map are read from gen_assets so this can't drift from the game.

Duplication was the real problem: the money archetype rendered nine identical
coins. OBJECTS gives each of those relics its own silhouette (stack, bag, crown,
vault, ledger, banknote, nuggets, ingot) with the gold ramp as the only shared
thread, so a player reads nine distinct objects. OBJECTS wins over the shared
shape map. All 46 relics are authored at 32px; each has its own silhouette,
grouped only by material palette family."""

import math
import os
from PIL import Image, ImageDraw

from gen_assets import read_roster, SHAPE, MATERIAL

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAT = 32
SCALE = 5  # 32 -> 160px cells on the sheet
CELL = NAT * SCALE

STEPS = 6
SHADOW_HUE, LIGHT_HUE = 300, 100   # shadows lean purple, highlights lean yellow
MAX_SHIFT = 25                     # degrees of hue travel at each ramp end
END_CHROMA = 0.55                  # chroma kept at the ramp ends, full at mid


def oklch_hex(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    lin = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)

    def gam(v):
        v = min(max(v, 0.0), 1.0)
        return 1.055 * v ** (1 / 2.4) - 0.055 if v > 0.0031308 else 12.92 * v
    return "#%02x%02x%02x" % tuple(round(gam(v) * 255) for v in lin)


def hue_delta(src, dst):
    d = (dst - src + 180) % 360 - 180
    return max(-MAX_SHIFT, min(MAX_SHIFT, d))


def ramp(hue, chroma, l_lo, l_hi):
    """Equal-L steps in OKLCH so every material climbs at the same perceived rate;
    hue bends toward purple below mid and toward yellow above it."""
    sd, sl = hue_delta(hue, SHADOW_HUE), hue_delta(hue, LIGHT_HUE)
    out = []
    for i in range(STEPS):
        t = i / (STEPS - 1)
        h = hue + sd * max(0.0, 1 - 2 * t) + sl * max(0.0, 2 * t - 1)
        c = chroma * (END_CHROMA + (1 - END_CHROMA) * (1 - abs(2 * t - 1)))
        out.append(oklch_hex(l_lo + (l_hi - l_lo) * t, c, h))
    return out


# (hue, chroma, L dark, L light) per material family.
MAT6 = {k: ramp(*v) for k, v in {
    "gold": (85, 0.16, 0.28, 0.96),
    "cyan": (225, 0.13, 0.28, 0.95),
    "stone": (80, 0.05, 0.28, 0.88),
    "book": (30, 0.14, 0.26, 0.86),
    "pink": (345, 0.17, 0.28, 0.92),
    "red": (27, 0.20, 0.26, 0.88),
    "teal": (185, 0.12, 0.28, 0.92),
    "blue": (260, 0.15, 0.28, 0.90),
    "bone": (90, 0.05, 0.45, 0.96),
    "silver": (250, 0.02, 0.30, 0.93),
    "brass": (85, 0.13, 0.28, 0.92),
    "leather": (60, 0.09, 0.26, 0.82),
    "chalk": (85, 0.02, 0.45, 0.97),
}.items()}
PAGE = "#e6dcc0"
PAGE_SHADE = "#cfc4a4"
PIP = {"common": (1, "#b9c9dc"), "uncommon": (2, "#7ad17f"),
       "rare": (3, "#b7a4ff"), "legendary": (4, "#f4d67a")}


def H(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def canvas():
    img = Image.new("RGBA", (NAT, NAT), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def coin(r):
    img, d = canvas()
    d.ellipse([5, 2, 27, 24], fill=H(r[0]))
    for box, c in [([6, 3, 26, 23], r[1]), ([6, 3, 24, 21], r[2]),
                   ([7, 4, 22, 19], r[3]), ([8, 5, 19, 16], r[4]),
                   ([9, 5, 15, 12], r[5])]:
        d.ellipse(box, fill=H(c))
    d.ellipse([10, 7, 22, 19], outline=H(r[1]), width=1)
    d.arc([6, 3, 26, 23], start=130, end=255, fill=H(r[5]), width=1)
    return img


def gem(r):
    img, d = canvas()
    # Side-view brilliant cut, drawn per row so every facet edge steps at a
    # fixed 1:1 or 1:2 rhythm: flat table, 1:1 crown, 1:1 pavilion to a 2px tip.
    d.polygon([(9, 3), (22, 3), (29, 10), (16, 23), (15, 23), (2, 10)], fill=H(r[0]))
    d.rectangle([10, 4, 21, 4], fill=H(r[5]))
    d.rectangle([9, 5, 22, 5], fill=H(r[5]))
    for y in range(6, 11):
        d.line([(13 - y, y), (15 - y, y)], fill=H(r[4]))
        d.line([(16 - y, y), (15 + y, y)], fill=H(r[3]))
        d.line([(16 + y, y), (18 + y, y)], fill=H(r[1]))
    for y in range(11, 23):
        step = (y - 11) // 2
        if y - 7 <= 9 + step:
            d.line([(y - 7, y), (9 + step, y)], fill=H(r[2]))
            d.line([(22 - step, y), (38 - y, y)], fill=H(r[2]))
        d.line([(10 + step, y), (21 - step, y)], fill=H(r[1]))
    return img


def brick(r):
    img, d = canvas()
    d.rectangle([3, 5, 28, 24], fill=H(r[0]))
    d.rectangle([4, 6, 27, 23], fill=H(r[1]))
    for x0, y0, x1, y1 in [(4, 6, 14, 13), (16, 6, 27, 13),
                           (4, 15, 19, 23), (21, 15, 27, 23)]:
        d.rectangle([x0, y0, x1, y1], fill=H(r[3]))
        d.line([(x0, y0), (x1, y0)], fill=H(r[4]), width=1)
    return img


def book(r):
    img, d = canvas()
    d.rectangle([5, 4, 26, 25], fill=H(r[0]))
    d.rectangle([6, 5, 25, 24], fill=H(r[2]))
    d.rectangle([6, 5, 9, 24], fill=H(r[1]))          # spine
    d.rectangle([22, 6, 24, 23], fill=H(PAGE))        # page edge
    for y in range(7, 23, 2):
        d.line([(22, y), (24, y)], fill=H(r[1]), width=1)
    d.rectangle([12, 9, 20, 13], fill=H(r[4]))        # title plate
    d.line([(7, 6), (24, 6)], fill=H(r[5]), width=1)  # rim light
    return img


def note(r):
    img, d = canvas()
    d.rectangle([18, 5, 20, 21], fill=H(r[0]))
    d.rectangle([18, 5, 19, 21], fill=H(r[3]))
    d.polygon([(20, 5), (27, 11), (26, 17), (20, 14)], fill=H(r[0]))
    d.polygon([(20, 6), (25, 11), (24, 15), (20, 13)], fill=H(r[3]))
    d.ellipse([7, 17, 21, 27], fill=H(r[0]))
    d.ellipse([8, 18, 20, 26], fill=H(r[2]))
    d.ellipse([10, 19, 15, 23], fill=H(r[4]))
    img.putpixel((11, 20), H(r[5]))
    d.line([(18, 6), (18, 20)], fill=H(r[5]), width=1)
    return img


def flask(r):
    img, d = canvas()
    d.ellipse([6, 12, 26, 26], fill=H(r[0]))
    d.ellipse([7, 13, 25, 25], fill=H(r[2]))
    d.ellipse([8, 17, 24, 24], fill=H(r[3]))          # liquid
    d.line([(9, 20), (23, 20)], fill=H(r[4]), width=1)  # meniscus
    d.rectangle([13, 3, 19, 14], fill=H(r[0]))
    d.rectangle([14, 4, 18, 13], fill=H(r[2]))
    d.rectangle([12, 3, 20, 5], fill=H(r[1]))         # lip
    d.rectangle([12, 3, 20, 4], fill=H(r[4]))
    d.line([(10, 16), (10, 23)], fill=H(r[5]), width=1)  # shine
    return img


def crucible_cup(r):
    # crucible: the vessel itself. Wide overhanging lip, conical thick-walled
    # ceramic body tapering to a narrow base, throwing ridges on the wall,
    # strong left-lit cylinder bands; one calm gold surface row at the mouth.
    img, _ = canvas()
    st, g = MAT6["stone"], MAT6["gold"]
    lip = {(x, y) for y in (6, 7) for x in range(7, 26)}
    lip |= {(x, 8) for x in range(8, 25)}
    wall = {(x, y) for y, hw in
            {9: 7, 10: 7, 11: 7, 12: 6, 13: 6, 14: 6, 15: 6, 16: 5,
             17: 5, 18: 5, 19: 4, 20: 4, 21: 4, 22: 4, 23: 3, 24: 3}.items()
            for x in range(16 - hw, 16 + hw + 1)}
    cup = lip | wall
    for x, y in cup:
        t = 1 if y >= 23 else 3 if x <= 11 else 1 if x >= 20 else 2
        img.putpixel((x, y), H(st[t]))
    for x in range(8, 25):
        img.putpixel((x, 7), H(st[4]))
    for y in range(10, 21):
        if (10, y) in wall and (9, y) in wall:
            img.putpixel((10, y), H(st[4]))
    for y, hw in ((13, 6), (18, 5)):
        for x in range(17 - hw, 16 + hw):
            img.putpixel((x, y), H(st[1]))
    for x, y in contour(cup):
        img.putpixel((x, y), H(st[0]))
    for x in range(11, 22):
        img.putpixel((x, 9), H(g[4]))
    for x in (12, 13):
        img.putpixel((x, 9), H(g[5]))
    return img


def drop(r):
    img, d = canvas()
    d.polygon([(16, 3), (24, 16), (8, 16)], fill=H(r[0]))
    d.ellipse([7, 12, 25, 26], fill=H(r[0]))
    d.polygon([(16, 5), (22, 16), (10, 16)], fill=H(r[2]))
    d.ellipse([8, 13, 24, 25], fill=H(r[2]))
    d.ellipse([13, 17, 23, 24], fill=H(r[1]))         # shade lobe
    d.ellipse([10, 14, 16, 21], fill=H(r[4]))         # highlight
    img.putpixel((12, 16), H(r[5]))
    d.line([(11, 13), (9, 16)], fill=H(r[5]), width=1)
    return img


def dice(r):
    img, d = canvas()
    d.rounded_rectangle([5, 4, 26, 25], radius=4, fill=H(r[0]))
    d.rounded_rectangle([6, 5, 25, 24], radius=4, fill=H(r[3]))
    d.rounded_rectangle([6, 5, 25, 9], radius=3, fill=H(r[4]))
    d.rectangle([24, 7, 25, 24], fill=H(r[1]))
    d.rectangle([7, 23, 25, 24], fill=H(r[2]))
    for cx, cy in [(11, 10), (20, 10), (15, 15), (11, 20), (20, 20)]:
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=H(r[0]))
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=H(r[1]))
    d.line([(7, 6), (24, 6)], fill=H(r[5]), width=1)
    return img


# Per-relic objects: the money archetype was 9 identical coins. Each gets its own
# silhouette, gold ramp the only shared thread, so players can tell them apart.
def coin_stack(r):
    img, d = canvas()
    for cy in (21, 15, 9):
        d.ellipse([7, cy - 4, 25, cy + 4], fill=H(r[0]))
        d.ellipse([8, cy - 3, 24, cy + 3], fill=H(r[2]))
        d.ellipse([9, cy - 3, 23, cy + 1], fill=H(r[3]))
    d.ellipse([9, 4, 23, 10], fill=H(r[4]))
    d.arc([8, 5, 24, 11], start=180, end=360, fill=H(r[5]), width=1)
    return img


def money_bag(r):
    # merchant: red cloth drawstring pouch so it separates from the gold
    # icons at a glance. Gold shows only as the accents: tie band under the
    # ruffled mouth and a small ringed coin emblem on the belly.
    img, _ = canvas()
    rd = MAT6["red"]
    mouth = {(x, 4) for x in (12, 13, 15, 16, 18, 19)}
    mouth |= {(x, y) for y, (a, b) in
              {5: (11, 20), 6: (12, 19)}.items() for x in range(a, b + 1)}
    neck = {(x, y) for y in (7, 8) for x in range(13, 19)}
    belly = {9: 4, 10: 6, 11: 7, 12: 8, 13: 8, 14: 9, 15: 9, 16: 9, 17: 9,
             18: 9, 19: 9, 20: 8, 21: 8, 22: 7, 23: 6, 24: 5}
    body = {(x, y) for y, hw in belly.items()
            for x in range(16 - hw, 16 + hw + 1)}
    bag = mouth | neck | body
    for x, y in bag:
        s = (x - 16) + (y - 15)
        t = 4 if s <= -6 else 2 if s >= 7 else 3
        img.putpixel((x, y), H(rd[t]))
    for x, y in ((11, 13), (10, 14), (10, 15)):
        img.putpixel((x, y), H(rd[5]))
    for x, y in contour(bag):
        img.putpixel((x, y), H(rd[0]))
    for x in range(14, 18):
        img.putpixel((x, 7), H(r[3]))
        img.putpixel((x, 8), H(r[1]))
    coin = disc(16, 17, (2, 3, 4, 4, 4, 3, 2))
    for x, y in coin:
        img.putpixel((x, y), H(r[3]))
    for x, y in contour(coin):
        img.putpixel((x, y), H(r[1]))
    img.putpixel((15, 16), H(r[4]))
    return img


# The crown is placed pixel by pixel: digits index the material ramp, letters
# the stone ramps, "." is transparent. Light sits upper-left, so each point
# carries its highlight left of centre and every diagonal steps 1px per 2 rows.
CROWN_POINT_C = (
    "....00....",
    "...0540...",
    "..044320..",
    "...0320...",
    "....00....",
    "...0430...",
    "...0530...",
    "..045320..",
    "..045320..",
    ".04553210.",
    ".04553210.",
    "0455332210",
    "0455332210",
    "0455332210",
    "0455332210",
    "0455332210",
)
CROWN_POINT_S = (
    "...00...",
    "..0540..",
    "..0430..",
    "...00...",
    "..0430..",
    "..0530..",
    ".045320.",
    ".045320.",
    "04553210",
    "04553210",
    "04553210",
    "04553210",
)
CROWN_BAND = "123344555444333322221111"   # cylinder profile across x 4..27
CROWN_PINK = ("..QQ..", ".QpPQ.", ".QPDQ.", "..QQ..")
CROWN_CYAN = (".KK.", "KcCK", "KCBK", ".KK.")


def crown(r):
    img, _ = canvas()
    pink, cyan = MAT6["pink"], MAT6["cyan"]
    key = {str(i): H(r[i]) for i in range(STEPS)}
    key.update({"p": H(pink[5]), "P": H(pink[3]), "D": H(pink[2]), "Q": H(pink[0]),
                "c": H(cyan[5]), "C": H(cyan[3]), "B": H(cyan[2]), "K": H(cyan[0])})

    def paste(rows, x0, y0):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != ".":
                    img.putpixel((x0 + dx, y0 + dy), key[ch])

    def line(tones):
        return "0" + "".join(str(t) for t in tones) + "0"

    tone = [int(c) for c in CROWN_BAND]
    rim = [min(t + 1, 5) for t in tone]
    under = [max(t - 1, 1) for t in tone]
    paste([line([0] * 24), line(rim)] + [line(tone)] * 5 + [line(under)], 3, 16)
    paste([line(max(t - 2, 1) for t in tone[2:22])], 5, 24)
    paste(["0" * 18], 7, 25)
    paste(CROWN_POINT_S, 3, 4)
    paste(CROWN_POINT_S, 21, 4)
    paste(CROWN_POINT_C, 11, 0)
    paste(CROWN_PINK, 13, 18)
    paste(CROWN_CYAN, 6, 18)
    paste(CROWN_CYAN, 22, 18)
    return img


def vault(r):
    img, d = canvas()
    d.rectangle([5, 12, 27, 25], fill=H(r[0]))
    d.rectangle([6, 13, 26, 24], fill=H(r[2]))
    d.pieslice([6, 7, 26, 19], start=180, end=360, fill=H(r[0]))
    d.pieslice([7, 8, 25, 18], start=180, end=360, fill=H(r[3]))
    d.rectangle([6, 12, 26, 13], fill=H(r[1]))
    d.rectangle([14, 15, 18, 22], fill=H(r[4]))
    d.ellipse([15, 16, 17, 18], fill=H(r[0]))
    d.rectangle([15, 18, 17, 20], fill=H(r[0]))
    d.line([(7, 9), (24, 9)], fill=H(r[5]), width=1)
    return img


def ledger(r):
    # Front-on tax ledger, flat like the other face-on icons: gold binding
    # band, margin rule, ruling that clears the seal, top-lit embossed seal
    # w/ a stamped inner ring that fades into its own shadow side.
    img, d = canvas()
    sheet = {(x, y) for y in range(3, 27) for x in range(6, 26)}
    for x, y in sheet:
        img.putpixel((x, y), H(PAGE))
    for y, t in ((4, 4), (5, 3), (6, 1)):
        d.line([(7, y), (24, y)], fill=H(r[t]))
    d.line([(9, 9), (9, 24)], fill=H(r[2]))
    for y, x1 in ((11, 22), (14, 22), (17, 12), (20, 12), (23, 12)):
        d.line([(11, y), (x1, y)], fill=H(r[1]))
    seal = disc(18, 20, (2, 3, 4, 4, 4, 4, 4, 3, 2))
    for x, y in seal:
        t = 4 if y <= 18 else 3 if y <= 21 else 2
        img.putpixel((x, y), H(r[t]))
    for x, y in ((17, 17), (16, 18)):
        img.putpixel((x, y), H(r[5]))
    for x, y in contour(seal):
        img.putpixel((x, y), H(r[1]))
    for x, y in contour(sheet):
        img.putpixel((x, y), H(r[0]))
    return img


def banknote(r):
    img, d = canvas()
    d.rectangle([3, 9, 29, 23], fill=H(r[0]))
    d.rectangle([4, 10, 28, 22], fill=H(r[3]))
    for a, b in [((8, 12), (24, 12)), ((8, 20), (24, 20)),
                 ((6, 14), (6, 18)), ((26, 14), (26, 18))]:
        d.line([a, b], fill=H(r[2]), width=1)
    d.ellipse([13, 12, 19, 20], fill=H(r[2]))
    d.ellipse([14, 13, 18, 19], fill=H(r[4]))
    for x in (7, 25):
        d.ellipse([x - 1, 15, x + 1, 17], fill=H(r[1]))
    d.line([(5, 11), (27, 11)], fill=H(r[5]), width=1)
    return img


def nuggets(r):
    # goldrush: two hard-faceted gold gems with split lit/shadow planes, so the
    # silhouette is sharp rather than lumpy.
    img, d = canvas()
    d.polygon([(11, 12), (17, 16), (16, 22), (10, 26), (4, 21), (6, 15)],
              fill=H(r[0]))
    d.polygon([(11, 13), (16, 16), (11, 19), (7, 16)], fill=H(r[5]))
    d.polygon([(16, 16), (15, 21), (11, 23), (11, 19)], fill=H(r[3]))
    d.polygon([(7, 16), (11, 19), (11, 23), (10, 25), (5, 21)], fill=H(r[2]))
    d.polygon([(18, 7), (24, 11), (22, 17), (16, 15), (16, 10)], fill=H(r[0]))
    d.polygon([(18, 8), (23, 11), (19, 13), (17, 11)], fill=H(r[4]))
    d.polygon([(19, 13), (23, 11), (21, 16), (17, 14)], fill=H(r[3]))
    d.polygon([(17, 11), (19, 13), (17, 14), (16, 13)], fill=H(r[2]))
    for sx, sy in [(22, 6), (5, 16)]:
        d.line([(sx - 1, sy), (sx + 1, sy)], fill=H(r[5]))
        d.line([(sx, sy - 1), (sx, sy + 1)], fill=H(r[5]))
    return img


def ingot(r):
    img, d = canvas()
    # Cast frustum drawn per row: wide plateau, 1:1 shoulder, 1:3 front flare,
    # so each edge holds a single step rhythm. Faces split by value alone (top
    # r[4], near edge r[5], left slope r[3], front r[2], right slope r[1]).
    d.line([(9, 10), (23, 10)], fill=H(r[0]))
    for y in range(11, 14):
        lo, hi = 9 - (y - 10), 23 + (y - 10)
        img.putpixel((lo, y), H(r[0]))
        img.putpixel((hi, y), H(r[0]))
        img.putpixel((lo + 1, y), H(r[5]))
        d.line([(lo + 2, y), (hi - 2, y)], fill=H(r[4]))
        img.putpixel((hi - 1, y), H(r[3]))
    img.putpixel((5, 14), H(r[0]))
    img.putpixel((27, 14), H(r[0]))
    d.line([(6, 14), (26, 14)], fill=H(r[5]))
    for y in range(15, 24):
        lo = 4 - (y - 15) // 3
        hi = 28 + (y - 15) // 3
        img.putpixel((lo, y), H(r[0]))
        img.putpixel((hi, y), H(r[0]))
        d.line([(lo + 1, y), (6, y)], fill=H(r[3]))
        d.line([(7, y), (25, y)], fill=H(r[2]))
        d.line([(26, y), (hi - 1, y)], fill=H(r[1]))
    d.line([(2, 24), (30, 24)], fill=H(r[0]))
    return img


# Sound/word archetype was eight identical music notes. Same pink family, one
# distinct object each.
def songnote(r):
    # aria: a single note ringing out — one melody line projecting sound, set
    # apart from the multi-note cascade/chorus/staccato icons.
    img, d = canvas()
    hx, hy = 11, 21
    d.ellipse([hx - 5, hy - 4, hx + 5, hy + 4], fill=H(r[0]))
    d.ellipse([hx - 4, hy - 3, hx + 4, hy + 3], fill=H(r[3]))
    d.rectangle([hx - 3, hy - 3, hx - 1, hy - 1], fill=H(r[5]))
    d.rectangle([hx + 4, hy - 16, hx + 6, hy], fill=H(r[0]))
    d.rectangle([hx + 4, hy - 16, hx + 5, hy], fill=H(r[3]))
    d.polygon([(hx + 6, hy - 16), (hx + 13, hy - 11),
               (hx + 12, hy - 6), (hx + 6, hy - 9)], fill=H(r[0]))
    d.polygon([(hx + 6, hy - 15), (hx + 11, hy - 11),
               (hx + 10, hy - 8), (hx + 6, hy - 10)], fill=H(r[3]))
    for rad in (4, 7):
        d.arc([hx + 9 - rad, hy - 1 - rad, hx + 9 + rad, hy - 1 + rad],
              start=300, end=60, fill=H(r[4]), width=1)
    return img


def cascade(r):
    # a descending beamed run: note heads step down left-to-right, stems rise
    # to a double beam that slants down with them, reading as a cascade of notes.
    img, d = canvas()
    heads = [(6, 11), (12, 15), (18, 19), (24, 23)]
    for cx, cy in heads:
        d.rectangle([cx + 2, cy - 9, cx + 3, cy], fill=H(r[0]))
        d.rectangle([cx + 2, cy - 9, cx + 2, cy], fill=H(r[3]))
    d.line([(8, 3), (27, 15)], fill=H(r[0]), width=3)
    d.line([(8, 2), (27, 14)], fill=H(r[4]), width=1)
    d.line([(8, 4), (27, 16)], fill=H(r[3]), width=1)
    for cx, cy in heads:
        d.ellipse([cx - 3, cy - 2, cx + 2, cy + 2], fill=H(r[0]))
        d.ellipse([cx - 2, cy - 1, cx + 1, cy + 1], fill=H(r[3]))
        img.putpixel((cx - 2, cy - 1), H(r[5]))
    return img


def bubble(r):
    img, d = canvas()
    d.rounded_rectangle([4, 5, 28, 21], radius=5, fill=H(r[0]))
    d.rounded_rectangle([5, 6, 27, 20], radius=4, fill=H(r[3]))
    d.polygon([(10, 20), (10, 27), (17, 20)], fill=H(r[0]))
    d.polygon([(11, 20), (11, 24), (15, 20)], fill=H(r[3]))
    for cx in (13, 19):
        d.ellipse([cx - 4, 9, cx + 4, 17], fill=H(r[1]))
    for cx in (13, 19):
        d.ellipse([cx - 2, 11, cx + 2, 15], fill=H(r[3]))
    d.line([(6, 7), (26, 7)], fill=H(r[5]), width=1)
    return img


def tuningfork(r):
    img, d = canvas()
    d.rectangle([9, 4, 12, 18], fill=H(r[0]))
    d.rectangle([20, 4, 23, 18], fill=H(r[0]))
    d.rectangle([10, 5, 11, 17], fill=H(r[3]))
    d.rectangle([21, 5, 22, 17], fill=H(r[4]))
    d.pieslice([9, 12, 23, 26], start=0, end=180, fill=H(r[0]))
    d.pieslice([11, 13, 21, 24], start=0, end=180, fill=H(r[3]))
    d.rectangle([14, 22, 18, 29], fill=H(r[0]))
    d.rectangle([15, 22, 17, 28], fill=H(r[2]))
    d.line([(10, 5), (10, 16)], fill=H(r[5]), width=1)
    return img


def trio(r):
    img, d = canvas()
    for hx, hy in [(7, 20), (14, 24), (21, 18)]:
        d.ellipse([hx - 3, hy - 2, hx + 3, hy + 2], fill=H(r[0]))
        d.ellipse([hx - 2, hy - 1, hx + 2, hy + 1], fill=H(r[3]))
        d.rectangle([hx + 2, hy - 12, hx + 3, hy], fill=H(r[0]))
        img.putpixel((hx - 1, hy - 1), H(r[5]))
    d.line([(9, 8), (24, 6)], fill=H(r[0]), width=2)
    return img


def metronome(r):
    # cadence: upright metronome — trapezoidal wedge on a plinth, with a
    # pendulum arm pivoting from the base that pokes above the top and a
    # sliding weight on it. The protruding arm is what reads as a metronome.
    img, d = canvas()
    d.polygon([(9, 25), (23, 25), (20, 7), (12, 7)], fill=H(r[0]))
    d.polygon([(11, 24), (21, 24), (19, 9), (13, 9)], fill=H(r[3]))
    d.rectangle([12, 9, 14, 24], fill=H(r[4]))
    d.rectangle([18, 9, 20, 24], fill=H(r[2]))
    d.rectangle([7, 24, 25, 28], fill=H(r[0]))
    d.rectangle([8, 25, 24, 27], fill=H(r[1]))
    d.line([(16, 23), (18, 2)], fill=H(r[0]), width=2)
    d.rectangle([15, 13, 19, 16], fill=H(r[0]))
    d.rectangle([15, 13, 18, 15], fill=H(r[5]))
    return img


def chord(r):
    # consonance: two note heads stacked on a shared stem, an interval that
    # reads as harmony. Distinct from cascade's descending run and chorus's trio.
    img, d = canvas()
    stem_x = 16
    d.rectangle([stem_x, 4, stem_x + 2, 22], fill=H(r[0]))
    d.rectangle([stem_x, 4, stem_x + 1, 22], fill=H(r[3]))
    d.line([(stem_x, 4), (stem_x, 21)], fill=H(r[5]), width=1)
    for hx, hy in [(12, 21), (12, 13)]:
        d.ellipse([hx - 4, hy - 3, hx + 4, hy + 3], fill=H(r[0]))
        d.ellipse([hx - 3, hy - 2, hx + 3, hy + 2], fill=H(r[2]))
        d.rectangle([hx - 3, hy - 2, hx - 1, hy - 1], fill=H(r[5]))
    return img


# Book archetype was four identical spines; masonry four identical bricks. Same
# material families, distinct objects.
def open_book(r):
    # polysyllable: open spread rebuilt row-authored (the polygon version
    # left ragged edges). Cover rim 2px proud of the pages, shaded gutter
    # valley, text as syllable dashes; left page mirrors to the right.
    img, _ = canvas()
    tops = {15: 12, 14: 12, 13: 12, 12: 11, 11: 11, 10: 11,
            9: 10, 8: 10, 7: 10, 6: 9, 5: 9, 4: 9}
    bots = {15: 24, 14: 24, 13: 24, 12: 23, 11: 23, 10: 23,
            9: 22, 8: 22, 7: 22, 6: 21, 5: 21, 4: 21}
    page = {(x, y) for x, t in tops.items() for y in range(t, bots[x] + 1)}
    page |= {(31 - x, y) for x, y in page}
    cover = set(page)
    for _ in range(2):
        cover |= {(x + dx, y + dy) for x, y in cover
                  for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))}
    for x, y in cover - page:
        img.putpixel((x, y), H(r[2]))
    # Pages shade on the bone ramp as a curl: bright crest mid-page, falling
    # into the gutter and outer edge, top row lit, bottom row shadowed.
    bn = MAT6["bone"]
    tone = {4: 3, 5: 3, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 4,
            13: 3, 14: 3, 15: 2}
    for x, y in page:
        c = min(x, 31 - x)
        t = tone[c]
        if y == tops[c]:
            t = min(t + 1, 5)
        elif y == bots[c]:
            t = max(t - 1, 1)
        img.putpixel((x, y), H(bn[t]))
    for y, (a, b) in ((14, (6, 8)), (14, (10, 13)), (17, (6, 8)),
                      (17, (10, 12)), (20, (6, 9))):
        for x in range(a, b + 1):
            img.putpixel((x, y), H(r[1]))
            img.putpixel((31 - x, y), H(r[1]))
    for x, y in contour(cover):
        img.putpixel((x, y), H(r[0]))
    return img


def dictionary(r):
    # lexicographer: closed blue dictionary, face-on. Spine band left, cream
    # page block right w/ thumb-index notches (the dictionary tell), pasted
    # title label. Blue cover splits it from the other two book relics.
    img, _ = canvas()
    bl = MAT6["blue"]
    body = {(x, y) for y in range(4, 27) for x in range(6, 26)}
    for x, y in body:
        img.putpixel((x, y), H(PAGE if x >= 23 else
                               bl[2] if x <= 8 else bl[3]))
    for x in range(9, 23):
        img.putpixel((x, 5), H(bl[4]))
    for nx, ny in ((24, 9), (24, 14), (24, 19)):
        for dx in (0, 1):
            for dy in (0, 1):
                img.putpixel((nx + dx, ny + dy), H(PAGE_SHADE))
    label = {(x, y) for y in range(8, 13) for x in range(11, 21)}
    for x, y in label:
        img.putpixel((x, y), H(PAGE))
    for x, y in contour(label):
        img.putpixel((x, y), H(bl[1]))
    for x in range(13, 19):
        img.putpixel((x, 10), H(bl[1]))
    for x, y in contour(body):
        img.putpixel((x, y), H(bl[0]))
    return img


def tome(r):
    # philosopher: strapped leather tome. Brass boss, corner studs, and two
    # brass clasps over the fore-edge; the hardware splits it from the blue
    # dictionary and the open spread.
    img, _ = canvas()
    br = MAT6["brass"]
    body = {(x, y) for y in range(3, 27) for x in range(5, 26)}
    for x, y in body:
        img.putpixel((x, y), H(r[2]))
    for x, y in contour({(x, y) for y in range(6, 24) for x in range(8, 23)}):
        img.putpixel((x, y), H(r[4]))
    img.putpixel((7, 4), H(r[4]))
    boss = disc(15, 14, (1, 3, 4, 3, 1))
    for x, y in boss:
        img.putpixel((x, y), H(br[3]))
    for x, y in contour(boss):
        img.putpixel((x, y), H(br[1]))
    img.putpixel((14, 13), H(br[5]))
    for sx, sy in ((9, 7), (20, 7), (9, 21), (20, 21)):
        for dx in (0, 1):
            for dy in (0, 1):
                img.putpixel((sx + dx, sy + dy), H(br[2]))
    for x, y in contour(body):
        img.putpixel((x, y), H(r[0]))
    for cy in (8, 18):
        for x in range(23, 28):
            img.putpixel((x, cy), H(br[3]))
            img.putpixel((x, cy + 1), H(br[2]))
            img.putpixel((x, cy + 2), H(br[1]))
        img.putpixel((27, cy + 1), H(br[4]))
    return img


def novella(r):
    # Closed book in 3/4 offset: cover sits up-left of an equal page block so
    # a 3px fore-edge shows along the right and bottom; the thin block is the
    # tell that it's a short book. Ribbon bookmark trails out the top at the
    # fore-edge, clear of the rarity pips along the canvas foot.
    img, d = canvas()
    red = MAT6["red"]
    d.rectangle([11, 6, 25, 28], fill=H(PAGE))
    d.line([(25, 6), (25, 28)], fill=H(r[0]))
    d.line([(11, 28), (25, 28)], fill=H(r[0]))
    for y in range(9, 26, 3):
        d.line([(23, y), (24, y)], fill=H(PAGE_SHADE))
    d.rectangle([8, 3, 22, 25], fill=H(r[2]))
    d.rectangle([9, 4, 10, 24], fill=H(r[1]))
    d.rectangle([8, 3, 22, 25], outline=H(r[0]))
    d.line([(12, 4), (21, 4)], fill=H(r[5]))
    d.rectangle([13, 8, 20, 11], fill=H(r[4]))
    d.line([(13, 14), (18, 14)], fill=H(r[4]))
    for y in range(2, 8):
        img.putpixel((23, y), H(red[3]))
        img.putpixel((24, y), H(red[1]))
    img.putpixel((24, 1), H(red[1]))
    return img


def keystone(r):
    # keystone: the wedge shown doing its job at the crown of an arch, a
    # value lighter than the voussoirs so it reads as the subject. Each
    # block carries its own mortar contour, the union the dark silhouette.
    img, _ = canvas()
    key = {(x, y) for y, (a, b) in
           {4: (12, 19), 5: (12, 19), 6: (13, 18), 7: (13, 18),
            8: (13, 18), 9: (13, 18), 10: (13, 18)}.items()
           for x in range(a, b + 1)}
    left = [{(x, y) for y, (a, b) in rows.items() for x in range(a, b + 1)}
            for rows in (
                {y: (8, 12) for y in range(6, 11)},
                {11: (5, 12), 12: (5, 11), 13: (5, 10),
                 14: (5, 10), 15: (5, 10)},
                {y: (4, 9) for y in range(16, 21)},
                {y: (4, 9) for y in range(21, 26)},
                {26: (3, 10)})]
    blocks = left + [{(31 - x, y) for x, y in b} for b in left] + [key]
    union = {c for b in blocks for c in b}
    for b in blocks:
        base, lit = (4, 5) if b is key else (3, 4)
        for x, y in b:
            img.putpixel((x, y), H(r[lit if (x, y - 1) not in b else base]))
        for x, y in contour(b):
            img.putpixel((x, y), H(r[1]))
    for x, y in contour(union):
        img.putpixel((x, y), H(r[0]))
    return img


def pigweight(r):
    # ballast: a heavy trapezoidal weight with a ring handle. Wide base +
    # narrow top is the universal "this is heavy" silhouette.
    img, d = canvas()
    d.arc([9, 3, 23, 17], start=180, end=360, fill=H(r[0]), width=3)
    d.arc([11, 5, 21, 15], start=180, end=360, fill=H(r[2]), width=1)
    d.rectangle([9, 10, 11, 14], fill=H(r[0]))
    d.rectangle([21, 10, 23, 14], fill=H(r[0]))
    d.polygon([(9, 13), (23, 13), (27, 28), (5, 28)], fill=H(r[0]))
    d.polygon([(11, 15), (16, 15), (16, 26), (8, 26)], fill=H(r[3]))
    d.polygon([(16, 15), (21, 15), (24, 26), (16, 26)], fill=H(r[1]))
    d.line([(11, 16), (15, 16)], fill=H(r[5]), width=1)
    return img


def boulder(r):
    # momentum: a rolling rock. Speed trails behind it on the left carry the
    # motion; the boulder is shoved right to leave room for them.
    img, d = canvas()
    d.ellipse([9, 5, 29, 25], fill=H(r[0]))
    d.ellipse([11, 7, 27, 23], fill=H(r[2]))
    d.line([(14, 12), (18, 8)], fill=H(r[4]), width=2)
    for x, y in [(20, 17), (16, 20), (23, 12)]:
        img.putpixel((x, y), H(r[0]))
    d.line([(4, 10), (8, 10)], fill=H(r[0]), width=1)
    d.line([(1, 15), (8, 15)], fill=H(r[0]), width=2)
    d.line([(4, 20), (8, 20)], fill=H(r[0]), width=1)
    return img


# Remaining shared primitives (dice x3, flask x3, drop x2, gem x2) split into
# distinct objects within their material family.
CARD_W, CARD_H = 15, 22
CARDS = ((2, 2), (15, 4))          # (x0, y0): two of spades behind, seven of hearts in front
HEART = ("X.X", "XXX", ".X.")
SPADE = ("..X..", ".XXX.", "XXXXX", "XXXXX", "..X..")
HEART_7 = ((2, 2), (2, 8), (2, 14), (10, 2), (10, 8), (10, 14), (6, 5))
SPADE_2 = ((5, 2, False), (5, 15, True))


def glyph(img, rows, x0, y0, colour, flip=False):
    for j, row in enumerate(rows[::-1] if flip else rows):
        for i, ch in enumerate(row):
            if ch == "X":
                img.putpixel((x0 + i, y0 + j), colour)


def card_cells(x0, y0):
    x1, y1 = x0 + CARD_W - 1, y0 + CARD_H - 1
    cells = {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}
    return cells - {(x0, y0), (x1, y0), (x0, y1), (x1, y1)}


def cards(r):
    img, _ = canvas()
    (bx, by), (fx, fy) = CARDS
    for x0, y0 in CARDS:
        body = card_cells(x0, y0)
        for x, y in body:
            edge = x == x0 + CARD_W - 2 or y == y0 + CARD_H - 2
            img.putpixel((x, y), H(r[4] if edge else r[5]))
        for x, y in contour(body):
            img.putpixel((x, y), H(r[0]))
        if (x0, y0) == (bx, by):
            for y in range(fy + 1, by + CARD_H - 1):
                img.putpixel((fx - 1, y), H(r[3]))
    for dx, dy, flip in SPADE_2:
        glyph(img, SPADE, bx + dx, by + dy, H(MAT6["silver"][0]), flip)
    for dx, dy in HEART_7:
        glyph(img, HEART, fx + dx, fy + dy, H(MAT6["red"][2]))
    return img


def hourglass(r):
    # glasscannon: face-on hourglass. Leather frame (caps + side pillars) lit
    # left / shadowed right, mirror-tint glass bulbs w/ a 1px waist, bone sand
    # mid-pour: remnant above, falling stream, mound below.
    img, _ = canvas()
    lw = MAT6["leather"]
    frame = {(x, y) for y in (3, 4, 5, 23, 24, 25) for x in range(8, 25)}
    halves = (5, 6, 6, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 6, 6, 5)
    glass = {(x, 6 + i) for i, hw in enumerate(halves)
             for x in range(16 - hw, 16 + hw + 1)}
    for x, y in glass:
        img.putpixel((x, y), H("#aacfe3" if (x - 16) + (y - 14) >= 3 else "#cbe6f1"))
    for x, y in contour(glass):
        img.putpixel((x, y), H(lw[0]))
    for x, y in ((12, 7), (11, 8), (11, 9)):
        img.putpixel((x, y), H("#f2fbff"))
    sand = [(4, 12, 14, 18), (3, 13, 15, 17), (3, 14, 16, 16),
            (4, 15, 16, 16), (4, 16, 16, 16), (4, 17, 16, 16),
            (4, 18, 15, 17), (4, 19, 13, 19), (3, 20, 12, 20),
            (3, 21, 11, 21), (3, 22, 12, 20)]
    for t, y, a, b in sand:
        for x in range(a, b + 1):
            img.putpixel((x, y), H(r[t]))
    for x, y in frame:
        img.putpixel((x, y), H(lw[2]))
    for x, y in contour(frame):
        img.putpixel((x, y), H(lw[0]))
    for x in range(9, 24):
        img.putpixel((x, 4), H(lw[3]))
        img.putpixel((x, 24), H(lw[1]))
    return img


def furnace(r):
    # Masonry block with two stacks and an arched firebox. Same top-left light
    # as foundation: lit top/left edges, shadowed bottom/right, mortar joints
    # in the shadow tone. Flames are tongues, not concentric arcs.
    img, d = canvas()
    for sx in (9, 18):
        d.rectangle([sx, 2, sx + 4, 8], fill=H(r[0]))
        d.rectangle([sx + 1, 3, sx + 3, 8], fill=H(r[2]))
        d.line([(sx + 1, 3), (sx + 1, 8)], fill=H(r[4]), width=1)
        d.line([(sx + 3, 4), (sx + 3, 8)], fill=H(r[1]), width=1)
    d.rectangle([5, 8, 27, 27], fill=H(r[0]))
    d.rectangle([6, 9, 26, 26], fill=H(r[2]))
    for y in (13, 17, 21, 25):
        d.line([(6, y), (26, y)], fill=H(r[1]), width=1)
    for y0, xs in [(9, (11, 21)), (14, (8, 16, 24)), (18, (11, 21)),
                   (22, (8, 16, 24))]:
        for x in xs:
            d.line([(x, y0), (x, y0 + 3)], fill=H(r[1]), width=1)
    d.line([(6, 9), (26, 9)], fill=H(r[4]), width=1)
    d.line([(6, 9), (6, 26)], fill=H(r[4]), width=1)
    d.line([(6, 26), (26, 26)], fill=H(r[1]), width=1)
    d.line([(26, 9), (26, 26)], fill=H(r[1]), width=1)
    img.putpixel((6, 9), H(r[5]))
    img.putpixel((7, 9), H(r[5]))
    d.pieslice([10, 12, 22, 20], start=180, end=360, fill=H(r[0]))
    d.rectangle([10, 16, 22, 25], fill=H(r[0]))
    d.pieslice([11, 13, 21, 20], start=180, end=360, fill=H("#1a1612"))
    d.rectangle([11, 16, 21, 24], fill=H("#1a1612"))
    d.line([(11, 24), (21, 24)], fill=H("#5a2a10"), width=1)
    d.polygon([(12, 24), (13, 20), (14, 22), (16, 16), (18, 21),
               (19, 19), (20, 24)], fill=H("#ff6b3a"))
    d.polygon([(14, 24), (15, 21), (16, 19), (17, 21), (18, 24)],
              fill=H("#ffd24a"))
    d.polygon([(15, 24), (16, 22), (17, 24)], fill=H("#fff0b0"))
    return img


def chalice(r):
    img, d = canvas()
    d.pieslice([9, 6, 23, 18], start=0, end=180, fill=H(r[0]))
    d.pieslice([10, 7, 22, 17], start=0, end=180, fill=H(r[3]))
    d.ellipse([13, 10, 19, 14], fill=H(r[5]))
    d.rectangle([15, 12, 17, 22], fill=H(r[0]))
    d.rectangle([15, 12, 16, 22], fill=H(r[2]))
    d.ellipse([10, 22, 22, 27], fill=H(r[0]))
    d.ellipse([11, 22, 21, 26], fill=H(r[2]))
    d.line([(11, 8), (21, 8)], fill=H(r[5]), width=1)
    return img


# Hanging lantern, authored per row: a 2px ring that lands on the cap, a
# trapezoid cap and base, and three glass panes split by cage bars with the
# flame in the centre pane. Digits are ramp steps; g/k are lit and dim glass,
# w/y/o the flame core, body and base.
LANTERN = (
    ".............0000000............",
    "............055433320...........",
    "...........040.....020..........",
    "...........030.....010..........",
    "...........030.....010..........",
    "...........00000000000..........",
    "..........055444333330..........",
    ".........03333322222220.........",
    "........01111111111111110.......",
    ".........022222222222220........",
    ".........03kk2kkkkk1kk10........",
    ".........03kk2kgggk1kk10........",
    ".........03kk2kgggk1kk10........",
    ".........03kg2ggygg1gk10........",
    ".........03kg2ggygg1gk10........",
    ".........03kg2gyyyg1gk10........",
    ".........03kg2gywyg1gk10........",
    ".........03kg2gywyg1gk10........",
    ".........03kg2gywyg1gk10........",
    ".........03kg2gowog1gk10........",
    ".........03kk2gooog1kk10........",
    ".........03kk2kk1kk1kk10........",
    ".........011111111111110........",
    "........03333332222222220.......",
    "........01111111111111110.......",
    "........00000000000000000.......",
)
LANTERN_GLOW = {"g": "#f7d98a", "k": "#c98a30",
                "w": "#fff8dc", "y": "#ffb020", "o": "#ff5a1e"}


def lantern(r):
    img, _ = canvas()
    key = {str(i): H(r[i]) for i in range(STEPS)}
    key.update({k: H(v) for k, v in LANTERN_GLOW.items()})
    for y, row in enumerate(LANTERN):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), key[ch])
    return img


# Alms bowl: one grain of rice inside, the relic's "at most one vowel". Body
# half-widths are listed per row so the curve steps 3-2-2-1-1-1 instead of the
# jagged run an ellipse call produces; BOWL_BAND is the cylinder light profile.
BOWL_HALF = (13, 13, 13, 13, 12, 12, 11, 11, 10, 9, 8, 7)
BOWL_BAND = "12334455554443333222211111"
BOWL_TOP = 10
# Rim oval, ends stepping 4-2-1-1-2-4. The far half is outlined against
# transparency; the near half sits on the body, so its edge is a lit lip (4)
# over a crease (2) instead of a second outline. "g"/"G" is the grain.
BOWL_RIM = (
    "..........000000000000..........",
    "......00005555555544440000......",
    "....005511111111111111113300....",
    "...05111111111111111111111130...",
    "....23111111111ggG1111111132....",
    "......2233111111GG11113322......",
    "..........444444443333..........",
)


def bowl(r):
    img, d = canvas()
    chalk = MAT6["chalk"]
    key = {str(i): H(r[i]) for i in range(STEPS)}
    key.update({"g": H(chalk[5]), "G": H(chalk[3])})
    for i, hw in enumerate(BOWL_HALF):
        y = BOWL_TOP + i
        x0, x1 = 16 - hw, 15 + hw
        span = x1 - x0
        for x in range(x0, x1 + 1):
            t = int(BOWL_BAND[(x - x0) * (len(BOWL_BAND) - 1) // span])
            t = max(t - i // 3, 1)
            img.putpixel((x, y), key[str(t)])
        img.putpixel((x0, y), key["0"])
        img.putpixel((x1, y), key["0"])
    d.rectangle([9, 22, 22, 22], fill=key["0"])
    d.rectangle([11, 23, 20, 25], fill=key["0"])
    d.rectangle([12, 23, 19, 24], fill=key["1"])
    d.rectangle([12, 23, 14, 24], fill=key["2"])
    for dy, row in enumerate(BOWL_RIM):
        for dx, ch in enumerate(row):
            if ch != ".":
                img.putpixel((dx, 6 + dy), key[ch])
    return img


# Numismatist: one struck coin under a jeweller's loupe. Disc half-widths are
# authored per row (Bresenham rhythm, no ellipse call); the glass lifts every
# coin tone it covers one step so the lens reads as glass, not a second ring.
NUMIS_R9 = (3, 5, 6, 7, 8, 8, 9, 9, 9, 9, 9, 9, 9, 8, 8, 7, 6, 5, 3)
NUMIS_R7 = (3, 4, 5, 6, 7, 7, 7, 7, 7, 7, 7, 6, 5, 4, 3)
NUMIS_R5 = (2, 4, 4, 5, 5, 5, 5, 5, 4, 4, 2)
NUMIS_COIN = (11, 16)
NUMIS_LENS = (18, 11)
NUMIS_GLASS = "#e4f4ff"
NUMIS_SPECULAR = "#ffffff"
NUMIS_HANDLE_ROWS = 5


def disc(cx, cy, halves):
    top = cy - len(halves) // 2
    return {(x, top + i) for i, hw in enumerate(halves)
            for x in range(cx - hw, cx + hw + 1)}


def contour(cells):
    return {(x, y) for x, y in cells
            if {(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)} - cells}


def numismatist(r):
    img, _ = canvas()
    silver = MAT6["silver"]
    key = {str(i): H(r[i]) for i in range(STEPS)}
    step = {H(r[i]): i for i in range(STEPS)}
    cx, cy = NUMIS_COIN
    face = disc(cx, cy, NUMIS_R9)
    # Tone falls off with distance from a light point up-left of centre so the
    # bands curve; the engraved X is a dark groove w/ its lower-right wall lit.
    for x, y in face:
        d2 = (x - cx + 3) ** 2 + (y - cy + 3) ** 2
        t = 5 if d2 < 10 else 4 if d2 < 50 else 3 if d2 < 110 else 2
        img.putpixel((x, y), key[str(t)])
    for x, y in contour(disc(cx, cy, NUMIS_R7)):
        img.putpixel((x, y), key["2"])
    for k in range(-4, 5):
        img.putpixel((cx + k + 1, cy + k + 1), key["5"])
        img.putpixel((cx - k + 1, cy + k + 1), key["5"])
    for k in range(-4, 5):
        img.putpixel((cx + k, cy + k), key["1"])
        img.putpixel((cx - k, cy + k), key["1"])
    for x, y in contour(face):
        img.putpixel((x, y), key["0"])

    lx, ly = NUMIS_LENS
    outer = disc(lx, ly, NUMIS_R7)
    glass = disc(lx, ly, NUMIS_R5)
    for x, y in glass:
        p = img.getpixel((x, y))
        if p[3] == 0:
            img.putpixel((x, y), H(NUMIS_GLASS))
        else:
            img.putpixel((x, y), key[str(min(step[p] + 1, STEPS - 1))])
    for x, y in ((lx - 3, ly - 2), (lx - 2, ly - 3), (lx - 1, ly - 4)):
        img.putpixel((x, y), H(NUMIS_SPECULAR))
    for x, y in outer - glass:
        u = (x - lx) + (y - ly)
        img.putpixel((x, y), H(silver[4] if u < 0 else silver[2]))
    for x, y in contour(outer):
        img.putpixel((x, y), H(silver[0]))
    hx, hy = lx + 5, ly + 6
    for i in range(NUMIS_HANDLE_ROWS):
        y = hy + i
        for dx, tone in enumerate((silver[0], silver[4], silver[3], silver[0])):
            img.putpixel((hx + i + dx, y), H(tone))
    for dx in range(4):
        img.putpixel((hx + NUMIS_HANDLE_ROWS + dx, hy + NUMIS_HANDLE_ROWS),
                     H(silver[0]))
    return img


# Dispersion prism: a white beam enters the left face and a solid six-band
# spectrum wedge fans off the right. The glass is authored per row (half-width
# steps 1 per 3 rows, no polygon call), ridge lit, left facet over right in
# the house top-left light. The wedge's top edge climbs 1 per 5 columns and
# its bottom drops 1 per 4, with the widening height split evenly across the
# six hues, so the band stays one contiguous cluster as it spreads.
PRISM_APEX_X, PRISM_TOP = 10, 4
PRISM_HALF = (0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4,
              4, 5, 5, 5, 6, 6, 6, 7, 7, 7)
PRISM_BEAM = ("#fdf6e0", "#f0e2ac")
PRISM_SPECTRUM = ("#ff6b5e", "#ff9d3a", "#ffd24a",
                  "#7ad17f", "#3aa0cf", "#9a6fe0")
PRISM_FAN_X = 14                   # first spectrum column, at the right face
PRISM_FAN_TOP, PRISM_TOP_RUN = 12, 5
PRISM_FAN_BOT, PRISM_BOT_RUN = 17, 4


def prism(r):
    img, _ = canvas()
    cx, top = PRISM_APEX_X, PRISM_TOP
    base = top + len(PRISM_HALF) - 1
    for i, hw in enumerate(PRISM_HALF):
        y = top + i
        x0, x1 = cx - hw, cx + hw
        for x in range(x0, x1 + 1):
            img.putpixel((x, y), H(r[3] if x < cx else r[2]))
        if hw:
            img.putpixel((cx, y), H(r[4]))
        if hw >= 2:
            img.putpixel((x0 + 1, y), H(r[4]))
            img.putpixel((x1 - 1, y), H(r[1]))
        if y == base:
            for x in range(x0, x1 + 1):
                img.putpixel((x, y), H(r[0]))
        else:
            img.putpixel((x0, y), H(r[0]))
            img.putpixel((x1, y), H(r[0]))
    img.putpixel((cx, top + 4), H(r[5]))
    img.putpixel((cx, top + 5), H(r[5]))
    for x in range(NAT):
        y = 9 + x // 3
        if x >= cx - PRISM_HALF[y + 1 - top]:
            break
        img.putpixel((x, y), H(PRISM_BEAM[0]))
        img.putpixel((x, y + 1), H(PRISM_BEAM[1]))
    for x in range(PRISM_FAN_X, NAT):
        y_t = PRISM_FAN_TOP - (x - PRISM_FAN_X) // PRISM_TOP_RUN
        y_b = PRISM_FAN_BOT + (x - PRISM_FAN_X) // PRISM_BOT_RUN
        height = y_b - y_t + 1
        for y in range(y_t, y_b + 1):
            if img.getpixel((x, y))[3] == 0:
                band = (y - y_t) * len(PRISM_SPECTRUM) // height
                img.putpixel((x, y), H(PRISM_SPECTRUM[band]))
    return img


# The tool/emblem family, authored 32px so nothing falls back to 16px and the
# four near-duplicate pairs (pick, scale, mirror, tally) split apart.
def boot(r):
    # marathoner: running-shoe side profile, heel left. Row-authored top
    # boundary, 2:1 instep slope into a 1:1 toe drop, dark collar opening,
    # cream midsole/laces/side stripe against the leather for the shoe read.
    img, d = canvas()
    top = {8: (6, 11), 9: (5, 12), 10: (5, 13), 11: (5, 15), 12: (5, 17),
           13: (5, 19), 14: (5, 21), 15: (5, 23), 16: (5, 24), 17: (5, 25),
           18: (5, 26), 19: (5, 27), 20: (5, 27)}
    upper = {(x, y) for y, (a, b) in top.items() for x in range(a, b + 1)}
    sole = {(x, y) for y in (21, 22, 23, 24) for x in range(4, 29)}
    body = upper | sole
    for x, y in upper:
        img.putpixel((x, y), H(r[4] if x >= 23 or y <= 10 else
                               r[2] if y >= 19 else r[3]))
    for x, y in sole:
        img.putpixel((x, y), H(PAGE if y <= 22 else r[1]))
    for x in range(7, 27, 4):
        img.putpixel((x, 23), H(r[0]))
    for x, y in [(x, y) for y in (9, 10) for x in range(7, 11)] + [(11, 10)]:
        img.putpixel((x, y), H(r[1]))
    for y in range(13, 19):
        img.putpixel((12, y), H(r[2]))
    for x, y in ((15, 12), (14, 13), (17, 13), (16, 14), (19, 14), (18, 15)):
        img.putpixel((x, y), H(PAGE))
    for x, y in ((10, 19), (11, 19), (12, 18), (13, 18), (14, 17), (15, 17),
                 (16, 16), (17, 16)):
        img.putpixel((x, y), H(PAGE))
    for x, y in contour(body):
        img.putpixel((x, y), H(r[0]))
    return img


def tally(r):
    img, d = canvas()
    for i, x in enumerate(range(8, 22, 4)):
        d.line([(x, 8), (x, 24)], fill=H(r[0]), width=2)
        d.line([(x, 8), (x, 24)], fill=H(r[2]), width=1)
    d.line([(6, 24), (23, 9)], fill=H(r[0]), width=2)
    d.line([(6, 23), (23, 8)], fill=H(r[4]), width=1)
    for x in range(8, 22, 4):
        y = round(23 - (x - 6) * 15 / 17)
        img.putpixel((x, y + 1), H(r[0]))
    return img


def album(r):
    # collector: a coin album — a bound page of coin slots, several filled with
    # gold, so the collection reads at a glance.
    img, d = canvas()
    d.rounded_rectangle([5, 4, 27, 28], radius=2, fill=H(r[0]))
    d.rounded_rectangle([6, 5, 26, 27], radius=2, fill=H(r[3]))
    d.rectangle([8, 5, 9, 27], fill=H(r[0]))
    d.line([(11, 6), (25, 6)], fill=H(r[5]), width=1)
    filled = {(0, 0), (1, 1), (0, 2), (1, 0)}
    coin_lit, coin_dark = "#e8c14f", "#b8862c"
    for row in range(3):
        for col in range(2):
            cx, cy = 15 + col * 7, 9 + row * 7
            d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=H(r[0]))
            if (col, row) in filled:
                d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=H(coin_dark))
                d.ellipse([cx - 2, cy - 2, cx, cy], fill=H(coin_lit))
    return img


def pickaxe(r):
    img, d = canvas()
    d.arc([5, 5, 27, 20], start=200, end=340, fill=H(r[0]), width=3)
    d.arc([6, 6, 26, 19], start=200, end=340, fill=H(r[4]), width=1)
    d.rectangle([14, 8, 17, 28], fill=H("#6b3d1f"))
    d.rectangle([15, 8, 16, 28], fill=H("#a06322"))
    d.line([(8, 9), (11, 8)], fill=H(r[5]), width=1)
    return img


def orevein(r):
    img, d = canvas()
    d.rounded_rectangle([4, 7, 28, 26], radius=3, fill=H("#3a352c"))
    d.rounded_rectangle([5, 8, 27, 25], radius=3, fill=H("#48607f"))
    for cut in [[(4, 7), (10, 7), (4, 12)], [(28, 21), (28, 26), (22, 26)]]:
        d.polygon(cut, fill=(0, 0, 0, 0))
        d.line([cut[1], cut[2]], fill=H("#3a352c"), width=1)
    pts = [(7, 22), (12, 18), (14, 20), (19, 13), (23, 15), (26, 10)]
    for a, b in zip(pts, pts[1:]):
        d.line([a, b], fill=H(r[0]), width=3)
        d.line([a, b], fill=H(r[3]), width=1)
    for x, y in [(12, 18), (19, 13), (23, 15)]:
        d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=H(r[5]))
    return img


def butterfly(r):
    # symmetry: butterfly authored as a left half mirrored cell-for-cell
    # across the body axis (x -> 31-x), so the symmetry is exact by
    # construction. Pink wing membrane borrowed the way appraiser borrows
    # cyan; silver body and contour carry the sprite's own ramp.
    img, _ = canvas()
    pk = MAT6["pink"]
    fore = {6: (4, 8), 7: (3, 10), 8: (2, 12), 9: (2, 13), 10: (2, 13),
            11: (2, 13), 12: (3, 13), 13: (5, 13)}
    hind = {14: (6, 13), 15: (5, 13), 16: (4, 13), 17: (4, 13),
            18: (5, 13), 19: (6, 12), 20: (8, 11), 21: (10, 11)}
    wing = {(x, y) for rows in (fore, hind) for y, (a, b) in rows.items()
            for x in range(a, b + 1)}
    for x, y in wing:
        t = 4 if y <= 8 else 2 if x <= 4 else 3
        img.putpixel((x, y), H(pk[t]))
        img.putpixel((31 - x, y), H(pk[t]))
    for x in range(5, 14):
        img.putpixel((x, 13), H(pk[1]))
        img.putpixel((31 - x, 13), H(pk[1]))
    for x, y in ((7, 9), (6, 10), (7, 10), (8, 10), (7, 11),
                 (8, 16), (9, 16), (8, 17), (9, 17)):
        img.putpixel((x, y), H(PAGE))
        img.putpixel((31 - x, y), H(PAGE))
    body = {(x, y) for y in range(5, 14) for x in (14, 15)}
    body |= {(15, y) for y in range(14, 24)}
    for x, y in body:
        t = 2 if y >= 14 else 3
        img.putpixel((x, y), H(r[t]))
        img.putpixel((31 - x, y), H(r[t]))
    for y in (16, 19, 22):
        img.putpixel((15, y), H(r[1]))
        img.putpixel((16, y), H(r[1]))
    ant = {(14, 4), (13, 3), (12, 2)}
    cells = wing | body | ant
    cells |= {(31 - x, y) for x, y in cells}
    for x, y in contour(cells):
        img.putpixel((x, y), H(r[0]))
    return img


# Hand mirror: head reuses the NUMIS_R9 disc; the glass is that table inset
# 2px on every row (the stock r7 disc pinches the ring to 1px on the diagonal
# rows). Frame tone falls off along the top-left light diagonal, the glint is
# two parallel / slashes clipped to the glass, and the handle stops at row 26
# so the rare pips keep their own band instead of overlapping the shaft.
MIR_C = (16, 11)
MIR_GLASS = (3, 4, 5, 6, 6, 7, 7, 7, 7, 7, 6, 6, 5, 4, 3)
MIR_HANDLE = (14, 18, 21, 26)   # x0, x1, y0, y1


def handmirror(r):
    img, _ = canvas()
    cx, cy = MIR_C
    head = disc(cx, cy, NUMIS_R9)
    glass = disc(cx, cy, MIR_GLASS)
    hx0, hx1, hy0, hy1 = MIR_HANDLE
    handle = {(x, y) for y in range(hy0, hy1 + 1) for x in range(hx0, hx1 + 1)}
    body = head | handle
    shaft = {hx0: 2, hx0 + 1: 4, hx0 + 2: 3, hx0 + 3: 2, hx0 + 4: 1}
    for x, y in body:
        s = (x - cx) + (y - cy)
        if (x, y) in glass:
            img.putpixel((x, y), H("#aacfe3" if s >= 4 else "#cbe6f1"))
        elif (x, y) in head:
            img.putpixel((x, y), H(r[4] if s <= -5 else r[1] if s >= 5 else r[3]))
        else:
            img.putpixel((x, y), H(r[shaft[x]]))
    for x, y in glass:
        dx, dy = x - cx, y - cy
        long_slash = dx + dy in (-2, -1) and -5 <= dy <= 3
        short_slash = dx + dy == 4 and 0 <= dy <= 3
        if long_slash or short_slash:
            img.putpixel((x, y), H("#f2fbff"))
    for x, y in contour(body):
        img.putpixel((x, y), H(r[0]))
    return img


# Appraiser: a balance tipped by a gem on the low pan. Pillar, plinth and pans
# are filled then contour-outlined, with their lit top rows restored after;
# beam, chains and gem are painted explicitly since contour would swallow
# 1-2px features. Beam steps 1 row per 8 columns.
APPR_BEAM = ((4, 11, 10), (12, 19, 9), (20, 27, 8))
APPR_PILLAR_X = (14, 17)
APPR_PANS = ((4, 12), (27, 10))    # (cx, first chain row); left hangs lower
APPR_PAN_HALVES = (3, 3, 2, 1)
APPR_CHAIN_ROWS = 4


def appraiser(r):
    img, _ = canvas()
    cyan = MAT6["cyan"]
    x0, x1 = APPR_PILLAR_X
    mid = (x0 + x1 + 1) // 2
    body = {(x, y) for y in range(5, 23) for x in range(x0, x1 + 1)}
    body |= {(x, 4) for x in range(x0 + 1, x1)}
    body |= {(x, y) for y in (23, 24) for x in range(12, 20)}
    body |= {(x, y) for y in (25, 26) for x in range(9, 23)}
    pan_tops = [(cx, v0 + APPR_CHAIN_ROWS + 2) for cx, v0 in APPR_PANS]
    for cx, top in pan_tops:
        body |= disc(cx, top + 2, APPR_PAN_HALVES)
    tone = {x0: 0, x0 + 1: 4, x0 + 2: 3, x0 + 3: 2}
    for x, y in body:
        t = tone[x] if x0 <= x <= x1 and y < 23 else (3 if x < mid else 2)
        img.putpixel((x, y), H(r[t]))
    for x, y in contour(body):
        img.putpixel((x, y), H(r[0]))
    for x in range(13, 19):
        img.putpixel((x, 23), H(r[5]))
    for x in (10, 11, 20, 21):
        img.putpixel((x, 25), H(r[5]))
    for cx, top in pan_tops:
        for dx in range(-2, 3):
            img.putpixel((cx + dx, top), H(r[5]))
            img.putpixel((cx + dx, top + 1), H(r[2]))
        for dx, t in zip(range(-1, 2), (4, 3, 2)):
            img.putpixel((cx + dx, top + 2), H(r[t]))
    for a, b, y in APPR_BEAM:
        for x in range(a, b + 1):
            img.putpixel((x, y), H(r[4]))
            img.putpixel((x, y + 1), H(r[0]))
    for x, y in ((3, 10), (3, 11), (28, 8), (28, 9)):
        img.putpixel((x, y), H(r[0]))
    img.putpixel((mid - 1, 9), H(r[5]))
    img.putpixel((mid, 9), H(r[5]))
    for cx, v0 in APPR_PANS:
        for i in range(APPR_CHAIN_ROWS):
            img.putpixel((cx, v0 + i), H(r[1]))
        for k in range(2):
            y = v0 + APPR_CHAIN_ROWS + k
            img.putpixel((cx - k - 1, y), H(r[1]))
            img.putpixel((cx + k + 1, y), H(r[1]))
    gx, gy = APPR_PANS[0][0], pan_tops[0][1] - 3
    for dx in range(-1, 2):
        img.putpixel((gx + dx, gy), H(cyan[5]))
    for dx, t in zip(range(-2, 3), (4, 3, 3, 3, 1)):
        img.putpixel((gx + dx, gy + 1), H(cyan[t]))
    for dx, t in zip(range(-1, 2), (2, 1, 0)):
        img.putpixel((gx + dx, gy + 2), H(cyan[t]))
    return img


def pricetag(r):
    # haggler: barter pictogram, brass coin between two opposing swap arrows
    # (teal top bar heads right, red bottom bar heads left, exact 180-degree
    # rotations) w/ a 2-row background gap on each side of the coin.
    img, _ = canvas()
    coin = disc(16, 15, (2, 4, 5, 6, 6, 6, 6, 6, 5, 4, 2))
    for x, y in coin:
        d2 = (x - 14) ** 2 + (y - 13) ** 2
        t = 5 if d2 < 4 else 4 if d2 < 20 else 3 if d2 < 60 else 2
        img.putpixel((x, y), H(r[t]))
    for x, y in contour(disc(16, 15, (1, 3, 4, 4, 4, 4, 4, 3, 1))):
        img.putpixel((x, y), H(r[2]))
    top = {(x, y) for y in (5, 6, 7) for x in range(9, 21)}
    top |= {(x, y) for y, (a, b) in
            {3: (21, 21), 4: (21, 22), 5: (21, 23), 6: (21, 24),
             7: (21, 23), 8: (21, 22), 9: (21, 21)}.items()
            for x in range(a, b + 1)}
    bot = {(31 - x, 30 - y) for x, y in top}
    for arrow, ramp in ((top, MAT6["teal"]), (bot, MAT6["red"])):
        for x, y in arrow:
            img.putpixel((x, y), H(ramp[3] if (x, y - 1) not in arrow
                                   else ramp[2]))
        for x, y in contour(arrow):
            img.putpixel((x, y), H(ramp[0]))
    for x, y in contour(coin):
        img.putpixel((x, y), H(r[0]))
    return img


def anchor(r):
    # Ring, shank, stock, crescent arms with blade flukes. Same top-left light
    # as furnace: dark outline, mid body, lit top/left edge, shadowed
    # bottom/right, specular pixels on the ring and shank.
    img, d = canvas()
    d.rectangle([14, 9, 18, 25], fill=H(r[0]))
    d.rectangle([15, 10, 17, 24], fill=H(r[2]))
    d.line([(15, 10), (15, 24)], fill=H(r[4]), width=1)
    d.line([(17, 10), (17, 24)], fill=H(r[1]), width=1)
    # Crescent as nested ellipses on its own layer: PIL's wide arc breaks at
    # the bottom, and the hole punch must not clear the shank beneath it.
    arms, a = canvas()
    for box, c in [([5, 13, 27, 29], r[0]), ([6, 14, 26, 28], r[1]),
                   ([6, 13, 26, 27], r[2]), ([8, 15, 24, 25], r[4]),
                   ([8, 14, 24, 24], r[0])]:
        a.ellipse(box, fill=H(c))
    a.ellipse([9, 14, 23, 23], fill=(0, 0, 0, 0))
    a.rectangle([0, 0, NAT - 1, 19], fill=(0, 0, 0, 0))
    img.alpha_composite(arms)
    for pts in ([(4, 19), (9, 23), (6, 26)], [(28, 19), (23, 23), (26, 26)]):
        d.polygon(pts, fill=H(r[0]))
    d.polygon([(5, 20), (8, 23), (6, 25)], fill=H(r[2]))
    d.polygon([(27, 20), (24, 23), (26, 25)], fill=H(r[1]))
    d.rectangle([9, 12, 23, 15], fill=H(r[0]))
    d.rectangle([10, 13, 22, 14], fill=H(r[2]))
    d.line([(10, 13), (22, 13)], fill=H(r[4]), width=1)
    d.line([(10, 14), (22, 14)], fill=H(r[1]), width=1)
    for x in (8, 24):
        d.line([(x, 13), (x, 14)], fill=H(r[0]), width=1)
    d.ellipse([12, 1, 20, 9], outline=H(r[0]), width=2)
    d.ellipse([13, 2, 19, 8], outline=H(r[2]), width=1)
    img.putpixel((14, 3), H(r[5]))
    img.putpixel((15, 10), H(r[5]))
    img.putpixel((15, 11), H(r[5]))
    return img


def whetstone(r):
    # a honing block in 3/4 oblique: a lit top face over darker front and right
    # faces for volume, with a shallow worn groove running the length of the top
    # (concave — dark channel, lit far lip) that marks it as a sharpening stone.
    img, d = canvas()
    top = [(3, 19), (24, 23), (30, 16), (9, 12)]
    d.polygon([(3, 19), (24, 23), (24, 26), (3, 22)], fill=H(r[1]))    # front face
    d.polygon([(24, 23), (30, 16), (30, 19), (24, 26)], fill=H(r[0]))  # right face
    d.polygon(top, fill=H(r[3]))                                       # top face
    d.polygon([(7, 17), (25, 21), (27, 20), (9, 16)], fill=H(r[2]))    # honing groove channel
    d.line([(9, 16), (27, 20)], fill=H(r[4]), width=1)               # far lip, lit
    d.line([(7, 18), (25, 22)], fill=H(r[1]), width=1)               # near lip, shaded
    d.line([(9, 12), (30, 16)], fill=H(r[4]), width=1)               # lit back edge
    d.line([(3, 19), (9, 12)], fill=H(r[4]), width=1)               # lit left edge
    return img


def foundation(r):
    # Two courses in running bond on a mortar bed. Every brick carries the
    # same top-left light: lit top and left edges, shadowed bottom and right,
    # a 2px specular at the top-left corner. No block-level bevel.
    img, d = canvas()
    d.rectangle([3, 6, 28, 24], fill=H(r[0]))
    d.rectangle([4, 7, 27, 23], fill=H(r[1]))
    for x0, y0, x1, y1 in [(4, 7, 14, 14), (16, 7, 27, 14),
                           (4, 16, 8, 23), (10, 16, 20, 23), (22, 16, 27, 23)]:
        d.rectangle([x0, y0, x1, y1], fill=H(r[3]))
        d.line([(x0, y1), (x1, y1)], fill=H(r[2]), width=1)
        d.line([(x1, y0), (x1, y1)], fill=H(r[2]), width=1)
        d.line([(x0, y0), (x1 - 1, y0)], fill=H(r[4]), width=1)
        d.line([(x0, y0), (x0, y1 - 1)], fill=H(r[4]), width=1)
        d.line([(x0, y0), (x0 + 1, y0)], fill=H(r[5]), width=1)
    return img


def staccato(r):
    # detached short notes: two staggered heads, short stems, articulation dots
    img, d = canvas()
    for hx, hy in [(10, 20), (21, 16)]:
        d.ellipse([hx - 4, hy - 3, hx + 4, hy + 3], fill=H(r[0]))
        d.ellipse([hx - 3, hy - 2, hx + 3, hy + 2], fill=H(r[2]))
        d.rectangle([hx + 3, hy - 13, hx + 5, hy], fill=H(r[0]))   # short stem
        d.rectangle([hx + 3, hy - 13, hx + 4, hy], fill=H(r[3]))
        d.ellipse([hx - 1, hy - 8, hx + 1, hy - 6], fill=H(r[5]))  # staccato dot
        img.putpixel((hx - 2, hy - 1), H(r[5]))
    return img


SHAPES32 = {"coin": coin, "gem": gem, "brick": brick, "book": book,
            "note": note, "flask": flask, "drop": drop, "dice": dice}

OBJECTS = {"hoard": coin_stack, "merchant": money_bag, "tycoon": crown,
           "miser": vault, "taxman": ledger, "coupon": banknote,
           "goldrush": nuggets, "speculator": ingot,
           "aria": songnote, "cascade": cascade, "diphthong": bubble,
           "sonorant": tuningfork, "chorus": trio, "cadence": metronome,
           "consonance": chord, "staccato": staccato,
           "polysyllable": open_book, "lexicographer": dictionary,
           "novella": novella,
           "philosopher": tome, "keystone": keystone, "ballast": pigweight,
           "momentum": boulder, "foundation": foundation,
           "gambit": cards, "glasscannon": hourglass, "smelter": furnace,
           "crucible": crucible_cup,
           "temperance": chalice, "hermit": lantern, "prism": prism,
           "ascetic": bowl, "numismatist": numismatist,
           "marathoner": boot, "tally": tally, "collector": album,
           "prospector": pickaxe, "vein": orevein, "symmetry": butterfly,
           "mirror": handmirror, "appraiser": appraiser, "haggler": pricetag,
           "anchor": anchor, "whetstone": whetstone}

def paint(img, rows, key, x0, y0):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x0 + dx, y0 + dy), key[ch])


# Bookend: three spines between two L brackets on a plate. Each spine has a
# page-edge top row so the books read as blocks; the plate is a lit top face
# over a front face, with the spines' shadow cut into the top face.
BOOK_A = ("aaaaa", "appfa") + ("aedba",) * 5 + ("aecba",) * 2 + ("aedba",) * 6
BOOK_B = ("aaaaaa", "apppfa") + ("aeddba",) * 4 + ("aeccba",) * 2 + ("aeddba",) * 5
BOOK_C = ("aaaaa", "appfa") + ("aedba",) * 3 + ("aecba",) * 2 + ("aedba",) * 7
BRACKET_L = ("0000", "0540") + ("0430",) * 14
BRACKET_R = ("0000", "0430") + ("0320",) * 14
PLATE = ("0" + "5" * 26 + "0", "0" + "4" * 26 + "0", "0" + "2" * 26 + "0", "0" * 28)


def bookend(r):
    img, _ = canvas()
    book, chalk = MAT6["book"], MAT6["chalk"]
    key = {str(i): H(r[i]) for i in range(STEPS)}
    key.update({c: H(book[i]) for i, c in enumerate("abcdef")})
    key.update({"p": H(chalk[4]), "f": H(chalk[2])})
    paint(img, PLATE, key, 2, 23)
    paint(img, BRACKET_L, key, 2, 7)
    paint(img, BRACKET_R, key, 26, 7)
    paint(img, BOOK_A, key, 7, 8)
    paint(img, BOOK_B, key, 13, 10)
    paint(img, BOOK_C, key, 20, 9)
    for x in range(7, 25):
        img.putpixel((x, 23), key["3"])
    return img


# Bullhorn: cone half-heights per column (2-2-3 rhythm), bell mouth as a
# rounded ring over a dark throat, grip under the cone, two sound arcs.
HORN_HALF = (2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10)
HORN_BAND = "5443332221"
BELL = (
    ".00.",
    "0110",
    "5110",
    "5110",
    "5110",
    "5110",
    "5110",
    "5110",
    "5110",
    "5120",
    "4120",
    "4120",
    "4120",
    "4120",
    "4220",
    "4220",
    "4220",
    "3220",
    "3220",
    "3220",
    "0220",
    ".00.",
)
GRIP = ("0000",) + ("0320",) * 6 + ("0000",)


def bullhorn(r):
    img, _ = canvas()
    key = {str(i): H(r[i]) for i in range(STEPS)}
    for i, hh in enumerate(HORN_HALF):
        x = 4 + i
        top, bot = 14 - hh, 13 + hh
        for y in range(top, bot + 1):
            t = HORN_BAND[(y - top) * (len(HORN_BAND) - 1) // (bot - top)]
            img.putpixel((x, y), key[t])
        img.putpixel((x, top), key["0"])
        img.putpixel((x, bot), key["0"])
    for y in range(12, 16):
        img.putpixel((4, y), key["0"])
    paint(img, BELL, key, 23, 3)
    paint(img, GRIP, key, 8, 18)
    for y in range(10, 18):
        img.putpixel((28, y), key["0"])
    for y in range(7, 21):
        img.putpixel((30, y), key["0"])
    for x, y in ((27, 9), (27, 18), (29, 6), (29, 21)):
        img.putpixel((x, y), key["0"])
    return img


# Quill on a 1:1 diagonal: vane half-widths per row either side of a 2px
# rachis (dark + lit), a barb notch every third row on the outer edge, a
# silver nib, and a cursive ink stroke under it.
VANE_L = (1, 3, 5, 6, 7, 7, 7, 7, 6, 6, 5, 5, 4, 3, 3, 2, 1)
VANE_R = (1, 2, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0)
NIB = ("SS.", ".Ss", "..i")
STROKE = ((7, 25), (8, 25), (9, 24), (10, 23), (11, 23), (12, 24), (13, 25),
          (14, 25), (15, 24), (16, 23), (17, 23), (18, 24), (19, 25), (20, 25),
          (21, 24), (22, 23), (23, 23), (24, 24), (25, 25), (26, 25))


def quill(r):
    img, _ = canvas()
    key = {str(i): H(r[i]) for i in range(STEPS)}
    ink, silver = MAT6["blue"], MAT6["silver"]
    key.update({"i": H(ink[0]), "s": H(silver[2]), "S": H(silver[4])})
    for k, (wl, wr) in enumerate(zip(VANE_L, VANE_R)):
        y = 1 + k
        xs = 27 - k
        notch = 1 if k % 3 == 2 else 0
        for x in range(xs - wl + notch, xs + wr + 1):
            img.putpixel((x, y), key["4" if x < xs else "3"])
        img.putpixel((xs - wl + notch, y), key["0"])
        img.putpixel((xs + wr, y), key["0"])
        img.putpixel((xs, y), key["1"])
        if wr:
            img.putpixel((xs + 1, y), key["5"])
    for k in range(17, 21):
        y = 1 + k
        xs = 27 - k
        img.putpixel((xs - 1, y), key["0"])
        img.putpixel((xs, y), key["1"])
        img.putpixel((xs + 1, y), key["0"])
    paint(img, NIB, key, 4, 22)
    for x, y in STROKE:
        img.putpixel((x, y), key["i"])
    return img


OBJECTS.update({"bookend": bookend, "vowelMult": bullhorn, "longhand": quill})

# Per-relic material override where the shape's family colour fights the object
# read. A metronome is wood, so the pink sound-family ramp made it shapeless.
# The starters have no SHAPE row, so they name their material here.
OBJ_MATERIAL = {"cadence": "book", "collector": "leather",
                "bookend": "silver", "vowelMult": "pink", "longhand": "bone"}


def shaded_selout(img, r):
    """Shaded selective outline: a silhouette-edge pixel already in the ramp's
    darkest tone lifts one step where the edge faces the light (top/left) and
    stays darkest where it faces away, so the contour carries the light
    direction instead of reading as a flat trace. Pixels that are not outline
    (page edges, rim lines, thin features) are left alone."""
    px = img.load()
    dark, lit = H(r[0]), H(r[1])
    lifts = []
    for y in range(NAT):
        for x in range(NAT):
            if px[x, y] != dark:
                continue
            up = y == 0 or px[x, y - 1][3] == 0
            left = x == 0 or px[x - 1, y][3] == 0
            down = y == NAT - 1 or px[x, y + 1][3] == 0
            right = x == NAT - 1 or px[x + 1, y][3] == 0
            if (up or left) and not (down or right):
                lifts.append((x, y))
    for x, y in lifts:
        px[x, y] = lit


def tier_pips(img, rarity):
    d = ImageDraw.Draw(img)
    rank, col = PIP.get(rarity, PIP["common"])
    sx = (NAT - (rank * 5 - 1)) // 2
    for k in range(rank):
        x = sx + k * 5
        d.rectangle([x, 27, x + 3, 30], fill=H(col))


def main():
    roster = read_roster()
    out_dir = os.path.join(ROOT, "design", "sprites32")
    os.makedirs(out_dir, exist_ok=True)

    ported = 0
    cells = []
    for rid, rarity in roster:
        shp = SHAPE.get(rid, "coin")
        fn = OBJECTS.get(rid) or SHAPES32.get(shp)
        if fn:
            ramp6 = MAT6[OBJ_MATERIAL.get(rid) or MATERIAL.get(shp, "gold")]
            native = fn(ramp6)
            shaded_selout(native, ramp6)
            tier_pips(native, rarity)
            scaled = native.resize((CELL, CELL), Image.NEAREST)
            scaled.save(os.path.join(out_dir, rid + ".png"))
            cells.append((rid, scaled, True))
            ported += 1
        else:
            old = os.path.join(ROOT, "design", "sprites", rid + ".png")
            cells.append((rid, Image.open(old).convert("RGBA").resize(
                (CELL, CELL), Image.NEAREST), False))

    cols = 8
    margin, gap, label_h = 20, 12, 18
    rows = (len(cells) + cols - 1) // cols
    w = margin * 2 + cols * CELL + (cols - 1) * gap
    h = margin * 2 + label_h + rows * (CELL + label_h + gap)
    sheet = Image.new("RGBA", (w, h), H("#2b2822"))
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, margin),
              f"HI-BIT PORT 32px  ({ported}/{len(cells)} ported; rest are 16px scaled)",
              fill=H("#f4f1ea"))
    y0 = margin + label_h
    for i, (rid, im, is_port) in enumerate(cells):
        col, row = i % cols, i // cols
        x = margin + col * (CELL + gap)
        y = y0 + row * (CELL + label_h + gap)
        sheet.alpha_composite(im, (x, y))
        draw.text((x + 2, y + CELL), rid + ("" if is_port else "  ·16"),
                  fill=H("#d8d0c0"))
    out = os.path.join(ROOT, "design", "hibit-sheet.png")
    sheet.convert("RGB").save(out)
    print(out, f"{ported}/{len(cells)} ported")


if __name__ == "__main__":
    main()
