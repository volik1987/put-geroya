"""Вырезает зелёный фон, режет лист спрайтов на 4 направления (64x64) и портреты (256x256).
usage: cut.py sheet <in.png> <out_dir> <name> [кадр_вправо=1]     -> name_down/left/right/up.png + name_sheet.png (256x64)
       cut.py portrait <in.png> <out.png>
"""
import sys, os
from PIL import Image

def key(img, soft):
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            green = g - max(r, b)          # насколько пиксель «зеленее» остального
            if soft:
                if green > 90:
                    px[x, y] = (0, 0, 0, 0)
                elif green > 25:
                    al = int(255 * (90 - green) / 65)
                    px[x, y] = (r, min(g, max(r, b)), b, al)   # убираем зелёный ореол
                elif green > 0:
                    px[x, y] = (r, min(g, max(r, b) + 10), b, a)
            else:
                if green > 60:
                    px[x, y] = (0, 0, 0, 0)
                elif green > 0:
                    px[x, y] = (r, min(g, max(r, b)), b, 255)
    return img

def split4(im):
    """Делит лист на 4 фигуры по пустым вертикальным промежуткам (широкие волки не влезают в равные клетки)."""
    w, h = im.size
    alpha = im.getchannel('A')
    filled = [alpha.crop((x, 0, x + 1, h)).getbbox() is not None for x in range(w)]
    runs, start = [], None
    for x, f in enumerate(filled + [False]):
        if f and start is None: start = x
        if not f and start is not None: runs.append([start, x]); start = None
    runs = [r for r in runs if r[1] - r[0] >= 30]          # отбросить крошки
    while len(runs) > 4:                                   # склеить ближайшие куски одной фигуры
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = gaps.index(min(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    if len(runs) != 4:                                     # не вышло — равные клетки
        cw = w // 4
        return [im.crop((i * cw, 0, (i + 1) * cw, h)) for i in range(4)]
    return [im.crop((a, 0, b, h)) for a, b in runs]

def sheet(src, out_dir, name, right_idx=1):
    """Кадры листа: 0 — вниз, 3 — вверх, right_idx — вправо; влево = зеркало правого
    (модель путает лево/право, зеркало гарантирует одинаковые направления)."""
    im = key(Image.open(src), soft=False)
    w, h = im.size
    cells = split4(im)
    flip = str(right_idx).endswith('L')                 # «2L» — в клетке 2 фигура смотрит влево
    r = cells[int(str(right_idx).rstrip('L'))]
    if flip: r = r.transpose(Image.FLIP_LEFT_RIGHT)
    picked = {'down': cells[0], 'right': r, 'up': cells[3]}
    picked['left'] = picked['right'].transpose(Image.FLIP_LEFT_RIGHT)
    boxes = {k: c.getbbox() for k, c in picked.items()}
    bw = max(b[2] - b[0] for b in boxes.values())
    bh = max(b[3] - b[1] for b in boxes.values())
    scale = 60 / max(bw, bh)          # общий масштаб для всех направлений
    out = Image.new('RGBA', (256, 64))
    for i, dname in enumerate(['down', 'left', 'right', 'up']):
        part = picked[dname].crop(boxes[dname])
        nw, nh = max(1, round(part.width * scale)), max(1, round(part.height * scale))
        small = part.resize((nw, nh), Image.BOX)
        small.putalpha(small.getchannel('A').point(lambda v: 255 if v >= 110 else 0))   # жёсткие края
        tile = Image.new('RGBA', (64, 64))
        tile.paste(small, ((64 - nw) // 2, 64 - nh - 2), small)                          # ноги у низа
        tile.save(os.path.join(out_dir, f'{name}_{dname}.png'))
        out.paste(tile, (i * 64, 0))
    out.save(os.path.join(out_dir, f'{name}_sheet.png'))

def portrait(src, dst):
    im = key(Image.open(src), soft=True)
    b = im.getbbox()
    im = im.crop(b)
    side = max(im.width, im.height)
    sq = Image.new('RGBA', (side, side))
    sq.paste(im, ((side - im.width) // 2, side - im.height), im)
    sq.resize((256, 256), Image.LANCZOS).save(dst)

if __name__ == '__main__':
    if sys.argv[1] == 'sheet':
        sheet(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else 1)
    else:
        portrait(sys.argv[2], sys.argv[3])
