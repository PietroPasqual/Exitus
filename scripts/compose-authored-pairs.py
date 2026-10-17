"""Compose compact real-renderer pair proofs; requires Python and Pillow.

Usage: python scripts/compose-authored-pairs.py /tmp/pair-body-production
The proof-authored-pairs.mjs manifest is the only image/caption input.
All sprite resizing uses nearest-neighbour, with native 1x scenes beside it.
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(sys.argv[1])
MANIFEST = json.loads((ROOT / 'manifest.json').read_text())
BASELINE = MANIFEST['baseline'] is not None
BG, FG, SUB, MUT = '#141e2a', '#eff3f0', '#b4c3ca', '#8ba5b3'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
DURATIONS = MANIFEST['animation']['durationMs']


def font(size):
    return ImageFont.truetype(FONT, size)


def load(case, theme, version, frame):
    name = f'{case["id"]}-{theme}-{version}-{frame}.rgba'
    return Image.frombytes('RGBA', (180, 105), (ROOT / name).read_bytes()).convert('RGB')


def crop(image, scale=1):
    result = image.crop(tuple(MANIFEST['crop']))
    return result.resize((result.width * scale, result.height * scale), Image.Resampling.NEAREST)


def principal(theme, frame):
    cases = [case for case in MANIFEST['cases'] if case['main']]
    row_height = 226
    width = 1080 if BASELINE else 940
    image = Image.new('RGB', (width, 122 + row_height * len(cases)), BG)
    draw = ImageDraw.Draw(image)
    draw.text((24, 15), 'Três composições em produção', font=font(23), fill=FG)
    draw.text((24, 47), 'Renderer real  •  Coexistência de materiais  •  Ciclo de 8 quadros', font=font(14), fill=SUB)
    new_x, scene_x, notes_x = (331, 579, 800) if BASELINE else (187, 435, 656)
    if BASELINE:
        draw.text((187, 77), 'Anterior · 2×', font=font(13), fill=SUB)
    draw.text((new_x, 77), 'Atual · 4×', font=font(13), fill=FG)
    draw.text((scene_x, 77), 'Cena nativa · 1×', font=font(13), fill=FG)
    for row, case in enumerate(cases):
        y = 97 + row * row_height
        draw.line((24, y - 1, width - 24, y - 1), fill='#293847')
        draw.text((24, y + 65), case['name'], font=font(16), fill=FG)
        draw.text((24, y + 90), 'Primeiro elemento', font=font(11), fill=SUB)
        draw.text((24, y + 106), 'define a dominância', font=font(11), fill=SUB)
        current = load(case, theme, 'current', frame)
        if BASELINE:
            before = load(case, theme, 'before', frame)
            image.paste(crop(before, 2), (187, y + 50))
            image.paste(crop(before), (notes_x, y + 46))
            image.paste(crop(current), (notes_x + 73, y + 46))
            draw.text((notes_x - 2, y + 105), 'Antes 1×', font=font(11), fill=SUB)
            draw.text((notes_x + 69, y + 105), 'Atual 1×', font=font(11), fill=SUB)
        else:
            image.paste(crop(current), (notes_x, y + 46))
            draw.text((notes_x, y + 105), 'Corpo nativo 1×', font=font(11), fill=SUB)
        image.paste(crop(current, 4), (new_x, y + 7))
        image.paste(current, (scene_x, y + 49))
        for k, text in enumerate(case['note']):
            draw.text((notes_x, y + 135 + k * 19), text, font=font(13), fill=SUB)
        draw.text((scene_x, y + 164), 'Sem alteração nas regras.', font=font(12), fill=MUT)
    caption = f'{"Cena noturna" if theme == "night" else "Cena diurna"}  •  Quadro {frame}  •  Nenhuma fusão de regras adicionada'
    draw.text((24, image.height - 17), caption, font=font(11), fill=MUT)
    return image


def both_dominances(theme, frame):
    """Three pair rows and two dominance columns, without a tall six-row sheet."""
    image = Image.new('RGB', (1164, 730), BG)
    draw = ImageDraw.Draw(image)
    draw.text((20, 14), 'As duas dominâncias · renderer de produção', font=font(22), fill=FG)
    draw.text((20, 45), 'Atual ampliado 3× e cena nativa 1×' + ('  •  Anterior 1× para comparação' if BASELINE else ''), font=font(13), fill=SUB)
    for index, case in enumerate(MANIFEST['cases']):
        col, row = index % 2, index // 2
        x, y = 20 + col * 580, 77 + row * 211
        draw.line((x, y - 5, x + 554, y - 5), fill='#293847')
        draw.text((x, y), case['name'], font=font(16), fill=FG)
        current = load(case, theme, 'current', frame)
        image.paste(crop(current, 3), (x, y + 29))
        image.paste(current, (x + 170, y + 45))
        draw.text((x + 170, y + 155), 'Cena nativa 1×', font=font(11), fill=SUB)
        if BASELINE:
            image.paste(crop(load(case, theme, 'before', frame)), (x + 374, y + 45))
            image.paste(crop(current), (x + 450, y + 45))
            draw.text((x + 374, y + 102), 'Antes 1×', font=font(10), fill=SUB)
            draw.text((x + 450, y + 102), 'Atual 1×', font=font(10), fill=SUB)
        for k, text in enumerate(case['note']):
            draw.text((x + 170, y + 175 + k * 16), text, font=font(11), fill=MUT)
    draw.text((20, 711), f'{"Noite" if theme == "night" else "Dia"}  •  Quadro {frame}  •  Coexistência, sem fusões de regras acrescentadas', font=font(11), fill=MUT)
    return image


def save_sequence(frames, stem):
    frames[0].save(ROOT / f'{stem}.png')
    frames[0].save(ROOT / f'{stem}-loop.gif', save_all=True, append_images=frames[1:],
                   duration=DURATIONS, loop=0, disposal=2, optimize=False)
    gif = Image.open(ROOT / f'{stem}-loop.gif')
    durations = []
    for index in range(gif.n_frames):
        gif.seek(index)
        durations.append(gif.info['duration'])
    assert gif.n_frames == 8 and durations == DURATIONS and sum(durations) == 1000


for theme in ('day', 'night'):
    save_sequence([principal(theme, frame) for frame in range(8)], f'comparison-{theme}')
    save_sequence([both_dominances(theme, frame) for frame in range(8)], f'both-dominances-{theme}')
print('Saved production PNG/GIF proofs for both themes and dominances; every loop is eight frames / 1000 ms.')
