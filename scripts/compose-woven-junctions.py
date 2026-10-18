"""Production before/current art, enlarged without filtering or retouching.

Usage: python scripts/compose-woven-junctions.py output temporary-RGBA-directory
The proof script removes all raw captures after these review artifacts are saved.
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
NAMES = {'fogo': 'Fogo', 'agua': 'Água', 'raio': 'Raio', 'natureza': 'Natureza',
         'vento': 'Vento', 'luz': 'Luz', 'sombra': 'Sombra'}


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


def comparison(theme, frame):
    # The crop comes from both production envelopes across the complete cycle.
    # Keep enlargement integral, then size each comparison cell to fit it.
    scale = 3
    crop_width, crop_height = (CROP[2] - CROP[0]) * scale, (CROP[3] - CROP[1]) * scale
    version_gap, order_gap, label_width = 20, 50, 190
    order_width = crop_width * 2 + version_gap
    row_height = crop_height + 63
    width = label_width + order_width * 2 + order_gap + 36
    height = 100 + len(MANIFEST['pairDefinitions']) * row_height + 32
    canvas = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 13), 'Quatro encontros · novas artes de magia', font=font(23), fill=FG)
    draw.text((18, 48), 'Antes e atual no mesmo quadro · pixel art 3× · duas dominâncias para cada par', font=font(13), fill=SUB)
    for row, pair in enumerate(MANIFEST['pairDefinitions']):
        y = 98 + row * row_height
        draw.line((18, y - 7, width - 18, y - 7), fill=LINE)
        draw.text((18, y + 57), pair['label'], font=font(17), fill=ACCENT)
        for order, elements in enumerate([pair['elements'], pair['elements'][::-1]]):
            x = label_width + order * (order_width + order_gap)
            draw.text((x, y), f"{NAMES[elements[0]]} dominante", font=font(14), fill=FG)
            case_id = '-'.join(elements)
            for version, offset, label in [('before', 0, 'Antes'), ('current', crop_width + version_gap, 'Atual')]:
                image = load(case_id, theme, version, frame).crop(CROP)
                draw.text((x + offset, y + 23), label, font=font(12), fill=SUB)
                canvas.paste(image.resize((crop_width, crop_height), Image.Resampling.NEAREST), (x + offset, y + 43))
    draw.text((18, height - 24), f'{theme_label(theme)} · 8 quadros / 1 segundo · cenas reais de produção, sem redesenhar a prévia', font=font(12), fill=SUB)
    return canvas


def contexts(theme, frame):
    fixtures = [case for case in MANIFEST['cases'] if case['group'] == 'context']
    columns, rows, cell_width, cell_height = 3, 4, 380, 238
    assert len(fixtures) == columns * rows
    canvas = Image.new('RGB', (1158, 1060), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 13), 'Os encontros dentro das magias', font=font(23), fill=FG)
    draw.text((18, 48), 'Atual · cenas 2× · seis contextos das novas artes e seis contextos preservados', font=font(13), fill=SUB)
    for index, fixture in enumerate(fixtures):
        x, y = 18 + (index % columns) * cell_width, 96 + (index // columns) * cell_height
        draw.text((x, y - 19), fixture['label'], font=font(11), fill=ACCENT if fixture['route'] == 'new-pair' else SUB)
        image = load(fixture['id'], theme, 'current', frame)
        canvas.paste(image.resize((360, 210), Image.Resampling.NEAREST), (x, y))
    draw.text((18, 1035), f'{theme_label(theme)} · renderer real · intenções, trios e conjuntos mantêm a arte existente', font=font(12), fill=SUB)
    return canvas


def save(sequence, name):
    sequence[0].save(OUT / f'{name}.png')
    # A single palette over all poses prevents frame-dependent GIF color shifts.
    # Quantize the original full-resolution pixels without dithering.
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
    save([comparison(theme, frame) for frame in range(8)], f'comparison-{theme}')
    save([contexts(theme, frame) for frame in range(8)], f'contexts-{theme}')
print('Saved four pair comparisons and production contexts: eight-frame, one-second loops.')
