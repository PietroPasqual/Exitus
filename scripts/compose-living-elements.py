"""Matched frozen/current art proof, native scenes and nearest-neighbour crops.

The second argument contains temporary production RGBA captures. They are never
needed by readers of the resulting PNG/GIF files and are removed after rendering.
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
BG, FG, SUB, LINE = '#121d2a', '#eef4ef', '#a8bcc7', '#2d3a48'
ELEMENTS = [('vento', 'Vento'), ('natureza', 'Natureza'), ('sombra', 'Sombra'), ('luz', 'Luz')]


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


def hero(theme, frame):
    canvas = Image.new('RGB', (950, 970), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 12), 'Quatro elementos · arte própria em movimento', font=font(22), fill=FG)
    draw.text((18, 45), 'Antes e depois no mesmo quadro · corpos 3× e cenário nativo 180×105', font=font(13), fill=SUB)
    draw.text((125, 72), 'Antes', font=font(17), fill=SUB)
    draw.text((535, 72), 'Atual', font=font(17), fill=FG)
    for index, (element, label) in enumerate(ELEMENTS):
        y = 108 + index * 205
        draw.line((18, y - 8, 932, y - 8), fill=LINE)
        draw.text((18, y + 74), label, font=font(16), fill=FG)
        for version, x in [('before', 125), ('current', 535)]:
            image = load(f'{element}-hero', theme, version, frame)
            cropped = image.crop(CROP)
            canvas.paste(cropped.resize((cropped.width * 3, cropped.height * 3), Image.Resampling.NEAREST), (x, y))
            canvas.paste(image, (x + 192, y + 33))
            draw.text((x + 192, y + 148), 'Cenário 1×', font=font(11), fill=SUB)
    theme_label = 'Noite' if theme == 'night' else 'Dia'
    draw.text((18, 946), f'{theme_label} · 8 quadros / 1 segundo · seleção e renderer reais de produção', font=font(12), fill=SUB)
    return canvas


def contexts(theme, frame):
    scenarios = [
        ('flight', 'Lançamento'), ('return', 'Retorno'), ('copies', '6 manifestações'),
        ('orbitals', '8 órbitas'), ('concepts', 'Aura de Tempo + Vida')
    ]
    canvas = Image.new('RGB', (1500, 1260), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 12), 'Os mesmos corpos em contextos reais', font=font(24), fill=FG)
    draw.text((18, 47), 'Atual · cenas 2× sem suavização · quantidade, órbitas, retorno e conceitos preservados', font=font(14), fill=SUB)
    for column, (element, label) in enumerate(ELEMENTS):
        x = 18 + column * 370
        draw.text((x, 78), label, font=font(18), fill=FG)
        for row, (scenario, description) in enumerate(scenarios):
            y = 115 + row * 224
            draw.text((x, y - 15), description, font=font(11), fill=SUB)
            image = load(f'{element}-{scenario}', theme, 'current', frame)
            canvas.paste(image.resize((360, 210), Image.Resampling.NEAREST), (x, y))
    theme_label = 'Noite' if theme == 'night' else 'Dia'
    draw.text((18, 1240), f'{theme_label} · quadros do renderer de produção, sem redesenho da prévia', font=font(12), fill=SUB)
    return canvas


def save(sequence, name):
    sequence[0].save(OUT / f'{name}.png')
    # One palette for the complete loop prevents frame-dependent color flicker.
    # The shared atlas is sampled only for palette selection; output pixels are
    # quantized at full resolution, without resizing or dithering.
    sample_width = 360
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
    save([hero(theme, frame) for frame in range(8)], f'comparison-{theme}')
    save([contexts(theme, frame) for frame in range(8)], f'contexts-{theme}')
print('Saved frozen/current comparisons and production contexts: eight frames, one-second loops.')
