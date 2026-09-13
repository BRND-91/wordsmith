"""Full Wordsmith sprite generator: every relic (roster read from src/relics.js so
the set can't drift from the game), the six bosses, and the letter/curse tiles,
all authored at 16px native from one indexed palette and integer-scaled. Emits a
contact sheet plus one PNG per sprite under design/sprites/."""

import os
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NATIVE = 16
SCALE = 6
CELL = NATIVE * SCALE
GAP = 10
MARGIN = 20
LABEL_H = 18


def rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


PAL = {
    "paper": "#f4f1ea", "light": "#d8d0c0", "mid": "#6b6459",
    "dark": "#3a352c", "ink": "#1c1a17",
    "tile_hi": "#efe7d2", "tile": "#e2d6b8", "tile_lo": "#b8a67e",
    "st_lo": "#2b3a52", "st": "#48607f", "st_hi": "#7c95b0", "st_hl": "#b9c9dc",
    "gr_lo": "#1c4d20", "gr": "#2e7d32", "gr_hi": "#5cae52", "gr_hl": "#7ad17f",
    "pur_lo": "#2a1e5c", "pur": "#4b3aa0", "pur_hi": "#7a5cff", "pur_hl": "#b7a4ff",
    "g_lo": "#6b3d1f", "g": "#b06a24", "g_hi": "#e0a53a", "g_hl": "#f4d67a",
    "rd": "#b3261e", "rd_hi": "#ff6b5e",
    "stone_lo": "#4a3f33", "stone": "#766a54", "stone_hi": "#a89a7c", "stone_hl": "#cabfa0",
    "bk_lo": "#5a2b25", "bk": "#8f3f34", "bk_hi": "#c25f4e", "bk_hl": "#e08a78",
    "te_lo": "#10403f", "te": "#1d6f6b", "te_hi": "#35a89f", "te_hl": "#6fd8cd",
    "cy_lo": "#0e3a5a", "cy": "#1f6f9e", "cy_hi": "#43a7d6", "cy_hl": "#8fd6f2",
    "pk_lo": "#5a1f45", "pk": "#9e2f77", "pk_hi": "#d64fa7", "pk_hl": "#f28fd0",
    "sv_lo": "#3a4048", "sv": "#6b737d", "sv_hi": "#a3abb5", "sv_hl": "#d7dde3",
    "br_lo": "#5a4715", "br": "#8f7222", "br_hi": "#c2a03a", "br_hl": "#e0c76f",
    "bo_lo": "#8f8a6f", "bo": "#c9c3a0", "bo_hi": "#e8e3c4", "bo_hl": "#f6f2dd",
    "bl_lo": "#12345c", "bl": "#274f8f", "bl_hi": "#4a7fd1", "bl_hl": "#8fb4f0",
    "le_lo": "#4a2f1a", "le": "#7a4a24", "le_hi": "#a86e34", "le_hl": "#cf9a5a",
}

# archetype material -> 4-step hue-shifted ramp (lo, mid, hi, highlight). Colour
# carries what the object IS; rarity is the pip count drawn by tier_pips, so two
# relics of the same tier no longer read as one palette.
MAT_RAMPS = {
    "stone": ["stone_lo", "stone", "stone_hi", "stone_hl"],
    "book": ["bk_lo", "bk", "bk_hi", "bk_hl"],
    "gold": ["g_lo", "g", "g_hi", "g_hl"],
    "teal": ["te_lo", "te", "te_hi", "te_hl"],
    "cyan": ["cy_lo", "cy", "cy_hi", "cy_hl"],
    "pink": ["pk_lo", "pk", "pk_hi", "pk_hl"],
    "silver": ["sv_lo", "sv", "sv_hi", "sv_hl"],
    "brass": ["br_lo", "br", "br_hi", "br_hl"],
    "bone": ["bo_lo", "bo", "bo_hi", "bo_hl"],
    "blue": ["bl_lo", "bl", "bl_hi", "bl_hl"],
    "leather": ["le_lo", "le", "le_hi", "le_hl"],
    "chalk": ["mid", "light", "paper", "paper"],
}

# primitive shape -> its material
MATERIAL = {
    "brick": "stone", "book": "book", "coin": "gold", "gem": "cyan",
    "note": "pink", "flask": "teal", "dice": "bone", "scale": "brass",
    "mirror": "silver", "pick": "brass", "drop": "blue", "tally": "chalk",
    "blade": "silver", "anchor": "silver", "boot": "leather",
}

# rarity -> (pip count, pip colour). Count is the colourblind-safe signal.
TIER = {
    "common": (1, "st_hl"), "uncommon": (2, "gr_hl"),
    "rare": (3, "pur_hl"), "legendary": (4, "g_hl"),
}

# id -> primitive shape. Grouped by the relic's archetype in relics.js.
SHAPE = {
    "ballast": "brick", "foundation": "brick", "keystone": "brick",
    "anchor": "anchor", "momentum": "brick",
    "polysyllable": "book", "novella": "book", "lexicographer": "book",
    "philosopher": "book", "marathoner": "boot",
    "numismatist": "coin", "merchant": "coin", "coupon": "coin",
    "taxman": "coin", "miser": "coin", "tycoon": "coin", "goldrush": "coin",
    "hoard": "coin", "highroller": "dice", "speculator": "coin",
    "prospector": "pick", "vein": "pick",
    "smelter": "flask", "crucible": "flask", "temperance": "flask",
    "ascetic": "drop",
    "aria": "note", "cascade": "note", "diphthong": "note", "sonorant": "note",
    "chorus": "note", "staccato": "note", "cadence": "note", "consonance": "note",
    "symmetry": "mirror", "mirror": "mirror",
    "jeweler": "gem", "prism": "gem", "appraiser": "scale",
    "gambit": "dice", "glasscannon": "dice",
    "haggler": "scale", "hermit": "drop", "tally": "tally", "collector": "tally",
    "whetstone": "blade",
}

# shade tokens: o ink outline, d/m/h/l ramp[0..3], . transparent
PRIMS = {
    "brick": [
        "oooooooooo", "ohhmhhhmho", "ohhmhhhmho", "ommmmmmmmo",
        "omhhhmhhho", "omhhhmhhho", "ommmmmmmmo", "ohhmhhhmho",
        "ohhmhhhmho", "oooooooooo",
    ],
    "book": [
        ".oooooooo.", "ohhhhhhhho", "ohllllllho", "ohlhhhhlho",
        "ohllllllho", "ohlhhhhlho", "ohllllllho", "ohhhhhhhho",
        "ommmmmmmmo", ".oooooooo.",
    ],
    "coin": [
        "..oooooo..", ".ohhhhhho.", "ohhllllhho", "ohlhhhhlho",
        "ohlhllhlho", "ohlhhhhlho", "ohhllllhho", ".ohhhhhho.",
        "..oooooo..",
    ],
    "gem": [
        "..oooooo..", ".ollllllo.", "ohhhhhhhho", "ohmmmmmmho",
        ".ohmmmmho.", "..ohmmho..", "...ohho...", "....oo....",
    ],
    "note": [
        ".......oo.", "......ohho", "......ohho", "......ohho",
        ".oo...ohho", "ohho..ohho", "ohho.ommmo", "ommmommmo.",
        ".ommmmmo..", "..oooo....",
    ],
    "flask": [
        "...oooo...", "...ohho...", "...ohho...", "..ohhho...",
        ".ohmmmho..", "ohmmmmmho.", "ohmllmmho.", "ohmmmmmho.",
        ".ohmmmho..", "..oooooo..",
    ],
    "dice": [
        "oooooooooo", "ohhhhhhhho", "ohohhhhoho", "ohhhhhhhho",
        "ohhhohhhho", "ohhhhhhhho", "ohohhhhoho", "ohhhhhhhho",
        "ommmmmmmmo", "oooooooooo",
    ],
    "scale": [
        "....o.....", "..ooooo...", ".ohhhhho..", "o..oho..o.",
        "ho.oho.oh.", "oho.o.oho.", ".ooooooo..", "....o.....",
        "..ooooo...",
    ],
    "mirror": [
        "....oo....", "...ohho...", "..ohmho...", ".ohmmho...",
        "ohmmmho.o.", "ohmmmhooho", ".ohmhoohho", "..ohooohho",
        "...oohhho.", "....oooo..",
    ],
    "pick": [
        "o........o", ".oo....oo.", "..ohhhho..", "...ohho...",
        "....oho...", "....oho...", "....oho...", "....oho...",
        "....ooo...",
    ],
    "boot": [
        ".oooo.....", ".ohho.....", ".ohho.....", ".ohho.....",
        ".ohhooo...", ".ohhhhho..", ".ohmmmhho.", ".ohhhhhhho",
        ".ommmmmmmo", ".ooooooooo",
    ],
    "drop": [
        "....oo....", "....oo....", "...ohho...", "..ohhho...",
        "..ohmho...", ".ohmmmho..", ".ohmlmho..", ".ohmmmho..",
        "..ohmho...", "...oooo...",
    ],
    "tally": [
        "..........", "o.o.o..o..", "o.o.o./o..", "o.o.o/.o..",
        "o.o.o..o..", "o.o.oo.o..", "o.o.o..o..", "..........",
    ],
    "blade": [
        ".......oo.", "......ohho", ".....ohho.", "....ohho..",
        "...ohho...", "..ohho....", ".ohho.....", "ohho......",
        "oho.......", "oo........",
    ],
    "anchor": [
        "....oo....", "...ohho...", "...ohho...", ".oooooooo.",
        "...ohho...", "o..ohho..o", "oh.ohho.ho", "ohoohhoooho",
        ".ohhhhhho.", "..oooooo..",
    ],
}

GLYPHS = {
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
}


def cell():
    return Image.new("RGBA", (NATIVE, NATIVE), (0, 0, 0, 0))


def put(img, x, y, key):
    if key and 0 <= x < NATIVE and 0 <= y < NATIVE:
        img.putpixel((x, y), rgb(PAL[key]) + (255,))


def tier_pips(img, rarity):
    rank, key = TIER.get(rarity, TIER["common"])
    sx = (NATIVE - (3 * rank - 1)) // 2
    for k in range(rank):
        for dx in (0, 1):
            for dy in (13, 14):
                put(img, sx + k * 3 + dx, dy, key)


def prim(name, ramp):
    rows = PRIMS[name]
    legend = {"o": "ink", "d": ramp[0], "m": ramp[1], "h": ramp[2], "l": ramp[3]}
    w = max(len(r) for r in rows)
    ox, oy = (NATIVE - w) // 2, (NATIVE - len(rows)) // 2
    img = cell()
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch == "/":
                put(img, ox + c, oy + r, "rd_hi")
            elif ch in legend:
                put(img, ox + c, oy + r, legend[ch])
    return img


def tile(letter):
    img = cell()
    ImageDraw.Draw(img).rectangle([1, 1, 14, 14], fill=rgb(PAL["tile"]) + (255,))
    for i in range(1, 15):
        put(img, i, 1, "tile_hi"); put(img, 1, i, "tile_hi")
        put(img, i, 14, "tile_lo"); put(img, 14, i, "tile_lo")
    for r, row in enumerate(GLYPHS[letter]):
        for c, ch in enumerate(row):
            if ch == "1":
                put(img, 6 + c, 4 + r, "ink")
    for x in (11, 12, 13):
        for y in (11, 12, 13):
            put(img, x, y, "st")
    put(img, 11, 11, "st_hl")
    return img


def curse_tile():
    img = cell()
    ImageDraw.Draw(img).rectangle([1, 1, 14, 14], fill=rgb(PAL["mid"]) + (255,))
    for i in range(1, 15):
        put(img, i, 1, "dark"); put(img, 1, i, "dark")
        put(img, i, 14, "ink"); put(img, 14, i, "ink")
    for r, row in enumerate(["..1..", "1.1.1", ".111.", "1.1.1", "..1.."]):
        for c, ch in enumerate(row):
            if ch == "1":
                put(img, 6 + c, 5 + r, "rd_hi")
    return img


def boss_sigil(kind):
    img = cell()
    if kind == "minLength":
        rows = ["oooooooooooooo", "oLLLLLLLLLLLLo", "oLtLtLtLtLtLLo",
                "oLtLtLtLtLtLLo", "oLLLLLLLLLLLLo", "oooooooooooooo"]
        legend = {"o": "ink", "L": "st_hl", "t": "st_lo"}
    elif kind == "maxOneVowel":
        rows = GLYPHS["A"]
        legend = None
    elif kind == "noRepeatLong":
        rows = ["oooo..oooo", "oLLo..oLLo", "oLLo//oLLo", "oLLo//oLLo",
                "oLLo..oLLo", "oooo..oooo"]
        legend = {"o": "ink", "L": "st_hi"}
    elif kind == "vowelBlight":
        rows = ["..AA..", ".A//A.", "A////A", "A////A", ".A//A.", "..AA.."]
        legend = {"A": "gr_lo"}
    elif kind == "flint":
        rows = ["..oooo..", ".oLLLLo.", "oLLooddo", "oLLooddo",
                "oddoodLo", "oddoodLo", ".oddddo.", "..oooo.."]
        legend = {"o": "ink", "L": "st_hl", "d": "rd"}
    else:  # noRepeatShape
        rows = ["ooo...ooo.", "oho..ohho.", "oho.ohhho.", "ooo//ohho.",
                "..//.ohho.", ".//..oooo."]
        legend = {"o": "ink", "h": "pur_hi"}
    w = max(len(r) for r in rows)
    ox, oy = (NATIVE - w) // 2, (NATIVE - len(rows)) // 2
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch == "1":
                put(img, ox + c, oy + r, "paper")
            elif ch == "/":
                put(img, ox + c, oy + r, "rd_hi")
            elif legend and ch in legend:
                put(img, ox + c, oy + r, legend[ch])
    return img


def read_roster():
    src = open(os.path.join(ROOT, "src", "relics.js")).read()
    out = []
    # POOL keys, not `id:` fields: the three starters spread BASE and carry no
    # id literal of their own.
    for m in re.finditer(r"^  ([A-Za-z]+): \{", src, re.M):
        tail = src[m.start():m.start() + 400]
        rm = re.search(r"rarity:\s*([A-Za-z_]+)", tail)
        tier = rm.group(1).lower().strip("'\"") if rm else "common"
        out.append((m.group(1), tier))
    return out


def scaled(img):
    return img.resize((CELL, CELL), Image.NEAREST)


def main():
    roster = read_roster()
    sprites_dir = os.path.join(ROOT, "design", "sprites")
    os.makedirs(sprites_dir, exist_ok=True)

    def save(img, name):
        img.convert("RGBA").resize((CELL, CELL), Image.NEAREST).save(
            os.path.join(sprites_dir, name + ".png"))

    tiles = [("W", tile("W")), ("O", tile("O")), ("R", tile("R")),
             ("D", tile("D")), ("curse", curse_tile())]
    bosses = [(b, boss_sigil(b)) for b in
              ("minLength", "maxOneVowel", "noRepeatLong",
               "vowelBlight", "flint", "noRepeatShape")]
    relics = []
    for rid, rarity in roster:
        shp = SHAPE.get(rid, "coin")
        spr = prim(shp, MAT_RAMPS[MATERIAL.get(shp, "gold")])
        tier_pips(spr, rarity)
        relics.append((rid, spr))
        save(spr, rid)
    for name, spr in tiles + bosses:
        save(spr, name)

    cols = 8
    rows_needed = (len(relics) + cols - 1) // cols
    width = MARGIN * 2 + cols * CELL + (cols - 1) * GAP
    band = LABEL_H + CELL + GAP
    height = MARGIN * 2 + LABEL_H * 3 + (2 + rows_needed) * band
    sheet = Image.new("RGBA", (width, height), rgb(PAL["dark"]) + (255,))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSansMono.ttf", 13)
        head = ImageFont.truetype("DejaVuSansMono.ttf", 15)
    except OSError:
        font = head = ImageFont.load_default()

    def strip(title, items, y):
        draw.text((MARGIN, y), title, fill=rgb(PAL["paper"]), font=head)
        cy = y + LABEL_H
        for n, (name, spr) in enumerate(items):
            x = MARGIN + n * (CELL + GAP)
            sheet.alpha_composite(scaled(spr), (x, cy))
            draw.text((x + 2, cy + CELL - 15), name, fill=rgb(PAL["light"]), font=font)
        return cy + CELL + GAP

    y = MARGIN
    y = strip("TILES + curse", tiles, y)
    y = strip("BOSS SIGILS", bosses, y)
    draw.text((MARGIN, y), "RELICS (colour = material, bottom pips = rarity: 1 common..4 legendary)",
              fill=rgb(PAL["paper"]), font=head)
    y += LABEL_H
    for n, (name, spr) in enumerate(relics):
        col, row = n % cols, n // cols
        x = MARGIN + col * (CELL + GAP)
        cy = y + row * band
        sheet.alpha_composite(scaled(spr), (x, cy))
        draw.text((x + 2, cy + CELL - 15), name, fill=rgb(PAL["light"]), font=font)

    out = os.path.join(ROOT, "design", "asset-sheet.png")
    sheet.convert("RGB").save(out)
    print(out, f"{len(relics)} relics, {len(bosses)} bosses, {len(tiles)} tiles")


if __name__ == "__main__":
    main()
