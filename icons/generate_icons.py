"""
Generate Chrome extension icons (16, 48, 128) with the Chinese character 登.
Transparent background, vivid purple fill with white outline so it pops on
both light and dark browser themes. Single character fills the icon.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

TEXT = "登"
# Vivid, high-saturation purple — much more prominent than the original gradient
FILL_COLOR = (88, 28, 178, 255)        # #581CB2
OUTLINE_COLOR = (255, 255, 255, 240)   # near-white outline


def find_chinese_bold_font(target_px):
    """Locate a bold CJK-capable font on Windows."""
    candidates = [
        "C:/Windows/Fonts/msyhbd.ttc",   # Microsoft YaHei Bold
        "C:/Windows/Fonts/msyhbd.ttf",
        "C:/Windows/Fonts/msyh.ttc",     # Microsoft YaHei
        "C:/Windows/Fonts/simhei.ttf",   # SimHei
        "C:/Windows/Fonts/simsun.ttc",   # SimSun (fallback)
        "C:/Windows/Fonts/msjhbd.ttc",   # Microsoft JhengHei Bold
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, target_px)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def fit_font(text, max_w, max_h):
    lo, hi = 4, max_h
    best = lo
    while lo <= hi:
        mid = (lo + hi) // 2
        font = find_chinese_bold_font(mid)
        bbox = font.getbbox(text)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        if w <= max_w and h <= max_h:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return find_chinese_bold_font(best)


def make_icon(size):
    # Outline thickness scales with size
    outline_w = max(1, int(round(size * 0.05)))

    # Near-zero padding so the character fills the icon
    pad = max(1, int(size * 0.02))
    max_w = size - 2 * pad - 2 * outline_w
    max_h = size - 2 * pad - 2 * outline_w
    # CJK glyphs render slightly smaller than their em-box, so scale up a bit
    font = fit_font(TEXT, int(max_w * 1.05), int(max_h * 1.05))

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    bbox = draw.textbbox((0, 0), TEXT, font=font, stroke_width=outline_w)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]

    draw.text(
        (x, y),
        TEXT,
        font=font,
        fill=FILL_COLOR,
        stroke_width=outline_w,
        stroke_fill=OUTLINE_COLOR,
    )
    return img


def main():
    for size in (16, 48, 128):
        img = make_icon(size)
        out = os.path.join(OUT_DIR, f"icon{size}.png")
        img.save(out, "PNG")
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
