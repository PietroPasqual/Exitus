from PIL import Image, ImageDraw
from pathlib import Path
import sys,json
p=Path(sys.argv[1]);elems=json.loads((p/'manifest.json').read_text())['elements']
for night in [False,True]:
 im=Image.new('RGB',(1080,1100),'#152032');d=ImageDraw.Draw(im)
 d.text((8,4),'Real renderer | row: primary / column: secondary | frame 0 | no fusion',fill='white')
 for i,a in enumerate(elems):
  d.text((0,62+i*64),a,fill='white');d.text((78+i*62,27),a[:7],fill='white')
  for j,b in enumerate(elems):
   q=Image.frombytes('RGBA',(180,105),(p/f'{i}-{j}-{str(night).lower()}.rgba').read_bytes()).convert('RGB').crop((68,24,116,72))
   im.paste(q,(78+j*62,54+i*64))
 im.save(p/('night.png' if night else 'day.png'))
