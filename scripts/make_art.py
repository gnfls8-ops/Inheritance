"""Original INHERITANCE raster art. Deterministic authoring; Pillow only, never run at game startup."""
from PIL import Image, ImageDraw
import random, math, json
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'public/art';OUT.mkdir(parents=True,exist_ok=True)
art={}
def new(w,h):
 im=Image.new('RGBA',(w,h));return im,ImageDraw.Draw(im)
def shade(c,n):return tuple(max(0,min(255,v+n)) for v in c[:3])+(255,)
for kind,base in [('grass',(104,116,69)),('forest',(84,98,58)),('rockfloor',(117,119,92)),('water',(49,104,110))]:
 for variant in range(4):
  r=random.Random(500+variant);im,d=new(64,32)
  for y in range(32):
   for x in range(64):
    if abs((x-31.5)/32)+abs((y-15.5)/16)<=1.02:
     noise=r.choice([-10,-5,-2,0,0,2,4,7]);im.putpixel((x,y),shade(base,noise))
  for i in range(45):
   x=r.randrange(5,59);y=r.randrange(3,29)
   if im.getpixel((x,y))[3]:
    if kind=='water':d.line((x,y,min(x+5,61),y),fill=(107,155,148,90))
    else:d.line((x,y,x+1,y-2),fill=shade(base,r.choice([-17,12,20])))
  art[f'{kind}{variant}']=im
for v in range(6):
 r=random.Random(800+v);im,d=new(112,152)
 d.ellipse((16,129,99,149),fill=(15,30,22,55))
 d.polygon([(51,137),(56,51),(63,50),(64,132),(78,140),(61,138),(47,144)],fill='#554b35')
 d.line((56,133,60,60),fill='#8d7953',width=3)
 for x,y in [(25,60),(84,50),(33,35),(79,26)]:d.line((60,95,x,y),fill='#62543b',width=4)
 centers=[(58,35,29,27),(32,65,25,25),(80,63,27,24),(55,79,31,24),(61,55,31,30)]
 if v%3==1:centers=[(56,23,21,23),(35,48,24,24),(78,49,24,25),(57,72,31,24)]
 for cx,cy,rx,ry in centers:
  d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill='#2e4932')
  for i in range(210):
   x=r.uniform(-rx,rx);y=r.uniform(-ry,ry)
   if x*x/rx**2+y*y/ry**2>1:continue
   light=int(13-0.35*x-0.45*y)+r.randrange(-13,14)
   col=shade((64+v%2*7,88+v%3*3,45),light)
   w=r.randrange(2,6);h=r.randrange(1,4)
   d.rectangle((int(cx+x),int(cy+y),int(cx+x)+w,int(cy+y)+h),fill=col)
 d.line((53,131,59,115),fill='#b29a6a',width=1)
 art[f'tree{v}']=im
for v in range(4):
 r=random.Random(100+v);im,d=new(72,58)
 d.ellipse((5,37,69,56),fill=(12,24,18,65))
 points=[(7,38),(13,19),(28,8+v),(48,9),(65,28),(61,46),(35,52)]
 d.polygon(points,fill='#777b70');d.polygon([(13,19),(28,8+v),(48,9),(39,27),(7,38)],fill='#aaa99a')
 d.polygon([(39,27),(48,9),(65,28),(61,46),(35,52)],fill='#626e65')
 for i in range(110):
  x=r.randrange(10,62);y=r.randrange(13,47)
  if im.getpixel((x,y))[3]==255:d.point((x,y),fill=r.choice(['#c1bda6','#555e55','#8e9680']))
 d.line((28,10,32,23,24,36),fill='#59625b',width=1)
 for i in range(25):
  x=r.randrange(14,53);y=r.randrange(35,47);d.rectangle((x,y,x+2,y+1),fill=r.choice(['#657643','#86915b','#4e663f']))
 art[f'rock{v}']=im
for v in range(3):
 im,d=new(52,40);r=random.Random(600+v)
 d.ellipse((5,24,48,38),fill=(21,32,18,55))
 for i in range(80):
  x=r.randrange(7,45);y=r.randrange(10,30);d.line((26,34,x,y),fill='#627446');d.ellipse((x-2,y-2,x+3,y+1),fill=r.choice(['#3f6038','#647c43','#8e9857','#b2ae6b']))
  if v==1 and i%9==0:d.point((x,y),fill='#bd836d')
 art[f'shrub{v}']=im
for v in range(2):
 im,d=new(100,92);r=random.Random(95+v)
 d.ellipse((5,66,94,88),fill=(15,25,15,65))
 d.polygon([(12,67),(44,16),(89,48),(79,79)],fill='#877953')
 d.polygon([(44,16),(54,66),(79,79),(89,48)],fill='#a2956e')
 d.polygon([(12,67),(44,16),(54,66)],fill='#4a4937')
 for i in range(80):
  x=r.randrange(48,80);y=r.randrange(26,69)
  if im.getpixel((x,y))[:3]==(162,149,110):d.line((x,y,x+2,y+1),fill='#b5a783')
 d.line((12,70,44,16,80,80),fill='#c4af7e',width=2);d.line((44,16,45,10),fill='#5e4f33',width=3)
 d.line((10,73,9,79),fill='#a28b5d',width=2);d.line((80,80,83,85),fill='#a28b5d',width=2)
 art[f'shelter{v}']=im
for frame in range(6):
 im,d=new(40,56);r=random.Random(frame)
 d.ellipse((4,37,37,53),fill=(226,119,33,35))
 for a in range(0,360,45):
  x=20+12*math.cos(math.radians(a));y=44+5*math.sin(math.radians(a));d.ellipse((x-3,y-2,x+3,y+2),fill='#8b8b73')
 d.line((10,46,30,40),fill='#655039',width=3);d.line((12,40,29,47),fill='#51402c',width=3)
 for i,col in enumerate(['#b85a2d','#e78d3b','#ffd481']):
  y=19+i*7+r.randrange(-4,3);d.polygon([(12+i*2,44),(16+i,y+5),(22+i*2,y),(26-i,44)],fill=col)
 art[f'fire{frame}']=im
for palette in range(3):
 cloth=[(157,133,91),(117,132,112),(165,155,129)][palette]
 for facing in ['front','back']:
  for action in ['idle','walk','work','rest','talk']:
   for f in range(6):
    im,d=new(32,56);phase=math.sin(f/6*math.tau);stride=round(phase*4) if action=='walk' else 0
    bob=round(abs(phase)) if action=='walk' else (1 if f==2 else 0)
    squat=12 if action=='rest' else 0;lean=3 if action=='work' and f<3 else 0
    hip=35+squat//2;head=8+bob+squat
    d.ellipse((7,48,26,54),fill=(13,22,17,70))
    # Seven-head adult figure, independent arms and legs, hide clothing and leather wraps.
    d.line((14,hip,12-stride,44,11-stride,51),fill='#665b45',width=3)
    d.line((18,hip,20+stride,45,21+stride,51),fill='#8a7959',width=3)
    if action=='rest':d.line((13,42,7,46,11,50),fill='#817055',width=3);d.line((18,42,25,47,22,50),fill='#998465',width=3)
    d.line((10-stride,51,13-stride,51),fill='#463e32',width=2);d.line((20+stride,51,24+stride,51),fill='#504637',width=2)
    d.polygon([(12+lean,head+10),(19+lean,head+10),(22,hip+3),(11,hip+3)],fill=shade(cloth,0))
    d.line((13+lean,head+13,13,hip),fill=shade(cloth,21),width=2)
    d.line((19+lean,head+12,21,hip+2),fill=shade(cloth,-28),width=2)
    d.line((11,hip-6,21,hip-5),fill='#65563c',width=2)
    arm=-stride//2
    if action=='work':
     d.line((20+lean,head+13,24,head+21,26,head+15+round(phase*4)),fill='#bc9670',width=2)

    elif action=='talk':d.line((20,head+13,24,head+18,27,head+14+round(phase*2)),fill='#bf9c76',width=2)
    else:d.line((20+lean,head+13,22,head+20,22+arm,head+27),fill='#b48b65',width=2)
    d.line((11+lean,head+13,9,head+20,10-arm,head+27),fill='#a57f5b',width=2)
    d.rectangle((14+lean,head+7,17+lean,head+11),fill='#bd9871')
    d.ellipse((13+lean,head,19+lean,head+8),fill='#d0aa80')
    d.polygon([(13+lean,head+5),(12+lean,head+1),(15+lean,head-1),(19+lean,head),(20+lean,head+4)],fill='#484033')
    if facing=='back':d.rectangle((13+lean,head+3,19+lean,head+7),fill='#504436')
    else:d.point((18+lean,head+4),fill='#4d4639');d.point((19+lean,head+6),fill='#e1bd92')
    art[f'human{palette}-{facing}-{action}{f}']=im
im,d=new(24,25)
d.ellipse((2,15,22,24),fill=(18,29,15,60));d.polygon([(4,8),(19,8),(21,20),(6,22)],fill='#9d8350')
for y in range(10,22,3):d.line((5,y,20,y-1),fill='#c2aa70')
for x in range(7,21,3):d.line((x,8,x+1,21),fill='#705b39')
d.arc((5,0,18,15),180,360,fill='#bc9c66',width=2);art['basket']=im
im,d=new(16,25);d.line((5,24,10,6),fill='#a0875a',width=2);d.polygon([(5,5),(8,0),(15,2),(12,9)],fill='#8a9589');d.line((8,1,14,2),fill='#d0cec0');art['axe']=im
# Tight shelf atlas with two-pixel gutters, shipped prebuilt; no runtime Python dependency.
positions={};x=y=row=0
for name,im in sorted(art.items(),key=lambda item:-item[1].height):
 if x+im.width+2>1024:x=0;y+=row+2;row=0
 positions[name]=(x,y);x+=im.width+2;row=max(row,im.height)
height=y+row+2;atlas=Image.new('RGBA',(1024,height));frames={}
for name,im in art.items():
 x,y=positions[name];atlas.paste(im,(x,y));frames[name]={'frame':{'x':x,'y':y,'w':im.width,'h':im.height},'sourceSize':{'w':im.width,'h':im.height},'spriteSourceSize':{'x':0,'y':0,'w':im.width,'h':im.height},'rotated':False,'trimmed':False}
atlas.save(OUT/'inheritance.png',optimize=True)
(OUT/'inheritance.json').write_text(json.dumps({'frames':frames,'meta':{'image':'inheritance.png','scale':'1','size':{'w':1024,'h':height}}}))
print(f'Authored {len(art)} sprites; atlas 1024×{height}')
