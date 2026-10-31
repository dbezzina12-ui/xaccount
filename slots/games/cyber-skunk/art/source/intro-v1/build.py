"""Build Cyber Skunk's two exact 900x600 intro diagrams from shipping art.

This is deterministic presentation art. It does not encode prices, odds or
outcomes. Mode labels and explanatory copy remain live in the runtime.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = Path(__file__).resolve().parent
ART = SRC.parents[1]
SYMBOLS = ART / "symbols"
OUT = ART / "ui"
OUT.mkdir(exist_ok=True)
W, H = 900, 600

COLORS = {
    "midnight": "#101820", "graphite": "#252D31", "deep": "#0A1014",
    "ivory": "#EFE5CF", "brass": "#AD7840", "amber": "#EDA83C",
    "cyan": "#68C8C3", "steel": "#78878A",
}
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def load(name):
    return Image.open(SYMBOLS / name).convert("RGBA")


def contain(im, box):
    copy = im.copy()
    copy.thumbnail(box, Image.Resampling.LANCZOS)
    return copy


def rounded_panel(draw, box, fill, outline, width=5, radius=28):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def center_paste(canvas, im, box):
    x0, y0, x1, y1 = box
    fitted = contain(im, (x1 - x0, y1 - y0))
    canvas.alpha_composite(fitted, (x0 + (x1 - x0 - fitted.width)//2,
                                    y0 + (y1 - y0 - fitted.height)//2))


def route_card():
    im = Image.new("RGBA", (W, H), COLORS["midnight"])
    d = ImageDraw.Draw(im)
    # Quiet industrial card backing and 4x3 board.
    rounded_panel(d, (18, 18, W-18, H-18), "#0B1217", COLORS["brass"], 6, 34)
    margin_x, margin_y, gap = 58, 50, 12
    cw = (W - 2*margin_x - 3*gap) // 4
    ch = (H - 2*margin_y - 2*gap) // 3
    cells = {}
    for r in range(3):
        for c in range(4):
            x = margin_x + c*(cw+gap); y = margin_y + r*(ch+gap)
            cells[(r,c)] = (x,y,x+cw,y+ch)
            fill = "#142129" if (r,c) in {(1,0),(1,1),(1,2),(0,2)} else "#11191E"
            edge = COLORS["cyan"] if (r,c) in {(1,0),(1,1),(1,2),(0,2)} else "#344249"
            rounded_panel(d, (x,y,x+cw,y+ch), fill, edge, 5 if edge==COLORS["cyan"] else 3, 18)

    # Actual WILD faces make the transformed cells clear; vents use the real reverse art.
    wild = load("wild.png"); vent = load("vent.png")
    for rc in ((1,1),(0,2)):
        box = cells[rc]; center_paste(im, wild, (box[0]+22,box[1]+20,box[2]-22,box[3]-20))
    # The first outlet points right (continue); the second points up (turn).
    for rc, angle in [((1,0),-90),((1,2),0)]:
        box = cells[rc]
        v = contain(vent.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC), (cw-50,ch-46))
        im.alpha_composite(v,(box[0]+(cw-v.width)//2,box[1]+(ch-v.height)//2))

    # Pressure tags are outcome labels, visually tied to the two reverse faces.
    tag_font = ImageFont.truetype(FONT, 38)
    for rc, label in [((1,0),"×2"),((1,2),"×3")]:
        x0,y0,x1,y1=cells[rc]; tw=d.textbbox((0,0),label,font=tag_font)[2]
        d.rounded_rectangle((x1-tw-30,y1-55,x1-10,y1-10),12,fill="#0A1117",outline=COLORS["amber"],width=3)
        d.text((x1-tw-20,y1-52),label,font=tag_font,fill=COLORS["amber"],stroke_width=2,stroke_fill="#1B120A")

    # One clear authoritative route, entering left, turning up through the second vent.
    p=[(24,margin_y+ch+gap+ch//2),(cells[(1,0)][0]+cw//2,margin_y+ch+gap+ch//2),
       (cells[(1,2)][0]+cw//2,margin_y+ch+gap+ch//2),(cells[(0,2)][0]+cw//2,24)]
    glow=Image.new("RGBA",(W,H));gd=ImageDraw.Draw(glow)
    gd.line(p,fill="#68C8C360",width=26,joint="curve");glow=glow.filter(ImageFilter.GaussianBlur(11));im.alpha_composite(glow)
    d=ImageDraw.Draw(im);d.line(p,fill="#BDF9F0",width=11,joint="curve")
    # Arrow head at exit.
    x,y=p[-1];d.polygon([(x,y-2),(x-18,y+24),(x+18,y+24)],fill="#BDF9F0")
    return im.convert("RGB")


def fs_icon(size=74):
    icon=Image.new("RGBA",(size,size));d=ImageDraw.Draw(icon)
    d.rounded_rectangle((2,2,size-2,size-2),15,fill="#0D161B",outline=COLORS["brass"],width=4)
    letters=contain(load("scatter-letters.png"),(size-10,size-10))
    icon.alpha_composite(letters,((size-letters.width)//2,(size-letters.height)//2))
    return icon


def tier_card():
    im=Image.new("RGBA",(W,H),COLORS["midnight"]);d=ImageDraw.Draw(im)
    rounded_panel(d,(18,18,W-18,H-18),"#0B1217",COLORS["brass"],6,34)
    plate_w, gap, x0 = 244, 32, 52
    treatments=[("#1C272D",COLORS["steel"],3),("#2A2118",COLORS["amber"],4),("#061716",COLORS["cyan"],5)]
    icon=fs_icon()
    for i,(fill,edge,count) in enumerate(treatments):
        x=x0+i*(plate_w+gap)
        # Blank plate deliberately carries no title; runtime supplies the label.
        rounded_panel(d,(x,55,x+plate_w,350),fill,edge,6,25)
        d.line((x+36,100,x+plate_w-36,100),fill=edge,width=7)
        d.line((x+36,300,x+plate_w-36,300),fill=edge,width=7)
        # Mechanical tier signature: one/two/three pressure rails, increasingly active.
        for rail in range(i+1):
            ry=156+rail*46
            d.rounded_rectangle((x+42,ry,x+plate_w-42,ry+19),9,fill=edge)
            d.rounded_rectangle((x+64,ry+5,x+plate_w-64,ry+14),4,fill="#E9FFF8" if i==2 else COLORS["ivory"])
        # Exact scatter count as real FS tiles, arranged 2+2+1 at most.
        positions=[]
        if count==3: positions=[(0,0),(1,0),(.5,1)]
        elif count==4: positions=[(0,0),(1,0),(0,1),(1,1)]
        else: positions=[(0,0),(1,0),(0,1),(1,1),(.5,2)]
        rows=max(int(py) for _,py in positions)+1
        step_x,step_y=82,66
        for px,py in positions:
            cx=x+plate_w//2+int((px-.5)*step_x)
            cy=410+int(py*step_y)-(rows-2)*24
            small=contain(icon,(64,64));im.alpha_composite(small,(cx-small.width//2,cy-small.height//2))
    return im.convert("RGB")


assets=[]
for name,art in [("intro-route",route_card()),("intro-bonuses",tier_card())]:
    dest=OUT/(name+".png");art.save(dest,optimize=True)
    chk=Image.open(dest);chk.load();assert chk.size==(W,H) and chk.mode=="RGB"
    assets.append({"file":str(dest.relative_to(ART)),"size":[W,H],"mode":chk.mode,
                   "sha256":hashlib.sha256(dest.read_bytes()).hexdigest()})

review=Image.new("RGB",(950,700),"#131D24")
for i,a in enumerate(assets):
    art=Image.open(ART/a["file"]);large=art.resize((450,300),Image.Resampling.LANCZOS)
    review.paste(large,(10+i*480,20))
    phone=art.resize((270,180),Image.Resampling.LANCZOS);review.paste(phone,(100+i*480,380))
review.save(SRC/"review.jpg",quality=90)
(SRC/"manifest.json").write_text(json.dumps({
  "method":"Deterministic Pillow composition from Cyber Skunk production art",
  "assets":assets,
  "invariants":["No skunk art on symbols","No prices or odds baked in","3/4/5 FS counts exact",
                "Route enters left, passes ×2 and ×3 vents, exits upward","900x600 opaque RGB"]
},indent=2)+"\n")
print(json.dumps(assets,indent=2))
