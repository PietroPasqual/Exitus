"""Render byte-exact Pix captures as labelled native sheets and 8fps GIFs."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text())
records = manifest['records']
elements = manifest['elements']
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 9)
roles = ['whole', 'primary', 'secondary']
raw = root / 'rgba'

def image(record):
    return Image.frombytes('RGBA', (record['width'], record['height']), (raw / record['file']).read_bytes())

def plate(element, role, frame, diameter=25, grayscale=False):
    return next(r for r in records if r['type'] == 'isolated-sampler' and r['element'] == element
        and r['role'] == role and r['frame'] == frame and r['diameter'] == diameter and r['grayscale'] == grayscale)

def production(element, role, frame, night):
    return next(r for r in records if r['type'] == 'production' and r['element'] == element
        and r['role'] == role and r['frame'] == frame and r['night'] == night)

def paste(canvas, tile, at, bg):
    backing = Image.new('RGBA', tile.size, bg)
    backing.alpha_composite(tile)
    canvas.paste(backing.convert('RGB'), at)

for gray in [False, True]:
    for diameter in [25, 11]:
        canvas = Image.new('RGB', (991, 738), '#17202c')
        draw = ImageDraw.Draw(canvas)
        draw.text((8, 7), f'ISOLATED SAMPLER | {diameter}px body | ' + ('SAME GRAY PALETTE' if gray else 'PRODUCTION PALETTES'), font=font, fill='white')
        draw.text((8, 23), 'Real Pix raster. Whole / primary 60% / secondary 40%. Fixed contour. These are not production allocations.', font=small, fill='#becbd3')
        for ri, role in enumerate(roles):
            start = 91 + ri * 300
            draw.text((start, 42), role, font=font, fill='white')
            for frame in range(8): draw.text((start + frame * 37 + 14, 57), str(frame), font=small, fill='#becbd3')
        for i, element in enumerate(elements):
            y = 75 + i * 40
            draw.text((7, y + 11), element, font=font, fill='white')
            for ri, role in enumerate(roles):
                for frame in range(8): paste(canvas, image(plate(element, role, frame, diameter, gray)), (91 + ri * 300 + frame * 37, y), '#293542')
        draw.text((8, 724), 'Eight local phases. Tiny regions keep the main value split/rib; bubbles, secondary branches and stars are deliberately dropped.', font=small, fill='#becbd3')
        canvas.save(root / f'sampler-{diameter}-{"gray" if gray else "color"}-native.png')

for night in [False, True]:
    canvas = Image.new('RGB', (1278, 908), '#17202c')
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 8), 'ACTUAL PRODUCTION RENDERER | ' + ('night' if night else 'day') + ' | 48px native crops', font=font, fill='white')
    draw.text((8, 25), 'Peer: metal, except metal / water and lightning / nature. Sampled roles, not exhaustive pair/shape/fusion acceptance.', font=small, fill='#becbd3')
    for ri, role in enumerate(roles):
        start = 91 + ri * 394
        draw.text((start, 44), 'pure baseline' if role == 'whole' else f'{role} role', font=font, fill='white')
        for frame in range(8): draw.text((start + frame * 49 + 20, 58), str(frame), font=small, fill='#becbd3')
    for i, element in enumerate(elements):
        y = 74 + i * 51
        draw.text((7, y + 13), element, font=font, fill='white')
        for ri, role in enumerate(roles):
            for frame in range(8):
                record = production(element, role, frame, night)
                pix = image(record)
                cx, cy = round(record['center']['x']), round(record['center']['y'])
                paste(canvas, pix.crop((cx - 24, cy - 24, cx + 24, cy + 24)), (91 + ri * 394 + frame * 49, y), '#293542')
    canvas.save(root / f'production-{"night" if night else "day"}-native.png')

for kind in ['sampler', 'production']:
    frames = []
    for frame in range(8):
        canvas = Image.new('RGB', (644, 433), '#17202c')
        draw = ImageDraw.Draw(canvas)
        draw.text((8, 6), f'{kind.upper()} | eight-frame loop, 8fps | 2x nearest-neighbor', font=font, fill='white')
        for i, element in enumerate(elements):
            col, row = i % 4, i // 4
            x, y = col * 160 + 7, row * 101 + 28
            draw.text((x, y), element, font=font, fill='white')
            for ri, role in enumerate(['primary', 'secondary']):
                if kind == 'sampler': tile = image(plate(element, role, frame))
                else:
                    record = production(element, role, frame, True)
                    p = image(record)
                    cx, cy = round(record['center']['x']), round(record['center']['y'])
                    tile = p.crop((cx - 18, cy - 18, cx + 18, cy + 18))
                paste(canvas, tile.resize((72, 72), Image.Resampling.NEAREST), (x + ri * 76, y + 14), '#293542')
        frames.append(canvas)
    frames[0].save(root / f'{kind}-roles-8fps.gif', save_all=True, append_images=frames[1:], duration=125, loop=0, disposal=2)
print('Created four isolated sampler sheets, two actual production sheets and two 8fps role GIFs.')
