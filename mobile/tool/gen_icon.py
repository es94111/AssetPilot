"""依 logo.svg 的設計以 PIL 程式繪製 App 圖示來源。
產生 3 張：
  app_icon.png  — 完整圖示（漸層圓角底 + 內容），給 legacy mipmap
  ic_bg.png     — 漸層方底（不圓角，滿版），給 adaptive 背景層
  ic_fg.png     — 僅內容、透明底、置中留安全區，給 adaptive 前景層
"""
import os
from PIL import Image, ImageDraw, ImageFont

S = 1024
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icon")
os.makedirs(OUT, exist_ok=True)

BG1 = (0x66, 0x7e, 0xea)  # #667eea
BG2 = (0x76, 0x4b, 0xa2)  # #764ba2
BARS = [(0xc7, 0xd0, 0xf9), (0xd6, 0xcc, 0xfb), (0xec, 0xe0, 0xff)]
COIN1 = (0xfb, 0xbf, 0x24)  # #fbbf24
COIN2 = (0xf5, 0x9e, 0x0b)  # #f59e0b
WHITE = (255, 255, 255, 255)


def lerp(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def diagonal_gradient(size, c1, c2):
    n = 160
    small = Image.new("RGB", (n, n))
    px = small.load()
    for y in range(n):
        for x in range(n):
            px[x, y] = lerp(c1, c2, (x + y) / (2 * (n - 1)))
    return small.resize((size, size), Image.BICUBIC)


def load_font(size):
    for p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def draw_content(size=S):
    """在透明畫布上畫長條圖 + 趨勢線 + 箭頭 + 金幣（1024 座標，由 logo.svg ×2）。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    bars = [
        (200, 620, 112, 220, BARS[0]),
        (360, 500, 112, 340, BARS[1]),
        (520, 380, 112, 460, BARS[2]),
    ]
    for x, y, w, h, col in bars:
        d.rounded_rectangle([x, y, x + w, y + h], radius=20, fill=col + (235,))

    line = [(256, 580), (416, 460), (576, 330), (760, 240)]
    d.line(line, fill=WHITE, width=20, joint="curve")
    for px, py in line:
        d.ellipse([px - 10, py - 10, px + 10, py + 10], fill=WHITE)
    d.polygon([(760, 240), (700, 230), (730, 290)], fill=WHITE)

    # 金幣
    cx, cy, r = 776, 620, 120
    coin = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(coin)
    # 簡單直向漸層金幣
    for i in range(2 * r):
        t = i / (2 * r)
        cd.line([(cx - r, cy - r + i), (cx + r, cy - r + i)], fill=lerp(COIN1, COIN2, t))
    cmask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(cmask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    img.paste(coin, (0, 0), cmask)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=WHITE, width=16)
    font = load_font(150)
    d.text((cx, cy - 6), "$", font=font, fill=WHITE, anchor="mm")
    return img


# 1) 漸層底
grad = diagonal_gradient(S, BG1, BG2)

# 2) 內容層
content = draw_content(S)

# 3) app_icon：圓角底 + 內容
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=224, fill=255)
app_icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
app_icon.paste(grad, (0, 0), mask)
app_icon = Image.alpha_composite(app_icon, content)
app_icon.save(os.path.join(OUT, "app_icon.png"))

# 4) adaptive 背景（滿版方形漸層）
grad.convert("RGBA").save(os.path.join(OUT, "ic_bg.png"))

# 5) adaptive 前景：裁到內容邊界再放大到畫布 ~80%（再加上 XML 的 16% inset
#    剛好落在 adaptive 安全區），置中、透明底。
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
bbox = content.getbbox()
cropped = content.crop(bbox)
target = int(S * 0.80)
ratio = min(target / cropped.width, target / cropped.height)
new = cropped.resize(
    (int(cropped.width * ratio), int(cropped.height * ratio)), Image.LANCZOS
)
fg.paste(new, ((S - new.width) // 2, (S - new.height) // 2), new)
fg.save(os.path.join(OUT, "ic_fg.png"))

print("done:", os.listdir(OUT))
