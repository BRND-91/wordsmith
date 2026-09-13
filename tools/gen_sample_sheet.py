"""Renders a pixel-art direction sample for Wordsmith: the master palette ramps,
letter tiles, a curse tile, tiered relic icons, and boss sigils. Everything is
authored at 16px native and scaled by integer nearest-neighbour so the grid stays
square, which is the point of the medium a text-to-image model can't hold."""

from PIL import Image, ImageDraw, ImageFont

NATIVE = 16
SCALE = 8
CELL = NATIVE * SCALE
GAP = 16
MARGIN = 20
LABEL_H = 22
SWATCH_W = 32


def rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# Indexed master palette. Each ramp shifts hue+saturation across value, never
# brightness alone, so shadows stay coloured instead of muddy grey.
PAL = {
    "paper": "#f4f1ea", "light": "#d8d0c0", "mid": "#6b6459",
    "dark": "#3a352c", "ink": "#1c1a17",
    "tile_hi": "#efe7d2", "tile": "#e2d6b8", "tile_lo": "#b8a67e",
    "st_lo": "#2b3a52", "st": "#48607f", "st_hi": "#7c95b0", "st_hl": "#b9c9dc",
    "pur_lo": "#2a1e5c", "pur": "#4b3aa0", "pur_hi": "#7a5cff", "pur_hl": "#b7a4ff",
    "g_lo": "#6b3d1f", "g": "#b06a24", "g_hi": "#e0a53a", "g_hl": "#f4d67a",
    "gr": "#2e7d32", "gr_hi": "#7ad17f", "rd": "#b3261e", "rd_hi": "#ff6b5e",
}

RAMPS = [
    ("neutral", ["ink", "dark", "mid", "light", "paper"]),
    ("steel / common", ["st_lo", "st", "st_hi", "st_hl"]),
    ("accent / rare", ["pur_lo", "pur", "pur_hi", "pur_hl"]),
    ("gold / legendary", ["g_lo", "g", "g_hi", "g_hl"]),
    ("good / bad", ["gr", "gr_hi", "rd", "rd_hi"]),
]

GLYPHS = {
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
}


def cell():
    return Image.new("RGBA", (NATIVE, NATIVE), (0, 0, 0, 0))


def put(img, x, y, color):
    if 0 <= x < NATIVE and 0 <= y < NATIVE:
        img.putpixel((x, y), rgb(PAL[color]) + (255,))


def sprite_from(rows, legend):
    img = cell()
    oy = (NATIVE - len(rows)) // 2
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch in legend:
                put(img, c, oy + r, legend[ch])
    return img


def tile(letter):
    img = cell()
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, 14, 14], fill=rgb(PAL["tile"]) + (255,))
    for i in range(1, 15):  # bevel: light top/left, dark bottom/right
        put(img, i, 1, "tile_hi"); put(img, 1, i, "tile_hi")
        put(img, i, 14, "tile_lo"); put(img, 14, i, "tile_lo")
    g = GLYPHS[letter]
    for r, row in enumerate(g):
        for c, ch in enumerate(row):
            if ch == "1":
                put(img, 6 + c, 4 + r, "ink")
    for x in (11, 12, 13):  # steel pip, bottom-right, square read
        for y in (11, 12, 13):
            put(img, x, y, "st")
    put(img, 11, 11, "st_hl")
    return img


def curse_tile():
    img = cell()
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, 14, 14], fill=rgb(PAL["mid"]) + (255,))  # dead, desaturated
    for i in range(1, 15):
        put(img, i, 1, "dark"); put(img, 1, i, "dark")
        put(img, i, 14, "ink"); put(img, 14, i, "ink")
    star = ["..1..", "1.1.1", ".111.", "1.1.1", "..1.."]
    for r, row in enumerate(star):
        for c, ch in enumerate(row):
            if ch == "1":
                put(img, 6 + c, 5 + r, "rd_hi")
    return img


def coin():  # common relic, steel ramp
    rows = [
        "....dddd....", "..ddHHHHdd..", ".dHHssssHHd.", ".dHsSSSSsHd.",
        "dHsS1  1SsHd", "dHsS1  1SsHd", "dHsSSSSSSsHd", ".dHsSSSSsHd.",
        ".dHHssssHHd.", "..ddHHHHdd..", "....dddd....",
    ]
    legend = {"d": "st_lo", "H": "st", "s": "st_hi", "S": "st_hl", "1": "st_lo", " ": None}
    return pad(rows, legend)


def gem():  # rare relic, purple ramp
    rows = [
        "....LLLL....", "...LhhhhL...", "..LhHHHHhL..", ".LhHmmmmHhL.",
        ".LHmmmmmmHL.", "..LHmmmmHL..", "...LHmmHL...", "....LHHL....",
        ".....LL.....",
    ]
    legend = {"L": "pur_hl", "h": "pur_hi", "H": "pur", "m": "pur_lo"}
    return pad(rows, legend)


def crown():  # legendary relic, gold ramp
    rows = [
        "h..h..h..h", "hh.hh.hh.hh", "hHhhHhhHhHh", "hHHHHHHHHHh",
        "hHggggggHHh", "hgggggggggh", "hgGGGGGGGgh", "hhhhhhhhhhh",
    ]
    legend = {"h": "g_hl", "H": "g_hi", "g": "g", "G": "g_lo"}
    return pad(rows, legend)


def boss_ruler():  # minLength: a measuring bar with ticks
    rows = [
        "iiiiiiiiiiiiii", "iLLLLLLLLLLLLi", "iLtLtLtLtLtLLi",
        "iLtLtLtLtLtLLi", "iLLLLLLLLLLLLi", "iiiiiiiiiiiiii",
    ]
    legend = {"i": "ink", "L": "st_hl", "t": "st_lo"}
    return pad(rows, legend)


def boss_novowel():  # maxOneVowel: a struck-through A
    rows = [
        "....AA....", "...AAAA...", "..AA..AA..", "..AAAAAA..",
        "..AA..AA..", "..AA..AA..", "rrrrrrrrrr",
    ]
    legend = {"A": "paper", "r": "rd_hi"}
    return pad(rows, legend)


def pad(rows, legend):
    w = max(len(r) for r in rows)
    ox = (NATIVE - w) // 2
    img = cell()
    oy = (NATIVE - len(rows)) // 2
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch in legend and legend[ch] is not None:
                put(img, ox + c, oy + r, legend[ch])
    return img


def scaled(img):
    return img.resize((CELL, CELL), Image.NEAREST)


def swatch(color):
    return Image.new("RGBA", (SWATCH_W, CELL), rgb(PAL[color]) + (255,))


ROWS = [
    ("MASTER PALETTE — hue-shifted ramps", "palette", RAMPS),
    ("LETTER TILES + curse (steel = square read)", "cells",
     [("W", tile("W")), ("O", tile("O")), ("R", tile("R")),
      ("D", tile("D")), ("curse", curse_tile())]),
    ("RELIC TIERS + boss sigils", "cells",
     [("common", coin()), ("rare", gem()), ("legendary", crown()),
      ("minLen", boss_ruler()), ("1-vowel", boss_novowel())]),
]


def main():
    cols = 5
    width = MARGIN * 2 + cols * CELL + (cols - 1) * GAP
    row_h = LABEL_H + CELL + GAP
    height = MARGIN * 2 + len(ROWS) * row_h
    sheet = Image.new("RGBA", (width, height), rgb(PAL["dark"]) + (255,))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSansMono.ttf", 15)
    except OSError:
        font = ImageFont.load_default()

    y = MARGIN
    for title, kind, items in ROWS:
        draw.text((MARGIN, y), title, fill=rgb(PAL["paper"]), font=font)
        cy = y + LABEL_H
        if kind == "palette":
            x = MARGIN
            for name, keys in items:
                for k in keys:
                    sheet.alpha_composite(swatch(k), (x, cy))
                    x += SWATCH_W
                x += GAP
        else:
            x = MARGIN
            for name, spr in items:
                sheet.alpha_composite(scaled(spr), (x, cy))
                draw.text((x + 4, cy + CELL - 18), name,
                          fill=rgb(PAL["light"]), font=font)
                x += CELL + GAP
        y += row_h

    out = "/opt/brendbot/projects/wordsmith/design/pixel-sample.png"
    sheet.convert("RGB").save(out)
    print(out)


if __name__ == "__main__":
    main()
