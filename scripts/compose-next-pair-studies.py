"""Production proof at matched 3× and native 1×; nearest-neighbour only.

The historical filename is retained. Current-only mode never invents a baseline.
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(sys.argv[1])
MANIFEST = json.loads((ROOT / 'manifest.json').read_text())
BASELINE = MANIFEST['mode'] == 'frozen-baseline-comparison'
BG, FG, SUB = '#121d2a', '#eef4ef', '#a8bcc7'
CROP = tuple(MANIFEST['crop'])
DURATIONS = MANIFEST['animation']['durationMs']
SIZE = (MANIFEST['size']['width'], MANIFEST['size']['height'])
assert DURATIONS == [120, 130] * 4 and sum(DURATIONS) == 1000
assert MANIFEST['checks']['sourceSubstitutions'] == 0


def font(size):
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size)


def load(case, theme, version, frame):
    data = (ROOT / f'{case["id"]}-{theme}-{version}-{frame}.rgba').read_bytes()
    assert len(data) == SIZE[0] * SIZE[1] * 4
    return Image.frombytes('RGBA', SIZE, data).convert('RGB')


def crop(image, scale):
    cropped = image.crop(CROP)
    return cropped.resize((cropped.width * scale, cropped.height * scale), Image.Resampling.NEAREST)


def main(theme, frame, reverse=False):
    rows = MANIFEST['cases'][1::2] if reverse else MANIFEST['cases'][::2]
    image = Image.new('RGB', (770, 735), BG)
    draw = ImageDraw.Draw(image)
    draw.text((18, 12), 'Três misturas · corpos integrados', font=font(22), fill=FG)
    if BASELINE:
        draw.text((150, 49), 'Antes · 3×', font=font(13), fill=SUB)
        draw.text((330, 49), 'Produção · 3×', font=font(13), fill=FG)
    else:
        draw.text((150, 49), 'Produção atual · 3×', font=font(13), fill=FG)
        draw.text((330, 49), 'Sem base anterior', font=font(13), fill=SUB)
    draw.text((520, 49), 'No cenário · 1×', font=font(13), fill=FG)
    for index, case in enumerate(rows):
        y = 73 + index * 210
        current = load(case, theme, 'current', frame)
        draw.line((18, y - 3, 748, y - 3), fill='#2d3a48')
        first, second = case['label'].split(' + ')
        draw.text((18, y + 44), first + ' +', font=font(18), fill=FG)
        draw.text((18, y + 67), second, font=font(18), fill=FG)
        draw.text((18, y + 102), 'Primeiro material', font=font(10), fill=SUB)
        draw.text((18, y + 118), 'predomina', font=font(10), fill=SUB)
        if BASELINE:
            before = load(case, theme, 'before', frame)
            image.paste(crop(before, 3), (150, y))
            image.paste(crop(current, 3), (330, y))
            image.paste(crop(before, 1), (536, y + 132))
            image.paste(crop(current, 1), (628, y + 132))
            # Native crop ends at y + 190. Labels deliberately start below it.
            draw.text((536, y + 194), 'Antes 1×', font=font(10), fill=SUB)
            draw.text((628, y + 194), 'Atual 1×', font=font(10), fill=SUB)
        else:
            image.paste(crop(current, 3), (150, y))
            image.paste(crop(current, 1), (575, y + 132))
            draw.text((575, y + 194), 'Atual 1×', font=font(10), fill=SUB)
        image.paste(current, (520, y + 27))
    theme_label = 'Noite' if theme == 'night' else 'Dia'
    draw.text((18, 717), f'{theme_label} · 8 quadros / 1 segundo · Renderer e seleção reais de produção', font=font(11), fill=SUB)
    return image


def save(sequence, name):
    sequence[0].save(ROOT / f'{name}.png')
    sequence[0].save(ROOT / f'{name}.gif', save_all=True, append_images=sequence[1:],
                     duration=DURATIONS, loop=0, disposal=2, optimize=False)
    gif = Image.open(ROOT / f'{name}.gif')
    actual = []
    for index in range(gif.n_frames):
        gif.seek(index)
        actual.append(gif.info['duration'])
    assert gif.n_frames == 8 and actual == DURATIONS, (name, actual)
    assert gif.info.get('loop') == 0


prefix = 'comparison' if BASELINE else 'current-only'
for theme in ['day', 'night']:
    for reverse in [False, True]:
        suffix = '-reversed' if reverse else ''
        save([main(theme, frame, reverse) for frame in range(8)], f'{prefix}-{theme}{suffix}')
print(f'Saved {prefix} production/native proofs, eight frames / exactly one second.')
