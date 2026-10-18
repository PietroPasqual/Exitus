"""Compose untouched production pixels into compact serpent/material art studies.

Nearest-neighbour enlargement and cropping do not redraw the native sprites.
Assets are fully encoded and verified in temporary files before atomic publish.
"""
from pathlib import Path
import hashlib
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
BG, FG, SUB, ACCENT = '#111b27', '#edf2ed', '#a3b6c3', '#d0b584'


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


def validate_asset(file, suffix):
    first_hash = hashlib.sha256(file.read_bytes()).hexdigest()
    with Image.open(file) as image:
        if suffix == '.gif':
            durations = []
            for frame in range(image.n_frames):
                image.seek(frame)
                image.load()
                durations.append(image.info['duration'])
            assert image.n_frames == 8 and durations == DURATIONS, (file.name, durations)
            assert image.info.get('loop') == 0
        else:
            image.load()
    assert first_hash == hashlib.sha256(file.read_bytes()).hexdigest(), f'Asset changed during read: {file.name}'


def atomic_save(image, destination, **options):
    descriptor, temporary = tempfile.mkstemp(prefix='serpent-mixture-asset-', suffix=destination.suffix)
    os.close(descriptor)
    temporary = Path(temporary)
    try:
        image.save(temporary, **options)
        with temporary.open('rb') as finished:
            os.fsync(finished.fileno())
        validate_asset(temporary, destination.suffix)
        os.replace(temporary, destination)
        validate_asset(destination, destination.suffix)
    finally:
        temporary.unlink(missing_ok=True)


def fit_text(draw, text, x, y, maximum, color, size=12):
    face = font(size)
    while draw.textlength(text, font=face) > maximum and size > 9:
        size -= 1
        face = font(size)
    assert draw.textlength(text, font=face) <= maximum, (text, maximum)
    draw.text((x, y), text, font=face, fill=color)


def gallery(group, theme, frame):
    fixtures = [item for item in MANIFEST['cases'] if item['group'] == group]
    assert len(fixtures) == 16
    crops = MANIFEST['crops']
    columns, rows, panel_width, cell_width = 4, 4, 180, 380
    layout = {}
    for item in fixtures:
        crop = tuple(crops[item['id']])
        width, height = crop[2] - crop[0], crop[3] - crop[1]
        scale = 2 if width * 2 <= panel_width else 1
        assert width * scale <= panel_width
        layout[item['id']] = (crop, width * scale, height * scale)
    panel_height = max(entry[2] for entry in layout.values())
    cell_height = panel_height + 60
    width, height = 18 + columns * cell_width, 100 + rows * cell_height + 28
    canvas = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(canvas)
    title = 'Serpente · corpo, escamas e movimento' if group == 'serpent' else 'Misturas · materiais em contato'
    subtitle = ('Antes / Atual · 16 estudos: puros, pares, conjuntos de 3–16 materiais, lançamento, retorno, cópias e órbitas'
                if group == 'serpent' else
                'Antes / Atual · 16 estudos: armas, proteção, criaturas, plantas, construções, palavra, esfera e conjunto')
    draw.text((18, 13), title, font=font(24), fill=FG)
    draw.text((18, 49), subtitle, font=font(13), fill=SUB)
    for index, item in enumerate(fixtures):
        x, y = 18 + (index % columns) * cell_width, 98 + (index // columns) * cell_height
        fit_text(draw, item['label'], x, y, cell_width - 16, ACCENT)
        crop, crop_width, crop_height = layout[item['id']]
        for version, offset, label in [('before', 0, 'Antes'), ('current', panel_width + 10, 'Atual')]:
            draw.text((x + offset, y + 20), label, font=font(10), fill=SUB if version == 'before' else FG)
            image = load(item['id'], theme, version, frame).crop(crop)
            if image.size != (crop_width, crop_height):
                image = image.resize((crop_width, crop_height), Image.Resampling.NEAREST)
            canvas.paste(image, (x + offset + (panel_width - crop_width) // 2,
                                y + 37 + (panel_height - crop_height) // 2))
    theme_label = 'Noite' if theme == 'night' else 'Dia'
    draw.text((18, height - 22), f'{theme_label} · pixels reais ampliados 2×; cenas largas em 1× · 8 quadros / 1 segundo · sem redesenho da prévia', font=font(12), fill=SUB)
    return canvas


def save(sequence, name):
    atomic_save(sequence[0], OUT / f'{name}.png')
    # A single palette spans all eight poses; no dithering adds false texture.
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


for theme in ['night', 'day']:
    for group in ['serpent', 'mixtures']:
        save([gallery(group, theme, frame) for frame in range(8)], f'{group}-{theme}')
print('Saved eight verified serpent/material comparison artifacts.')
