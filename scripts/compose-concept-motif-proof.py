"""Label and enlarge actual native Pix bytes; no generative or substitute artwork."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text())
records, concepts = manifest['records'], manifest['concepts']
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 9)
bg = '#17202c'

def find(**wanted):
    return next(r for r in records if all(r.get(key) == value for key, value in wanted.items()))

def raster(record):
    return Image.frombytes('RGBA', (record['width'], record['height']), (root / 'rgba' / record['file']).read_bytes())

def paste(sheet, tile, xy):
    back = Image.new('RGBA', tile.size, bg)
    back.alpha_composite(tile)
    sheet.paste(back.convert('RGB'), xy)

def crop(record):
    cx, cy = round(record['center']['x']), round(record['center']['y'])
    return raster(record).crop((cx - 28, cy - 28, cx + 28, cy + 28))

def save(sheet, name):
    sheet.save(root / f'{name}-native.png')
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.Resampling.NEAREST).save(root / f'{name}-3x.png')

for gray in [False, True]:
    sheet = Image.new('RGB', (999, 524), bg)
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 7), 'ISOLATED CONCEPT PAINTER | ' + ('SAME PALETTE' if gray else 'PRODUCTION PALETTES'), fill='white', font=font)
    draw.text((8, 23), '56px native tiles | Left: airy concept alone. Right: exterior material accents. All eight paused poses.', fill='#becbd3', font=small)
    for col in range(16): draw.text((86 + col * 57 + 24, 39), str(col % 8), fill='#becbd3', font=small)
    for row, concept in enumerate(concepts):
        draw.text((6, 67 + row * 58), concept, fill='white', font=font)
        for col in range(16):
            record = find(type='isolated-painter', concept=concept, frame=col % 8, samePalette=gray, glow=col < 8)
            paste(sheet, raster(record), (86 + col * 57, 55 + row * 58))
    save(sheet, 'isolated-gray' if gray else 'isolated-color')

for night in [False, True]:
    sheet = Image.new('RGB', (999, 524), bg)
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 7), 'ACTUAL PRODUCTION | ' + ('NIGHT' if night else 'DAY') + ' | concept alone / shaped water', fill='white', font=font)
    draw.text((8, 23), 'Native 56px crops. Original 180 x 105 scenes saved as raw RGBA in the manifest. Frames 0-7 at the unchanged 8fps.', fill='#becbd3', font=small)
    for col in range(16): draw.text((86 + col * 57 + 24, 39), str(col % 8), fill='#becbd3', font=small)
    for row, concept in enumerate(concepts):
        draw.text((6, 67 + row * 58), concept, fill='white', font=font)
        for col in range(16):
            record = find(type='actual-production', concept=concept, frame=col % 8, body=col >= 8, night=night)
            paste(sheet, crop(record), (86 + col * 57, 55 + row * 58))
    save(sheet, 'production-night' if night else 'production-day')

sheet = Image.new('RGB', (739, 986), bg)
draw = ImageDraw.Draw(sheet)
draw.text((8, 7), 'ACTUAL FULL SCENES | phase 0 | Day alone / water; Night alone / water', fill='white', font=font)
for row, concept in enumerate(concepts):
    draw.text((8, 27 + row * 120), concept, fill='white', font=font)
    for col in range(4):
        record = find(type='actual-production', concept=concept, frame=0, body=col % 2 == 1, night=col >= 2)
        paste(sheet, raster(record), (8 + col * 182, 40 + row * 120))
save(sheet, 'full-scenes-frame-0')

for form in ['dragon', 'cube', 'lance']:
    sheet = Image.new('RGB', (739, 986), bg)
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 7), f'ACTUAL {form.upper()} SCENES | Day phase 0 / 4; Night phase 0 / 4', fill='white', font=font)
    for row, concept in enumerate(concepts):
        draw.text((8, 27 + row * 120), concept, fill='white', font=font)
        for col in range(4):
            record = find(type='actual-shaped-production', concept=concept, form=form, frame=(col % 2) * 4, night=col >= 2)
            paste(sheet, raster(record), (8 + col * 182, 40 + row * 120))
    save(sheet, f'production-{form}')
    for night in [False, True]:
        sheet = Image.new('RGB', (999, 524), bg)
        draw = ImageDraw.Draw(sheet)
        draw.text((8, 7), f'ACTUAL {form.upper()} | ' + ('NIGHT' if night else 'DAY') + ' | all eight paused poses', fill='white', font=font)
        for row, concept in enumerate(concepts):
            draw.text((6, 67 + row * 58), concept, fill='white', font=font)
            for frame in range(8):
                record = find(type='actual-shaped-production', concept=concept, form=form, frame=frame, night=night)
                # Two native widths preserve the long lance and dragon wings.
                cx, cy = round(record['center']['x']), round(record['center']['y'])
                tile = raster(record).crop((cx - 56, cy - 28, cx + 56, cy + 28))
                paste(sheet, tile, (86 + frame * 114, 55 + row * 58))
        save(sheet, f'production-{form}-' + ('night' if night else 'day') + '-eight')

for night in [False, True]:
    sheet = Image.new('RGB', (1000, 360), bg)
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 7), 'ACTUAL STACKED CONCEPTS | ' + ('NIGHT' if night else 'DAY') + ' | native eight-pose crops', fill='white', font=font)
    for row, (group, form) in enumerate([(g, f) for g in ['pressao+vida', 'tempo+movimento+caos+infinito'] for f in ['sphere', 'lance']]):
        draw.text((8, 29 + row * 80), group + ' / ' + form, fill='white', font=font)
        for frame in range(8):
            record = find(type='actual-crowded-production', group=group, form=form, frame=frame, night=night)
            cx, cy = round(record['center']['x']), round(record['center']['y'])
            tile = raster(record).crop((cx - 56, cy - 28, cx + 56, cy + 28))
            paste(sheet, tile, (86 + frame * 114, 44 + row * 80))
    save(sheet, 'production-crowded-' + ('night' if night else 'day'))

frames = []
for frame in range(8):
    sheet = Image.new('RGB', (912, 542), bg)
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 6), 'ACTUAL PRODUCTION | eight frames / 8fps | 2x nearest-neighbor | alone / water', fill='white', font=font)
    for i, concept in enumerate(concepts):
        x, y = 8 + (i % 4) * 226, 27 + (i // 4) * 256
        draw.text((x, y), concept, fill='white', font=font)
        for night in [False, True]:
            for body in [False, True]:
                tile = crop(find(type='actual-production', concept=concept, frame=frame, night=night, body=body))
                paste(sheet, tile.resize((112, 112), Image.Resampling.NEAREST), (x + int(body) * 112, y + 15 + int(night) * 114))
    frames.append(sheet)
# GIF stores centiseconds. Alternate 120/130ms so eight frames total exactly
# one second instead of silently truncating every requested 125ms to 120ms.
frames[0].save(root / 'production-8fps.gif', save_all=True, append_images=frames[1:], duration=[120, 130] * 4, loop=0, disposal=2)

if len(sys.argv) > 2:
    baseline = Path(sys.argv[2])
    old_records = json.loads((baseline / 'manifest.json').read_text())['records']
    direction = ['pressao', 'caos', 'infinito', 'vida']

    def old_crop(concept, frame, body):
        r = next(r for r in old_records if r['type'] == 'actual-production' and r['concept'] == concept and r['frame'] == frame and r['body'] == body and r['night'])
        cx, cy = round(r['center']['x']), round(r['center']['y'])
        im = Image.frombytes('RGBA', (r['width'], r['height']), (baseline / 'rgba' / r['file']).read_bytes())
        return im.crop((cx - 28, cy - 28, cx + 28, cy + 28))

    sheet = Image.new('RGB', (1000, 532), bg)
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 8), 'COMPARACAO EXPLICITA | GIF entregue / campos refinados | duplas por fase 0-7', fill='white', font=font)
    draw.text((8, 24), 'Cada dupla: ANTES, REFINADO. Quatro direcoes iniciais, so campo e com Agua. Pixels nativos reais.', fill='#becbd3', font=small)
    for row in range(8):
        concept, body = direction[row // 2], row % 2 == 1
        draw.text((5, 65 + row * 58), concept + (' + agua' if body else ' so'), fill='white', font=small)
        for frame in range(8):
            paste(sheet, old_crop(concept, frame, body), (87 + frame * 114, 52 + row * 58))
            paste(sheet, crop(find(type='actual-production', concept=concept, frame=frame, body=body, night=True)), (143 + frame * 114, 52 + row * 58))
    save(sheet, 'comparison-four')

    comparison = []
    for frame in range(8):
        sheet = Image.new('RGB', (920, 330), bg)
        draw = ImageDraw.Draw(sheet)
        draw.text((8, 7), 'ANTES / REFINADO | quatro gestos | 8 quadros por segundo | 2x sem suavizacao', fill='white', font=font)
        for i, concept in enumerate(direction):
            x, y = 8 + i % 2 * 458, 31 + i // 2 * 147
            draw.text((x, y), concept.upper(), fill='white', font=font)
            for body in [False, True]:
                draw.text((x + int(body) * 226, y + 14), ('CAMPO' if not body else 'AGUA') + ' | antes / refinado', fill='#becbd3', font=small)
                old = old_crop(concept, frame, body)
                new = crop(find(type='actual-production', concept=concept, frame=frame, body=body, night=True))
                paste(sheet, old.resize((112, 112), Image.Resampling.NEAREST), (x + int(body) * 226, y + 28))
                paste(sheet, new.resize((112, 112), Image.Resampling.NEAREST), (x + int(body) * 226 + 112, y + 28))
        comparison.append(sheet)
    comparison[0].save(root / 'comparison-four-8fps.gif', save_all=True, append_images=comparison[1:], duration=[120, 130] * 4, loop=0, disposal=2)
    sheet = Image.new('RGB', (1000, 994), bg)
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 8), 'ANTES / REFINADO | oito conceitos | duplas de pixels nativos em cada fase 0-7', fill='white', font=font)
    draw.text((8, 24), 'Antes: fonte exata do GIF entregue. Refinado: renderer atual. Cada conceito: campo / Agua.', fill='#becbd3', font=small)
    for row in range(16):
        concept, body = concepts[row // 2], row % 2 == 1
        draw.text((5, 65 + row * 58), concept + (' + agua' if body else ' so'), fill='white', font=small)
        for frame in range(8):
            paste(sheet, old_crop(concept, frame, body), (87 + frame * 114, 52 + row * 58))
            paste(sheet, crop(find(type='actual-production', concept=concept, frame=frame, body=body, night=True)), (143 + frame * 114, 52 + row * 58))
    save(sheet, 'comparison-eight')
    comparison = []
    for frame in range(8):
        sheet = Image.new('RGB', (920, 624), bg)
        draw = ImageDraw.Draw(sheet)
        draw.text((8, 7), 'ANTES / REFINADO | oito conceitos | 8 quadros por segundo | 2x sem suavizacao', fill='white', font=font)
        for i, concept in enumerate(concepts):
            x, y = 8 + i % 2 * 458, 31 + i // 2 * 147
            draw.text((x, y), concept.upper(), fill='white', font=font)
            for body in [False, True]:
                draw.text((x + int(body) * 226, y + 14), ('CAMPO' if not body else 'AGUA') + ' | antes / refinado', fill='#becbd3', font=small)
                paste(sheet, old_crop(concept, frame, body).resize((112, 112), Image.Resampling.NEAREST), (x + int(body) * 226, y + 28))
                new = crop(find(type='actual-production', concept=concept, frame=frame, body=body, night=True))
                paste(sheet, new.resize((112, 112), Image.Resampling.NEAREST), (x + int(body) * 226 + 112, y + 28))
        comparison.append(sheet)
    comparison[0].save(root / 'comparison-eight-8fps.gif', save_all=True, append_images=comparison[1:], duration=[120, 130] * 4, loop=0, disposal=2)
print(f'Created native + 3x isolated, production, full-scene, dragon/cube/lance sheets and an eight-frame GIF. Integrated: {manifest["productionIntegrated"]}')
