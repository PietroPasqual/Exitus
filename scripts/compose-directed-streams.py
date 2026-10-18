from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,sys
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());entries={q['id']:q for q in m['entries']}
def raw(key,theme,version,f):return Image.frombytes('RGBA',(180,105),(p/f'{key}-{theme}-{version}-{f}.rgba').read_bytes()).convert('RGB')
for name,keys in [('first4',m.get('focus',['agua','gelo','terra','raio'])),('mixed',['agua-gelo','gelo-agua','raio-metal','metal-raio','agua-gelo-fogo'])]:
 for theme in ['day','night']:
  frames=[]
  for f in range(8):
   im=Image.new('RGB',(744,370*len(keys)+48),'#152032');d=ImageDraw.Draw(im)
   d.text((12,10),'MESMO CIRCULO: Estado + Direcao | Integracao local',font=font,fill='white')
   for i,key in enumerate(keys):
    y=42+i*370;d.text((12,y),entries[key]['label'],font=font,fill='#eee5d2')
    for j,v in enumerate(['before','after']):
     x=12+j*366;q=raw(key,theme,v,f)
     d.text((x,y+17),[m.get('baselineLabel','PUBLICADO'),m.get('currentLabel','JATO DO MATERIAL')][j],font=font,fill='#aebdd2')
     im.paste(q.resize((360,210),Image.Resampling.NEAREST),(x,y+34))
     im.paste(q,(x+90,y+252))

   frames.append(im)
  frames[0].save(p/f'{name}-{theme}.png');frames[0].save(p/f'{name}-{theme}.gif',save_all=True,append_images=frames[1:],duration=[120,130]*4,loop=0,disposal=2)
for theme in ['day','night']:
 keys=list(entries)[:16];frames=[]
 for f in range(8):
  sheet=Image.new('RGB',(720,4*126),'#152032');d=ImageDraw.Draw(sheet)
  for i,key in enumerate(keys):
   x=(i%4)*180;y=(i//4)*126;d.text((x+3,y+3),entries[key]['label'],font=font,fill='white');sheet.paste(raw(key,theme,'after',f),(x,y+21))
  frames.append(sheet)
 frames[2].save(p/f'all16-native-{theme}.png')
 frames[0].save(p/f'all16-native-{theme}.gif',save_all=True,append_images=frames[1:],duration=[120,130]*4,loop=0,disposal=2)
