"""Deterministic native vector VFX sprites; Python/Pillow + Inkscape.
No runtime changes. Sources are in this directory; exports follow ART_SPEC §7.
"""
from pathlib import Path
import subprocess, json, hashlib, math
from PIL import Image, ImageDraw
SRC=Path(__file__).resolve().parent
ART=SRC.parents[1]
OUT=ART/'fx';OUT.mkdir(exist_ok=True)
assets=[]
def save(name,w,h,body,defs=''):
    src=SRC/(name+'.svg'); dest=(ART/'symbols' if name=='wild' else OUT)/(name+'.png')
    src.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs>{defs}</defs>{body}</svg>')
    subprocess.run(['inkscape',str(src),'--export-type=png','--export-filename='+str(dest)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    im=Image.open(dest).convert('RGBA');assert im.size==(w,h)
    assert im.getchannel('A').getextrema()[0]==0
    # Every edge stays transparent: particles never reveal a square during scaling.
    a=im.getchannel('A')
    assert all(a.crop(box).getextrema()==(0,0) for box in [(0,0,w,1),(0,h-1,w,h),(0,0,1,h),(w-1,0,w,h)])
    assets.append(dict(file=str(dest.relative_to(ART)),dimensions=[w,h],sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),alpha=list(a.getextrema())))
# This soft halo is underneath WILD: no opaque plate or high-contrast central strokes.
defs='<radialGradient id="halo"><stop stop-color="#d7f9ed" stop-opacity=".10"/><stop offset=".62" stop-color="#83d9d0" stop-opacity=".16"/><stop offset=".8" stop-color="#68c8c3" stop-opacity=".50"/><stop offset="1" stop-color="#68c8c3" stop-opacity="0"/></radialGradient>'
body='<circle cx="256" cy="256" r="225" fill="url(#halo)"/>'
for i,(r,alpha) in enumerate([(192,.48),(211,.33)]):
    for j in range(9):
        a=2*math.pi*j/9+i*.2
        x,y=256+math.cos(a)*r,256+math.sin(a)*r
        body+=f'<ellipse cx="{x:.2f}" cy="{y:.2f}" rx="{8+i*2}" ry="{13+i*2}" transform="rotate({j*40+90} {x:.2f} {y:.2f})" fill="#a2e9dd" opacity="{alpha}"/>'
save('fx-splat',512,512,body,defs)
# Wide quiet brass tag. The number is always live text from shipping outcome state.
defs='<linearGradient id="brass" x2="0" y2="1"><stop stop-color="#edd29b"/><stop offset=".5" stop-color="#cca566"/><stop offset="1" stop-color="#ac7b43"/></linearGradient>'
body='<path d="M32 19H222L240 37V123L222 141H32L16 123V37Z" fill="#152229" stroke="#0d171d" stroke-width="6"/><path d="M35 27H218L231 40V120L218 133H35L25 120V40Z" fill="url(#brass)" stroke="#efdcaa" stroke-width="2"/>'
for x in (35,220):
    body+=f'<circle cx="{x}" cy="80" r="5" fill="#775330"/><path d="M{x-2} 78l4 4" stroke="#e4c284" stroke-width="1.5"/>'
body+='<path d="M112 36H144M117 40H139" stroke="#715a39" stroke-width="2" opacity=".6"/>'
save('badge-pressure',256,160,body,defs)
# Hollow ring; center is mathematically empty, not an opaque cyan disc.
defs='<radialGradient id="ring"><stop offset=".71" stop-color="#68c8c3" stop-opacity="0"/><stop offset=".79" stop-color="#68c8c3" stop-opacity=".15"/><stop offset=".86" stop-color="#bcefe4" stop-opacity=".8"/><stop offset=".89" stop-color="#68c8c3" stop-opacity=".35"/><stop offset="1" stop-color="#68c8c3" stop-opacity="0"/></radialGradient>'
save('vent-online',512,512,'<circle cx="256" cy="256" r="244" fill="url(#ring)"/>',defs)
defs='<radialGradient id="mist"><stop stop-color="#d3f3ec" stop-opacity=".32"/><stop offset=".4" stop-color="#8fdad2" stop-opacity=".19"/><stop offset="1" stop-color="#68c8c3" stop-opacity="0"/></radialGradient>'
save('fx-mist',256,256,'<ellipse cx="128" cy="128" rx="112" ry="100" fill="url(#mist)"/>',defs)
defs='<linearGradient id="drop" x2=".5" y2="1"><stop stop-color="#ecfff6"/><stop offset=".45" stop-color="#a4e6dd"/><stop offset="1" stop-color="#469fa4"/></linearGradient>'
save('fx-droplet',64,64,'<path d="M32 7C29 17 16 29 16 40C16 61 48 61 48 40C48 29 35 17 32 7Z" fill="url(#drop)"/><path d="M27 28Q21 38 24 44" fill="none" stroke="#ecfff6" stroke-width="3" stroke-linecap="round" opacity=".8"/>',defs)
defs='<radialGradient id="spark"><stop stop-color="#fff6d5"/><stop offset=".3" stop-color="#f5d492"/><stop offset="1" stop-color="#ad7840" stop-opacity=".15"/></radialGradient>'
save('fx-spark',128,128,'<path d="M64 7Q69 53 121 64Q74 69 64 121Q56 75 7 64Q55 56 64 7Z" fill="url(#spark)"/>',defs)
defs='<radialGradient id="steam"><stop stop-color="#f2f7ef" stop-opacity=".42"/><stop offset=".4" stop-color="#dbe7df" stop-opacity=".27"/><stop offset="1" stop-color="#c9d9d4" stop-opacity="0"/></radialGradient>'
body=''
for cx,cy,rx,ry,opacity in [(245,330,90,145,.7),(177,255,90,110,.8),(310,225,95,135,.8),(218,130,110,105,.85),(340,120,85,80,.6)]:
    body+=f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#steam)" opacity="{opacity}"/>'
save('fx-steam',512,512,body,defs)
# Character-free WILD: same crisp typography/graphite vocabulary as the new royals.
defs='<linearGradient id="body" x2="0" y2="1"><stop stop-color="#566269"/><stop offset=".45" stop-color="#27383d"/><stop offset="1" stop-color="#101a20"/></linearGradient><linearGradient id="rim" x2="0" y2="1"><stop stop-color="#e7c789"/><stop offset=".5" stop-color="#8f673c"/><stop offset="1" stop-color="#c89b58"/></linearGradient><linearGradient id="letters" x2="0" y2="1"><stop stop-color="#fff9e9"/><stop offset="1" stop-color="#c4b798"/></linearGradient>'
body='<path d="M104 36H408L476 104V408L408 476H104L36 408V104Z" fill="#101a20" stroke="#080e12" stroke-width="8"/><path d="M110 50H402L462 110V402L402 462H110L50 402V110Z" fill="url(#body)" stroke="url(#rim)" stroke-width="13"/><path d="M120 75H392L437 120V392L392 437H120L75 392V120Z" fill="none" stroke="#738080" stroke-width="2"/>'
for y in (130,382):
    body+=f'<rect x="156" y="{y-10}" width="200" height="20" rx="6" fill="#101b20"/><rect x="166" y="{y-4}" width="180" height="8" rx="3" fill="#68c8c3"/>'
for x in (101,411):
    for y in (153,359):
        body+=f'<circle cx="{x}" cy="{y}" r="8" fill="#101a20" stroke="#a9a68e" stroke-width="2"/><path d="M{x-3} {y}h6" stroke="#d2c8ac" stroke-width="2"/>'
body+='<text x="256" y="306" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="126" fill="#080e12" stroke="#080e12" stroke-width="12" stroke-linejoin="round">WILD</text><text x="256" y="294" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="126" fill="url(#letters)">WILD</text>'
save('wild',512,512,body,defs)

# Integration-relevant invariants in addition to sizing/alpha.
a=Image.open(OUT/'vent-online.png').getchannel('A');assert a.crop((150,150,362,362)).getextrema()==(0,0)
a=Image.open(OUT/'fx-splat.png').getchannel('A');assert a.crop((150,150,362,362)).getextrema()[1]<70
report={'assets':assets,'checks':{'transparent_edges':True,'ring_center_clear_212px':True,'splat_center_alpha_under_70':True},'method':'Original SVG VFX; Inkscape PNG exports. No model images or runtime edits.'}
(ART/'effects-v1-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
# Private repository contact sheet only. Show realistic WILD overlay and tag text sizes.
sheet=Image.new('RGB',(960,420),'#17232b');d=ImageDraw.Draw(sheet)
for i,item in enumerate(assets[:7]):
    im=Image.open(ART/item['file']).convert('RGBA');im.thumbnail((112,112));x=15+i*134
    sheet.paste(im,(x,45),im);d.text((x,175),Path(item['file']).stem,fill='#efe5cf')
wild=Image.open(ART/'symbols/wild.png').convert('RGBA').resize((96,96))
for i,name in enumerate(['fx-splat','vent-online']):
    im=Image.open(OUT/(name+'.png')).convert('RGBA').resize((120,120));x=30+i*180
    sheet.paste(im,(x,240),im);sheet.paste(wild,(x+12,252),wild)
d.text((410,255),'Live pressure text stays outside the artwork.',fill='#efe5cf')
d.text((410,285),'Ring center: alpha 0. Splat center: alpha < 70.',fill='#8fdad2')
sheet.save(SRC/'review.jpg',quality=92)
print('Character-free WILD + 7 VFX sprites validated: dimensions, alpha, clear centers, transparent edges.')
