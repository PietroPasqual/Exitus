"""Production-only before/current junction sheets and shared-palette GIF loops.

The second argument contains temporary RGBA captures from the proof script.
Every image is enlarged with nearest-neighbour sampling, without retouching.
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = Path(sys.argv[1])
CAPTURES = Path(sys.argv[2])
MANIFEST = json.loads((OUT / 'manifest.json').read_text())
SIZE = (MANIFEST['size']['width'], MANIFEST['size']['height'])
CROP = tuple(MANIFEST['crop'])
DURATIONS = MANIFEST['animation']['durationMs']
assert MANIFEST['mode'] == 'frozen-baseline-comparison'
assert MANIFEST['checks']['sourceSubstitutions'] == 0
assert DURATIONS == [120, 130] * 4 and sum(DURATIONS) == 1000
BG, FG, SUB, LINE, ACCENT = '#111b27', '#edf2ed', '#a3b6c3', '#2b3c4c', '#d0b584'
NAMES = {'fogo': 'Fogo', 'metal': 'Metal', 'agua': 'Água', 'gelo': 'Gelo',
         'sombra': 'Sombra', 'raio': 'Raio', 'terra': 'Terra', 'natureza': 'Natureza',
         'vento': 'Vento', 'luz': 'Luz'}


def font(size):
    for candidate in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                      '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf']:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default(size=size)


def load(case_id, theme, version, frame):
    data = (CAPTURES / f'{case_id}-{theme}-{version}-{frame}.rgba').read_bytes()
    assert len(data) == SIZE[0] * SIZE[1] * 4
    return Image.frombytes('RGBA', SIZE, data).convert('RGB')


def theme_label(theme):
    return 'Noite' if theme == 'night' else 'Dia'


def authored(theme, frame):
    # Each row compares both dominant orders. The surrounding scenes are genuine
    # native captures; only their bodies are enlarged, never redrawn.
    row_height, margin = 198, 18
    canvas = Image.new('RGB', (1240, 1330), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 13), 'Junções de elementos · seis encontros, duas dominâncias', font=font(23), fill=FG)
    draw.text((margin, 48), 'Antes e atual no mesmo quadro · recortes 3× sem suavização · primeiro elemento mantém a dominância', font=font(13), fill=SUB)
    for row, pair in enumerate(MANIFEST['pairDefinitions']):
        y = 88 + row * row_height
        draw.line((margin, y - 7, 1222, y - 7), fill=LINE)
        draw.text((margin, y + 3), pair['label'], font=font(17), fill=ACCENT)
        for order, elements in enumerate([pair['elements'], pair['elements'][::-1]]):
            x = 245 + order * 490
            draw.text((x, y), f"{NAMES[elements[0]]} dominante", font=font(14), fill=FG)
            case_id = '-'.join(elements)
            for version, offset, label in [('before', 0, 'Antes'), ('current', 207, 'Atual')]:
                image = load(case_id, theme, version, frame)
                crop = image.crop(CROP)
                draw.text((x + offset, y + 24), label, font=font(12), fill=SUB)
                canvas.paste(crop.resize((crop.width * 3, crop.height * 3), Image.Resampling.NEAREST), (x + offset, y + 43))
    draw.text((margin, 1305), f'{theme_label(theme)} · 8 quadros / 1 segundo · renderer e rotas reais de produção', font=font(12), fill=SUB)
    return canvas


def general(theme, frame):
    canvas = Image.new('RGB', (1130, 935), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 13), 'Contatos compartilhados · materiais com identidade própria', font=font(23), fill=FG)
    draw.text((18, 48), 'Antes e atual · recortes 3× + cenário nativo · o encontro se anima dentro da forma', font=font(13), fill=SUB)
    for row, pair in enumerate(MANIFEST['generalDefinitions']):
        y = 90 + row * 198
        draw.line((18, y - 8, 1112, y - 8), fill=LINE)
        draw.text((18, y + 73), pair['label'], font=font(15), fill=ACCENT)
        case_id = '-'.join(pair['elements'])
        for version, x, label in [('before', 245, 'Antes'), ('current', 690, 'Atual')]:
            image = load(case_id, theme, version, frame)
            crop = image.crop(CROP)
            draw.text((x, y), label, font=font(14), fill=FG)
            canvas.paste(crop.resize((crop.width * 3, crop.height * 3), Image.Resampling.NEAREST), (x, y + 26))
            canvas.paste(image, (x + 165, y + 48))
            draw.text((x + 165, y + 158), 'Cenário 1×', font=font(10), fill=SUB)
    draw.text((18, 910), f'{theme_label(theme)} · 8 quadros / 1 segundo · nenhuma inferência nova de regras de fusão', font=font(12), fill=SUB)
    return canvas


def contexts(theme, frame):
    fixtures = [case for case in MANIFEST['cases'] if case['group'] == 'context']
    columns, rows, cell_width, cell_height = 3, 4, 380, 238
    assert len(fixtures) == columns * rows
    canvas = Image.new('RGB', (1158, 1060), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 13), 'As junções dentro das magias', font=font(23), fill=FG)
    draw.text((18, 48), 'Atual · cenas de produção 2× · voo, retorno, quantidade, órbitas, intenções e três materiais', font=font(13), fill=SUB)
    for index, fixture in enumerate(fixtures):
        x, y = 18 + (index % columns) * cell_width, 96 + (index // columns) * cell_height
        draw.text((x, y - 19), fixture['label'], font=font(11), fill=ACCENT)
        image = load(fixture['id'], theme, 'current', frame)
        canvas.paste(image.resize((360, 210), Image.Resampling.NEAREST), (x, y))
    draw.text((18, 1035), f'{theme_label(theme)} · oito quadros completos, sem redesenhar a prévia', font=font(12), fill=SUB)
    return canvas


def save(sequence, name):
    sequence[0].save(OUT / f'{name}.png')
    # One palette over the entire loop avoids frame-dependent quantization.
    sample_width = 420
    sample_height = max(1, round(sequence[0].height * sample_width / sequence[0].width))
    atlas = Image.new('RGB', (sample_width, sample_height * len(sequence)))
    for index, image in enumerate(sequence):
        atlas.paste(image.resize((sample_width, sample_height), Image.Resampling.NEAREST), (0, index * sample_height))
    palette = atlas.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    frames = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in sequence]
    assert all(image.getpalette() == frames[0].getpalette() for image in frames)
    frames[0].save(OUT / f'{name}.gif', save_all=True, append_images=frames[1:],
                   duration=DURATIONS, loop=0, disposal=2, optimize=False)
    gif = Image.open(OUT / f'{name}.gif')
    durations = []
    for frame in range(gif.n_frames):
        gif.seek(frame)
        durations.append(gif.info['duration'])
    assert gif.n_frames == 8 and durations == DURATIONS, (name, durations)
    assert gif.info.get('loop') == 0


for theme in ['night', 'day']:
    save([authored(theme, frame) for frame in range(8)], f'authored-{theme}')
    save([general(theme, frame) for frame in range(8)], f'general-{theme}')
    save([contexts(theme, frame) for frame in range(8)], f'contexts-{theme}')
print('Saved authored junctions, general contacts and production contexts: eight-frame, one-second loops.')
