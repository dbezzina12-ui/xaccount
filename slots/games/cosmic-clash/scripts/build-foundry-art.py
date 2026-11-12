"""Vector masters for the Cosmic Clash cabinet insignia and the FS treasure rig.
Run from the repository root. The atlas images have the UV space of the original rig.
"""
from pathlib import Path
from math import sqrt
import hashlib,json,subprocess,tempfile
from xml.sax.saxutils import escape
out=Path('dist/assets/frontier-ink')
features=out/'features'
rig=Path('dist/assets/spine-v96/fs-vault')
def grad(key,colors,x1='0%',y1='0%',x2='0%',y2='100%'):
 return f'<linearGradient id="{key}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'+''.join(f'<stop offset="{n}%" stop-color="{c}"/>' for n,c in colors)+'</linearGradient>'
def path(d,fill,stroke=None,sw=1,more=''):
 return f'<path d="{d}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else '')+f' {more}/>'
def coords(pts):
 return 'M'+' '.join(f'{x:.2f},{y:.2f}' for x,y in pts)+'Z'
def off(p,dist):
 def unit(a,b):
  dx,dy=b[0]-a[0],b[1]-a[1];l=sqrt(dx*dx+dy*dy);return -dy/l,dx/l
 sign=1 if sum(p[i-1][0]*y-x*p[i-1][1] for i,(x,y) in enumerate(p))>0 else -1
 z=[]
 for i,(x,y) in enumerate(p):
  n=unit(p[i-1],p[i]);m=unit(p[i],p[(i+1)%len(p)]);d=sign*dist/(1+n[0]*m[0]+n[1]*m[1]);z.append((x+d*(n[0]+m[0]),y+d*(n[1]+m[1])))
 return z
def svg(w,h,body,v=None,title=''):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {v or f"{w} {h}"}">'+(f'<title>{escape(title)}</title>' if title else '')+body+'</svg>'
def stroke(d,col,w):
 return path(d,'none',col,w)
def save(p,data):p.write_text(data+'\n')
def img(src,dest):
 subprocess.run(['inkscape',str(src),'--export-filename='+str(dest.absolute())],capture_output=True,check=True)
def rgb(a,b,t):
 a=bytes.fromhex(a.lstrip('#'));b=bytes.fromhex(b.lstrip('#'));return '#'+''.join('%02x'%round(i+(j-i)*t) for i,j in zip(a,b))
def metalGlyph(p,bevel=7):
 # Every wall and facet has its actual edge normal. No letter shadows painted into the face.
 inner=off(p,bevel);bot=[(x+7,y+16) for x,y in p];d=coords(p)
 s=path(coords(bot),'#30231b','#182326',5)
 for i,a in enumerate(p):
  j=(i+1)%len(p);b=p[j];dx,dy=b[0]-a[0],b[1]-a[1];l=sqrt(dx*dx+dy*dy);k=(1+(dy/l*.76-dx/l*.57))/2
  s+=path(coords([a,b,bot[j],bot[i]]),rgb('453222','b9844b',k))
 s+=path(d,'url(#face)','#58462e',2.6)
 for i,a in enumerate(p):
  j=(i+1)%len(p);b=p[j];dx,dy=b[0]-a[0],b[1]-a[1];l=sqrt(dx*dx+dy*dy)
  k=(1+(dx*.80-dy*.59)/l)/2
  c=rgb('936337','fff0c6',k**1.34)
  s+=path(coords([a,b,inner[j],inner[i]]),c,c,.45)
 s+=path(coords(inner),'url(#face)','#b68a51',1.1)
 return s
# Wide upright custom display alphabet: flat terminals, clipped corners, deliberate spacing.
abc={
'C':(72,'M23 0H71V12L64 18H27Q18 18 18 28V61Q18 71 28 71H71V83L65 89H23Q0 89 0 65V24Q0 0 23 0Z'),
'O':(78,'M25 0H51Q76 0 76 26V63Q76 89 51 89H25Q0 89 0 63V26Q0 0 25 0ZM29 18Q18 18 18 30V59Q18 71 29 71H47Q58 71 58 59V30Q58 18 47 18Z'),
'S':(73,'M24 0H71V12L64 18H26Q18 18 18 26V29Q18 35 26 36L48 39Q72 42 72 61V65Q72 89 47 89H0V77L7 71H46Q54 71 54 64V61Q54 55 47 54L24 51Q0 48 0 29V24Q0 0 24 0Z'),
'M':(91,'M0 89V0H18L44 38L70 0H88V89H70V30L45 64H42L18 30V89Z'),
'I':(19,'M0 0H18V89H0Z'),
'L':(67,'M0 0H18V70H65V83L59 89H0Z'),
'A':(79,'M0 89L29 0H49L78 89H59L53 69H25L19 89ZM30 53H48L39 22Z'),
'H':(77,'M0 0H18V35H56V0H74V89H56V54H18V89H0Z')}
titledefs=grad('steel',[(0,'#fbf8e9'),(30,'#e3e8e1'),(48,'#cdd8d5'),(68,'#abbcb9'),(100,'#e3dfc9')])+grad('amber',[(0,'#ffe8bc'),(30,'#f3c589'),(48,'#edb67b'),(70,'#cf9662'),(100,'#e6bb84')])+grad('plate',[(0,'#354e52'),(18,'#263c41'),(53,'#192c31'),(100,'#101d23')])+grad('edge',[(0,'#aeb8ab'),(15,'#5e7473'),(68,'#344b52'),(95,'#ab8a62'),(100,'#493c35')])
# Framed top and bottom with just one warm horizon and a small sight pin.
plate='M17 57L43 31H855L882 58V137L854 165H43L17 139Z'
s='<defs>'+titledefs+'</defs>'+path('M12 62L40 34H856L888 62V141L859 172H39L12 144Z','#101b22')+path(plate,'url(#plate)','url(#edge)',3.1)
s+=stroke('M44 35H341M558 35H854','#b6b7a2',1.1)+stroke('M41 156H852','#0a141a',2)+stroke('M51 161H365M533 161H846','#94714d',1.4)
for x in [30,869]:
 s+=path(f'M{x-3} 80h6v36h-6z','#0b171e')+stroke(f'M{x} 83v25','#83c6c3',1.8)
text='COSMIC CLASH';width=sum(abc.get(c,(35,''))[0] for c in text)+8*(len(text)-2)
scaleX=804/width;start=48
s+='<g transform="translate(0 49) scale(1 1.07)">'
for i,c in enumerate(text):
 if c==' ':start+=35*scaleX;continue
 wid,d=abc[c]
 s+=f'<g transform="translate({start:.3f} 0) scale({scaleX:.5f} 1)">'
 s+=f'<g transform="translate(1.3 2.8)">'+path(d,'#07151a',None,more='fill-rule="evenodd"')+'</g>'+path(d,'url(#'+('steel' if i<6 else 'amber')+')',None,more='fill-rule="evenodd"')+'</g>'
 start+=(wid+8)*scaleX
s+='</g>'
s+=path('M367 160H434L450 152L466 160H533L467 162L450 169L433 162Z','#182a30')+path('M420 160H439L450 155L461 160H480L460 162L450 166L440 162Z','#d0a471')+path('M445 160.6L450 158L455 160.6L450 163Z','#d1f1e5')
# Seat the metal nameplate immediately above the cabinet; previous logo occupied the full cap depth.
s='<g transform="translate(-6 -16) scale(1.0133 1.08)">'+s+'</g>'
save(out/'title.svg',svg(2143,516,s,'900 216','Cosmic Clash'))
# FS is a matched pair of cast, machined letters rather than type outlined in black.
defs=grad('face',[(0,'#fff2cb'),(16,'#ffe5ac'),(35,'#f6cc81'),(51,'#e7ab56'),(57,'#f3c578'),(76,'#e5aa58'),(100,'#b47836')],'0%','0%','32%','100%')
F=[(31,32),(235,32),(235,84),(95,84),(95,143),(214,143),(214,194),(95,194),(95,295),(31,295)]
S=[(299,32),(434,32),(469,62),(469,109),(411,109),(411,92),(402,83),(329,83),(317,95),(317,126),(329,138),(434,138),(469,171),(469,254),(430,295),(293,295),(254,259),(254,221),(313,221),(313,237),(323,247),(400,247),(411,235),(411,202),(399,190),(296,190),(257,154),(257,75)]
fsFace='<g transform="matrix(.992 -.043 -.068 .985 22 15)">'+metalGlyph(F,8)+metalGlyph(S,8)+'</g>'
fdefs='<defs>'+defs+'</defs>'
save(features/'fs.svg',svg(512,360,fdefs+fsFace,title='Free spins'))
# Lid and body are independent attachments. Facings and the teal lock lamp share a light source.
vaultdefs=grad('armor',[(0,'#719094'),(18,'#435f65'),(63,'#253e46'),(100,'#172b34')])+grad('seam',[(0,'#182e36'),(48,'#49727a'),(100,'#111f2a')])+grad('brass',[(0,'#f7d095'),(22,'#c7975d'),(46,'#9a693d'),(76,'#dda664'),(100,'#775238')])+grad('deep',[(0,'#0f232c'),(52,'#337277'),(100,'#80dccc')])+grad('side',[(0,'#334e58'),(75,'#1c303c'),(100,'#4d6060')])
lid=path('M84 84L108 47 417 27 436 49 480 141 472 179 418 207 150 208Z','url(#brass)','#14232b',6)
lid+=path('M102 87L125 65 426 47 470 140 461 169 411 194 158 194Z','url(#armor)','#293a3e',4)
lid+=path('M123 85L144 74 411 57 451 141 434 166 407 181 167 179Z','url(#seam)','#132830',4)
lid+=path('M139 88L403 71 437 138 419 155 177 166Z','#172f38','#648086',3)
lid+=path('M151 93L398 78 403 88 157 104Z','#7cafad')+path('M164 109L403 94 421 132 408 143 184 153Z','url(#armor)')
lid+=stroke('M105 69L119 52 406 34','#f7ddb3',3)+stroke('M444 110L459 141 454 154','#d0a370',2)
body=path('M32 328L73 261 149 183 418 183 472 263 484 317 482 383 458 402 378 437 101 413 39 401 31 389Z','#17262f','#16212a',6)
body+=path('M39 321L78 257 150 184 416 184 469 264 481 316 378 361 91 341Z','url(#brass)','#25343a',4)
body+=path('M54 313L91 257 156 195 409 195 452 263 462 296 373 338 125 320Z','url(#armor)','#182c34',4)
body+=path('M72 308L109 261 163 208 402 206 445 271 447 287 370 324 140 308Z','url(#deep)','#162e35',4)
body+=stroke('M83 303L165 213 397 210 435 263','#87cfbd',4)
body+=path('M40 323L94 335 376 354 481 309 478 384 377 431 109 408 40 395Z','url(#armor)','#172930',4)
body+=path('M377 355L481 310 478 382 377 431Z','url(#side)','#1b3038',4)
body+=path('M41 322L96 334 376 353 480 309 479 325 375 369 91 348 40 336Z','url(#brass)','#2a3639',3)
body+=stroke('M47 323L99 335 372 354 470 314','#edc893',2.8)
body+=path('M120 357L314 371 322 379 318 399 309 403 121 385 115 378Z','url(#seam)','#162930',3)
for i in range(8):
 x=133+i*20;y=364+i*1.65
 body+=path(f'M{x} {y}l8 .6 -4 13 -8 -.6Z','#152933')+stroke(f'M{x+9} {y+1}l-4 13','#6d898a',1.4)
for x,y in [(63,340),(331,359)]:
 body+=path(f'M{x} {y}l27 2 8 10 -1 37 -8 6 -23 -3 -7 -10Z','url(#brass)','#283439',3)+path(f'M{x+6} {y+7}l17 1 3 5 -1 16 -16 -2 -4 -6Z','url(#side)','#253d42',2)+stroke(f'M{x+6} {y+4}l18 1','#ffe4b3',2.5)
for i in range(4):
 x=391+i*18;y=369-i*8
 body+=path(f'M{x} {y}l10 -4 -2 18 -9 5Z','#162a33')+stroke(f'M{x+11} {y-4}l-2 19','#627b7d',1.5)
body+=path('M213 382l46 3 -3 7 -45 -4z','#142a32')+path('M219 384l31 2 -1 2 -31 -2Z','#a6fbdb')
for x,y in [(119,53),(408,39),(449,136),(61,378),(348,407),(453,365)]:
 item=f'<circle cx="{x}" cy="{y}" r="4" fill="#182b32"/><circle cx="{x-.4}" cy="{y-.8}" r="2.5" fill="#98a198"/>'
 if y<150:lid+=item
 else:body+=item
vdefs='<defs>'+vaultdefs+'</defs>'
save(features/'vault.svg',svg(512,512,vdefs+lid+body,title='Bounty vault'))
save(features/'fs-poster.svg',svg(512,512,'<defs>'+vaultdefs+defs+'</defs>'+lid+body+'<g transform="translate(39.46 77.96) scale(.8458334)">'+fsFace+'</g>',title='Free spins'))
with tempfile.TemporaryDirectory() as td:
 sheet=Path(td)/'vault.svg'
 save(sheet,svg(1774,887,vdefs+'<g transform="scale(1.8867924528) translate(-10 -35)">'+body+'</g><g transform="scale(2.1097046414 1.9230769231) translate(343.77 71.4)">'+lid+'</g>'))
 img(sheet,features/'vault-page.png')
img(features/'fs.svg',features/'fs-page.png')
meta=json.loads((rig/'rig-manifest.json').read_text())
for key,name in [('vault-parts-v2','vault-page'),('letters','fs-page')]:
 meta['textures'][key]['sha256']=hashlib.sha256((features/(name+'.png')).read_bytes()).hexdigest()
meta['artTreatment']='Foundry: gunmetal vault, brass fittings and separately bevelled cast-gold letters, drawn in the registered attachment coordinates.'
(rig/'rig-manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
