from PIL import Image,ImageDraw
from pathlib import Path
import sys
p=Path(sys.argv[1]);frames=[]
for f in range(8):
 im=Image.new('RGB',(1080,470),'#152032'); d=ImageDraw.Draw(im)
 for i,label in enumerate(['before','after']):
  q=Image.frombytes('RGBA',(180,105),(p/f'{label}-{f}.rgba').read_bytes()).convert('RGB')
  d.text((i*540+12,8),['ANTES - chama mantida','REVISADO - jato continuo'][i],fill='white');im.paste(q.resize((540,315),Image.Resampling.NEAREST),(i*540,35));im.paste(q,(i*540+180,360))
 frames.append(im)
frames[0].save(p/'comparison.png');frames[0].save(p/'comparison.gif',save_all=True,append_images=frames[1:],duration=[120,130]*4,loop=0,disposal=2)
sheet=Image.new('RGB',(1440,470),'#152032')
for f in range(8):
 q=Image.frombytes('RGBA',(180,105),(p/f'after-{f}.rgba').read_bytes()).convert('RGB');sheet.paste(q.resize((360,210),Image.Resampling.NEAREST),((f%4)*360,(f//4)*235))
sheet.save(p/'cycle.png')
