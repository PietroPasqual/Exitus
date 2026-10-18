"""Compose untouched production captures into material matrices and art studies.

The companion proof script supplies temporary RGBA files and removes them after
composition. Enlargement uses nearest-neighbour sampling; GIFs share one palette.
"""
from pathlib import Path
import json
import os
import sys
import tempfile
from PIL import Image, ImageDraw, ImageFont

OUT, CAPTURES = Path(sys.argv[1]), Path(sys.argv[2])
MANIFEST = json.loads((OUT / 'manifest.json').read_text())
SIZE = (MANIFEST['size']['width'], MANIFEST['size']['height'])
DURATIONS = MANIFEST['animation']['durationMs']
assert MANIFEST['mode'] == 'frozen-baseline-comparison'
assert MANIFEST['checks']['sourceSubstitutions'] == 0
assert DURATIONS == [120, 130] * 4 and sum(DURATIONS) == 1000
BG, FG, SUB, LINE, ACCENT = '#111b27', '#edf2ed', '#a3b6c3', '#2b3c4c', '#d0b584'


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


def atomic_save(image, destination, **options):
    """Expose only a fully encoded asset to workspace file watchers."""
    # /tmp and this workspace share a filesystem; rename publishes one complete
    # file instead of creating a target that is observable during GIF encoding.
    descriptor, temporary = tempfile.mkstemp(prefix='universal-mixture-asset-', suffix=destination.suffix)
    os.close(descriptor)
    temporary = Path(temporary)
    try:
        image.save(temporary, **options)
        with temporary.open('rb') as finished:
            os.fsync(finished.fileno())
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def theme_label(theme):
    return 'Noite' if theme == 'night' else 'Dia'


def center_text(draw, text, x, y, width, size=12, fill=SUB):
    face = font(size)
    length = draw.textlength(text, font=face)
    draw.text((x + (width - length) / 2, y), text, font=face, fill=fill)


def matrix(theme, version):
    crop = tuple(MANIFEST['matrixCrop'])
    scale, axis_width, header = 2, 115, 117
    body_width, body_height = (crop[2] - crop[0]) * scale, (crop[3] - crop[1]) * scale
    cell_width, cell_height = max(body_width + 6, 84), body_height + 6
    materials = MANIFEST['materials']
    width, height = axis_width + len(materials) * cell_width + 18, header + len(materials) * cell_height + 35
    canvas = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(canvas)
    title = 'Antes' if version == 'before' else 'Atual'
    draw.text((18, 13), f'Misturas de elementos · {title.lower()}', font=font(25), fill=FG)
    draw.text((18, 51), 'Linhas: primeiro elemento / dominante · Colunas: segundo elemento · Diagonal: elemento puro', font=font(14), fill=SUB)
    draw.text((18, 75), f'{theme_label(theme)} · 240 pares ordenados + 16 puros · quadro 0 · recortes 2× sem suavização', font=font(12), fill=SUB)
    for column, material in enumerate(materials):
        center_text(draw, material['label'], axis_width + column * cell_width, 96, cell_width, size=12, fill=ACCENT)
    for row, primary in enumerate(materials):
        y = header + row * cell_height
        draw.text((12, y + cell_height / 2 - 8), primary['label'], font=font(13), fill=ACCENT)
        for column, secondary in enumerate(materials):
            x = axis_width + column * cell_width
            image = load(f"matrix-{primary['element']}-{secondary['element']}", theme, version, 0).crop(crop)
            canvas.paste(image.resize((body_width, body_height), Image.Resampling.NEAREST), (x + (cell_width - body_width) // 2, y + 3))
            if row == column:
                draw.rectangle((x + 1, y + 1, x + cell_width - 2, y + cell_height - 2), outline=ACCENT)
    draw.text((18, height - 24), 'Todos os oito quadros foram verificados. A matriz mostra o mesmo quadro inicial em ambas as versões.', font=font(12), fill=SUB)
    return canvas


def gallery(theme, frame):
    fixtures = [item for item in MANIFEST['cases'] if item['group'] == 'gallery']
    crops = MANIFEST['galleryCrops']
    assert len(fixtures) == 16
    scale, columns, rows = 2, 4, 4
    panel_width = max((crop[2] - crop[0]) * scale for crop in crops.values())
    panel_height = max((crop[3] - crop[1]) * scale for crop in crops.values())
    cell_width, cell_height = panel_width * 2 + 28, panel_height + 66
    width, height = 18 + columns * cell_width, 100 + rows * cell_height + 32
    canvas = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 13), 'Misturas através das formas', font=font(24), fill=FG)
    draw.text((18, 49), 'Antes / Atual · 16 estudos de produção · armas, proteção, criaturas, plantas, construções e múltiplos materiais', font=font(13), fill=SUB)
    for index, item in enumerate(fixtures):
        x, y = 18 + (index % columns) * cell_width, 98 + (index // columns) * cell_height
        draw.text((x, y), item['label'], font=font(12), fill=ACCENT)
        crop = tuple(crops[item['id']])
        crop_width, crop_height = (crop[2] - crop[0]) * scale, (crop[3] - crop[1]) * scale
        for version, offset, label in [('before', 0, 'Antes'), ('current', panel_width + 10, 'Atual')]:
            draw.text((x + offset, y + 23), label, font=font(11), fill=SUB if version == 'before' else FG)
            image = load(item['id'], theme, version, frame).crop(crop)
            canvas.paste(image.resize((crop_width, crop_height), Image.Resampling.NEAREST),
                         (x + offset + (panel_width - crop_width) // 2, y + 42 + (panel_height - crop_height) // 2))
    draw.text((18, height - 24), f'{theme_label(theme)} · recortes 2× · 8 quadros / 1 segundo · uma amostra visual de formas e conjuntos', font=font(12), fill=SUB)
    return canvas


def contexts(theme, frame):
    fixtures = [item for item in MANIFEST['cases'] if item['group'] == 'context']
    columns, rows, cell_width, cell_height = 4, 2, 370, 240
    assert len(fixtures) == columns * rows
    width, height = 18 + columns * cell_width, 100 + rows * cell_height + 30
    canvas = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 13), 'As misturas em cena', font=font(24), fill=FG)
    draw.text((18, 49), 'Atual · cenários 2× · lançamento, retorno, cópias, órbitas, conceitos e conjuntos com mais materiais', font=font(13), fill=SUB)
    for index, item in enumerate(fixtures):
        x, y = 18 + (index % columns) * cell_width, 100 + (index // columns) * cell_height
        draw.text((x, y - 20), item['label'], font=font(11), fill=ACCENT)
        image = load(item['id'], theme, 'current', frame)
        canvas.paste(image.resize((360, 210), Image.Resampling.NEAREST), (x, y))
    draw.text((18, height - 24), f'{theme_label(theme)} · oito quadros completos do renderer real, sem redesenhar a prévia', font=font(12), fill=SUB)
    return canvas


def save(sequence, name):
    atomic_save(sequence[0], OUT / f'{name}.png')
    # Select one shared palette from all eight poses; quantize the complete
    # final pixels without resizing or dithering the output images.
    sample_width = 480
    sample_height = max(1, round(sequence[0].height * sample_width / sequence[0].width))
    atlas = Image.new('RGB', (sample_width, sample_height * len(sequence)))
    for index, image in enumerate(sequence):
        atlas.paste(image.resize((sample_width, sample_height), Image.Resampling.NEAREST), (0, index * sample_height))
    palette = atlas.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    frames = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in sequence]
    assert all(image.getpalette() == frames[0].getpalette() for image in frames)
    atomic_save(frames[0], OUT / f'{name}.gif', save_all=True, append_images=frames[1:],
                duration=DURATIONS, loop=0, disposal=2, optimize=False)
    gif = Image.open(OUT / f'{name}.gif')
    durations = []
    for frame in range(gif.n_frames):
        gif.seek(frame)
        durations.append(gif.info['duration'])
    assert gif.n_frames == 8 and durations == DURATIONS, (name, durations)
    assert gif.info.get('loop') == 0


for theme in ['night', 'day']:
    for version in ['before', 'current']:
        atomic_save(matrix(theme, version), OUT / f'matrix-{version}-{theme}.png')
    save([gallery(theme, frame) for frame in range(8)], f'gallery-{theme}')
    save([contexts(theme, frame) for frame in range(8)], f'contexts-{theme}')
print('Saved four ordered-pair matrices, mixed-form comparisons and eight production contexts.')
