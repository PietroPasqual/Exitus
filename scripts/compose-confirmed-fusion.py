from PIL import Image,ImageDraw,ImageFont
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);cases=json.loads((p/'cases.json').read_text());font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
frames=[]
for f in range(8):
 out=Image.new('RGB',(1160,830),'#172132');d=ImageDraw.Draw(out)
 d.text((12,8),'Circuitos reais -> analyzeFlow -> checkLigacao -> describeAppearance -> renderer | nativo + 3x',font=font,fill='white')
 for i,c in enumerate(cases):
  x=(i%2)*580;y=38+(i//2)*263;d.text((x+12,y),c['title'],font=font,fill='white')
  im=Image.frombytes('RGBA',(180,105),(p/f'{i}-true-{f}.rgba').read_bytes()).convert('RGB')
  out.paste(im,(x+12,y+58));out.paste(im.crop((43,10,143,84)).resize((300,222),Image.Resampling.NEAREST),(x+230,y+24))
  groups=[g['elements']for b in c['appearance']['beings']for g in b.get('materialFusion',[])]
  d.text((x+12,y+174),'Fusoes fisicas confirmadas:',font=small,fill='#aab9ca')
  for k,g in enumerate(groups or [['nenhuma']]):d.text((x+12,y+190+k*16),' + '.join(g),font=small,fill='white')
 d.text((12,810),'Prova de representacao, sem alterar regras/circulo. Circuitos e resultados completos em cases.json.',font=small,fill='#aab9ca')
 frames.append(out)
frames[0].save(p/'comparison.png');frames[0].save(p/'comparison.gif',save_all=True,append_images=frames[1:],duration=[120,130]*4,loop=0,disposal=2,optimize=False)
# Actual native pixel delta between the two four-material proofs
summary=[]
for f in range(8):
 a=(p/f'3-true-{f}.rgba').read_bytes();b=(p/f'4-true-{f}.rgba').read_bytes();summary.append(sum(a[i:i+4]!=b[i:i+4] for i in range(0,len(a),4)))
(p/'comparison-delta.json').write_text(json.dumps({'twoGroups_vs_onlyWaterIce_pixels':summary}))
print(summary)
