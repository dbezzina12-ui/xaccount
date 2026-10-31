"""Original industrial wordmarks. Outlined DejaVu Sans Bold, rendered by Inkscape.
Run from any directory; no runtime or math files are written.
"""
from pathlib import Path
import hashlib, json, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image, ImageDraw

SRC = Path(__file__).resolve().parent
ART = SRC.parents[1]
OUT = ART / 'wins'
OUT.mkdir(exist_ok=True)
FONT = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
font = TTFont(FONT)
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
rows = [
 ('win-nice','NICE WIN',1600,560,0,'#fff7dc','#c1a477','#ad7840'),
 ('win-big','BIG WIN',1600,560,1,'#fff0a8','#db8a26','#edaa42'),
 ('win-epic','EPIC WIN',1600,560,2,'#fff3b5','#e69330','#68c8c3'),
 ('win-mythic','MYTHIC WIN',1600,560,3,'#f1fff9','#82d9d4','#b5f6ec'),
 ('win-max','MAX WIN',1600,560,4,'#fff3d6','#ffb046','#e96748'),
 ('banner-extra-spins','EXTRA SPINS',1200,360,0,'#e9fff6','#88d3c9','#68c8c3'),
 ('title-total-win','TOTAL WIN',1200,360,0,'#fff7dc','#c1a477','#ad7840'),
]
manifest = []
for name,label,w,h,tier,top,bottom,accent in rows:
    # Outline text for identical geometry on every machine; no font dependency in SVG.
    pen = SVGPathPen(glyphs)
    advance = 0
    for char in label:
        key = cmap[ord(char)]
        glyphs[key].draw(TransformPen(pen,(1,0,0,1,advance,0)))
        advance += font['hmtx'][key][0]
    d = pen.getCommands()
    cap = font['glyf'][cmap[ord('H')]].yMax
    sy = (h*(.30 + tier*.015))/cap
    sx = min(sy, (w*(.70+tier*.02))/advance)
    tw = advance*sx
    x = (w-tw)/2
    baseline = h*.56
    textpath = f'<path d="{d}" transform="translate({x:.3f} {baseline:.3f}) scale({sx:.6f} {-sy:.6f})"/>'
    # Defining paths once keeps shadows, rims and face precisely registered.
    defs = f'<g id="letters">{textpath}</g><linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop stop-color="{top}"/><stop offset=".48" stop-color="{top}"/><stop offset=".5" stop-color="{bottom}"/><stop offset="1" stop-color="{bottom}"/></linearGradient><linearGradient id="plate" x2="0" y2="1"><stop stop-color="#344249"/><stop offset="1" stop-color="#121c23"/></linearGradient>'
    l,r = max(36,x-60), min(w-36,x+tw+60)
    y1,y2 = baseline-cap*sy-40, baseline+60
    cut = 28
    body = f'<path d="M{l+cut} {y1}H{r-cut}L{r} {y1+cut}V{y2-cut}L{r-cut} {y2}H{l+cut}L{l} {y2-cut}V{y1+cut}Z" fill="url(#plate)" stroke="#091015" stroke-width="16"/><path d="M{l+cut} {y1}H{r-cut}L{r} {y1+cut}V{y2-cut}L{r-cut} {y2}H{l+cut}L{l} {y2-cut}V{y1+cut}Z" fill="none" stroke="{accent}" stroke-width="4"/>'
    # Solid dimensional offset, bevel and face, no blurry text or baked amounts.
    for dy in range(16,0,-2):
        body += f'<use href="#letters" transform="translate(0 {dy})" fill="#080f14"/>'
    body += f'<use href="#letters" transform="translate(0 -2)" fill="{top}"/><use href="#letters" fill="url(#face)"/>'
    # Pressure rail escalates from quiet single bar to five substantial segments.
    n = tier+1
    for i in range(n):
        bx = w/2 - n*37 + i*74 + 5
        body += f'<path d="M{bx} {y2+18}h58l-8 12h-58Z" fill="{accent}"/>'
    for bx in (l+18,r-18):
        body += f'<circle cx="{bx}" cy="{(y1+y2)/2}" r="6" fill="#0b151b" stroke="#84908b" stroke-width="2"/>'
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{label}</title><defs>{defs}</defs>{body}</svg>'
    # Inkscape supports xlink consistently across versions.
    svg = svg.replace('href=', 'xlink:href=')
    source,dest = SRC/(name+'.svg'), OUT/(name+'.png')
    source.write_text(svg)
    subprocess.run(['inkscape',str(source),'--export-filename='+str(dest)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    im = Image.open(dest).convert('RGBA'); a=im.getchannel('A')
    assert im.size==(w,h) and a.getextrema()==(0,255)
    bbox=a.getbbox(); assert bbox[0]>16 and bbox[1]>16 and bbox[2]<w-16 and bbox[3]<h-16
    manifest.append(dict(file=str(dest.relative_to(ART)),label=label,size=[w,h],alpha_bbox=bbox,sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))

(SRC/'manifest.json').write_text(json.dumps({'font_sha256':hashlib.sha256(FONT.read_bytes()).hexdigest(),'assets':manifest,'checks':'RGBA, exact ART_SPEC dimensions, transparent 16px edge margin; all text outlined.'},indent=2)+'\n')
sheet=Image.new('RGB',(800,7*170),'#101820')
draw=ImageDraw.Draw(sheet)
for i,item in enumerate(manifest):
    im=Image.open(ART/item['file']).convert('RGBA'); im.thumbnail((440,154))
    sheet.paste(im,(0,i*170),im)
    phone=Image.open(ART/item['file']).convert('RGBA'); phone.thumbnail((300,130))
    sheet.paste(phone,(475,i*170+8),phone)
    draw.text((12,i*170+150),item['label'],fill='#aaa99c')
sheet.save(SRC/'review.jpg',quality=92)
print(json.dumps(manifest,indent=2))
