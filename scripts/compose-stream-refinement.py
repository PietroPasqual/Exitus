"""Focused real-renderer comparison with the previously delivered local direction.
python scripts/compose-stream-refinement.py <proof-folder> [focus-ids] [output-prefix]
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,sys
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',10)
entries={e['id']:e for e in m['entries']}
keys=sys.argv[2].split(',') if len(sys.argv)>2 else m['focus']
prefix=sys.argv[3] if len(sys.argv)>3 else 'focused'
crop=(27,55,145,96)
for theme in ['day','night']:
 frames=[]
 for f in range(8):
  im=Image.new('RGB',(972,260*len(keys)+32),'#152032');d=ImageDraw.Draw(im)
  d.text((12,7),'REFINAMENTO LOCAL | mesmo circulo e mesmos materiais',font=font,fill='#e9e4d8')
  for row,key in enumerate(keys):
   y=32+row*260;d.text((12,y),entries[key]['label'],font=font,fill='white')
   for col,version in enumerate(['before','after']):
    x=12+col*480;raw=Image.frombytes('RGBA',(180,105),(p/f'{key}-{theme}-{version}-{f}.rgba').read_bytes()).convert('RGB')
    d.text((x,y+18),m['baselineLabel'] if col==0 else m['currentLabel'],font=small,fill='#b7c4d6')
    im.paste(raw.crop(crop).resize((472,164),Image.Resampling.NEAREST),(x,y+34))
    d.text((x+142,y+219),'1x',font=small,fill='#b7c4d6');im.paste(raw.crop(crop),(x+177,y+206))
  frames.append(im)
 frames[0].save(p/f'{prefix}-{theme}.png')
 frames[0].save(p/f'{prefix}-{theme}.gif',save_all=True,append_images=frames[1:],duration=[120,130]*4,loop=0,disposal=2)
 # Four material gestures, at 0/2/4/6; full body crop, not a different renderer.
 im=Image.new('RGB',(976,196*len(keys)),'#152032');d=ImageDraw.Draw(im)
 for row,key in enumerate(keys):
  for col,f in enumerate([0,2,4,6]):
   x=col*244;y=row*196;raw=Image.frombytes('RGBA',(180,105),(p/f'{key}-{theme}-after-{f}.rgba').read_bytes()).convert('RGB')
   d.text((x+4,y+4),entries[key]['label']+' / '+str(f),font=small,fill='white')
   im.paste(raw.crop(crop).resize((236,82),Image.Resampling.NEAREST),(x+4,y+24));d.text((x+30,y+132),'1x',font=small,fill='#b7c4d6');im.paste(raw.crop(crop),(x+64,y+120))
 im.save(p/f'{"keyposes" if prefix=="focused" else prefix+"-keyposes"}-{theme}.png')
