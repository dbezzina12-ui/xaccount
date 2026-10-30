"""Original vector typography and mechanical UI. Run with Python 3 + Inkscape.
Sources use DejaVu Sans Bold; PNG exports are the integration contract.
"""
from pathlib import Path
import subprocess, math, json, hashlib
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[2]
ROOT.mkdir(exist_ok=True)
SRC=Path(__file__).resolve().parent
assets=[]
def svg(name,folder,w,h,body):
    defs='''<defs>
    <linearGradient id="metal" x2="0" y2="1"><stop stop-color="#566167"/><stop offset=".18" stop-color="#303b40"/><stop offset=".65" stop-color="#172126"/><stop offset="1" stop-color="#0c1217"/></linearGradient>
    <linearGradient id="brass" x2="0" y2="1"><stop stop-color="#f0cd8a"/><stop offset=".22" stop-color="#b88b50"/><stop offset=".65" stop-color="#69472b"/><stop offset="1" stop-color="#d8ae69"/></linearGradient>
    <linearGradient id="ivory" x2="0" y2="1"><stop stop-color="#fff9e9"/><stop offset=".5" stop-color="#efe5cf"/><stop offset="1" stop-color="#b9aa8d"/></linearGradient>
    </defs>'''
    source=SRC/(name+'.svg'); target=ROOT/folder/(name+'.png');target.parent.mkdir(exist_ok=True)
    source.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{defs}{body}</svg>')
    subprocess.run(['inkscape',str(source),'--export-type=png','--export-filename='+str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    im=Image.open(target).convert('RGBA')
    assets.append(dict(file=str(target.relative_to(ROOT)),source=source.name,size=list(im.size),alpha_extrema=list(im.getchannel('A').getextrema()),sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
def bolt(x,y,r=8):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="#141d21" stroke="#798083" stroke-width="2"/><path d="M{x-r/2} {y}h{r}" stroke="#b1b2a7" stroke-width="2"/>'
def text(label,x,y,size,fill='url(#ivory)',stroke='#131c21',width=5):
    return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="{size}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" paint-order="stroke fill" stroke-linejoin="round">{label}</text>'
plate='<path d="M92 56H420L456 92V420L420 456H92L56 420V92Z" fill="url(#metal)" stroke="#10171c" stroke-width="9"/><path d="M97 67H415L445 97V415L415 445H97L67 415V97Z" fill="none" stroke="#6b7677" stroke-width="3"/><path d="M103 79H409M79 104V408" stroke="#a3aaa5" stroke-opacity=".35" stroke-width="3"/>'
for name,label in [('a','A'),('k','K'),('q','Q'),('j','J'),('ten','10')]:
    body=plate
    body+='<path d="M100 75H410" stroke="#a5b0b2" stroke-opacity=".15" stroke-width="4"/>'
    size=300 if name!='ten' else 250
    body+=text(label,256,365 if name=='q' else 362,size,'#0a1015','#0a1015',12)
    body+=text(label,256,352 if name=='q' else 349,size)
    svg(name,'symbols',512,512,body)
# The FS plate and letters share registration; lettering has no baked glow or panel.
body=plate+'<path d="M96 60H416L452 96V416L416 452H96L60 416V96Z" fill="none" stroke="url(#brass)" stroke-width="14"/>'
body+=''.join(bolt(x,y,8) for x,y in [(90,90),(422,90),(90,422),(422,422)])
body+='<path d="M170 93H342M170 419H342" stroke="#eda83c" stroke-width="7"/>'
svg('scatter-plate','symbols',512,512,body)
svg('scatter-letters','symbols',512,512,text('FS',256,350,265,'#0a1015','#0a1015',16)+text('FS',256,338,265,'url(#ivory)','#453521',3))
# Cabinet is precise geometry: no pixel of its paint may enter the 1200x800 window.
body='<defs><mask id="window"><rect width="1440" height="1060" fill="white"/><rect x="120" y="130" width="1200" height="800" fill="black"/></mask></defs><g mask="url(#window)">'
body+='<path d="M48 12H1392L1428 48V1012L1392 1048H48L12 1012V48Z" fill="url(#metal)" stroke="#080f14" stroke-width="12"/>'
body+='<path d="M52 29H1388L1411 52V1008L1388 1031H52L29 1008V52Z" fill="none" stroke="#647074" stroke-width="4"/>'
body+='<rect x="93" y="103" width="1254" height="854" rx="12" fill="#090f13" stroke="url(#brass)" stroke-width="18"/><rect x="114" y="124" width="1212" height="812" fill="#070b0e" stroke="#cba86a" stroke-width="8"/>'
for x in (48,1380):
    body+=f'<rect x="{x-9}" y="198" width="26" height="630" rx="10" fill="#091116" stroke="#4b5557" stroke-width="3"/>'
    for y in (220,402,584):
        body+=f'<rect x="{x-2}" y="{y}" width="12" height="140" rx="5" fill="#dca04d"/><rect x="{x+1}" y="{y+5}" width="4" height="130" rx="2" fill="#ffe0a3"/>'
for x in (65,1375):
    for y in (65,995): body+=bolt(x,y,13)
# Broad sculpted corner caps sit entirely outside the aperture.
for x,flip in [(14,False),(1426,True)]:
    tr=f'translate({x},18) scale({-1 if flip else 1},1)'
    body+=f'<g transform="{tr}"><path d="M0 30L30 0H140L113 80H75L61 150H0Z" fill="#25353c" stroke="#0b1218" stroke-width="6"/><path d="M14 35L35 14H120L102 63H62L47 133H14Z" fill="none" stroke="#64737a" stroke-width="3"/>{bolt(44,44,12)}</g>'
# Top band ventilation machining; low contrast blank bottom control shelf.
for x in list(range(180,490,24))+list(range(960,1270,24)):
    body+=f'<path d="M{x} 55v30" stroke="#10191e" stroke-width="10"/><path d="M{x+6} 55v30" stroke="#566164" stroke-width="2"/>'
body+='<path d="M160 980H1280M180 1010H1260" stroke="#536065" stroke-opacity=".45" stroke-width="2"/><path d="M620 65H820" stroke="#ad7840" stroke-width="4"/></g>'
svg('cabinet','cabinet',1440,1060,body)
body='<circle cx="200" cy="200" r="190" fill="url(#metal)" stroke="#080f14" stroke-width="8"/><circle cx="200" cy="200" r="174" fill="#101b20" stroke="url(#brass)" stroke-width="10"/><circle cx="200" cy="200" r="154" fill="#ece2c9" stroke="#070f14" stroke-width="4"/>'
# 270 degree scale from bottom-left clockwise across top to bottom-right.
for i in range(51):
    a=math.radians(135+i*5.4); r1=129 if i%5==0 else 139;r2=148
    x,y=200+math.cos(a)*r1,200+math.sin(a)*r1
    xx,yy=200+math.cos(a)*r2,200+math.sin(a)*r2
    body+=f'<path d="M{x} {y}L{xx} {yy}" stroke="{"#b04e36" if i>=35 else "#263238"}" stroke-width="{4 if i%5==0 else 2}"/>'
    if i%5==0:
        body+=text(str(i//5),200+math.cos(a)*108,208+math.sin(a)*108,24,'#263238','none',0)
body+=text('PRESSURE',200,270,16,'#475455','none',0)
body+=''.join(bolt(x,y,6) for x,y in [(78,78),(322,78),(78,322),(322,322)])
svg('gauge-face','cabinet',400,400,body)
svg('gauge-needle','cabinet',400,400,'<path d="M200 58L209 196L205 231H195L191 196Z" fill="#b34b32" stroke="#602d24" stroke-width="2"/><circle cx="200" cy="200" r="16" fill="url(#brass)" stroke="#222c31" stroke-width="4"/><circle cx="200" cy="200" r="5" fill="#e7cc95"/>')
# Quantitative art QA: exact aperture and alpha, then a review contact sheet.
c=Image.open(ROOT/'cabinet/cabinet.png').convert('RGBA')
assert c.crop((120,130,1320,930)).getchannel('A').getextrema()==(0,0)
for a in assets:
    assert a['alpha_extrema']==[0,255],a
(ROOT/'production-batch-03-manifest.json').write_text(json.dumps({'method':'Original SVG geometry and typography; Inkscape rasterization','assets':assets,'checks':{'cabinet_window_fully_transparent':True,'all_rgba_transparency':True}},indent=2)+'\n')
sheet=Image.new('RGB',(1000,760),'#19242c');draw=ImageDraw.Draw(sheet)
for i,a in enumerate(assets[:7]):
    im=Image.open(ROOT/a['file']).convert('RGBA');im.thumbnail((120,120));x=20+i*140
    if i==6:
        plate=Image.open(ROOT/'symbols/scatter-plate.png').convert('RGBA');plate.thumbnail((120,120));sheet.paste(plate,(x,40),plate)
    sheet.paste(im,(x,40),im);draw.text((x,175),Path(a['file']).stem,fill='white')
im=c.copy();im.thumbnail((700,515));sheet.paste(im,(10,225),im)
for i,name in enumerate(['gauge-face','gauge-needle']):
    im=Image.open(ROOT/f'cabinet/{name}.png').convert('RGBA');im.thumbnail((200,200));sheet.paste(im,(770,250+i*220),im)
sheet.save(ROOT/'batch-03-review.jpg',quality=92)
print(f'{len(assets)} assets rendered; exact reel aperture and transparency checks passed.')
