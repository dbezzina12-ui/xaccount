"""Build the single-piece cabinet cap and matching wordmark from licensed font outlines."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

assets=Path(__file__).resolve().parents[1]/'dist/assets'
font=TTFont(assets/'fonts/barlow-semi-condensed-800.woff')
glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); cursor=0; letters=[]
for char in 'COSMIC CLASH':
    glyph=glyphs[cmap[ord(char)]]; pen=SVGPathPen(glyphs); glyph.draw(pen)
    if char!=' ': letters.append((cursor,pen.getCommands(),cursor>3000))
    cursor+=glyph.width+17
cap=BoundsPen(glyphs); glyphs[cmap[ord('H')]].draw(cap); height=cap.bounds[3]
# The word is part of the same SVG as the structural cap, not a separate badge.
paths=''.join(f'<path transform="translate({x} 0)" d="{d}"/>' for x,d,_ in letters)
word=f'<g transform="translate(144 83) skewX(-9) scale({748/cursor} {-63/height})">{paths}</g>'
defs='''<defs>
 <linearGradient id="metal" x2="0" y2="1"><stop stop-color="#71858e"/><stop offset=".12" stop-color="#344751"/><stop offset=".55" stop-color="#1b2b35"/><stop offset="1" stop-color="#101b24"/></linearGradient>
 <linearGradient id="letters" x2="0" y2="1"><stop stop-color="#f3fbfd"/><stop offset=".44" stop-color="#cbdde3"/><stop offset=".46" stop-color="#91b0c0"/><stop offset="1" stop-color="#e6f1f5"/></linearGradient>
 <linearGradient id="edge"><stop stop-color="#577984"/><stop offset=".5" stop-color="#bacbd0"/><stop offset="1" stop-color="#577984"/></linearGradient>
</defs>'''
# Font paths use upward coordinates; keep the fill in that coordinate system.
defs=defs.replace('id="letters" x2="0" y2="1"', f'id="letters" gradientUnits="userSpaceOnUse" x1="0" y1="{height}" x2="0" y2="0"')
outline=f'<g fill="url(#letters)" stroke="#071018" stroke-width="42" stroke-linejoin="round" paint-order="stroke">{word}</g>'
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 112" role="img" aria-label="Cosmic Clash">
{defs}
<path d="M0 112V61L23 35H132L157 8H861L888 35H977L1000 61V112H980V89H20V112Z" fill="#060d13"/>
<path d="M5 112V63L27 41H137L162 14H856L883 41H973L995 63V112H981V85H19V112Z" fill="url(#metal)" stroke="#81959e" stroke-width="2"/>
<path d="M19 75L35 54H145L170 24H848L877 54H965L981 75" fill="none" stroke="#b1c4cc" stroke-opacity=".42" stroke-width="2"/>
<path d="M26 83H974V91H26Z" fill="#0b1620"/>
<path d="M26 95H974" stroke="url(#edge)" stroke-width="3"/>
<path d="M23 104H977" stroke="#050b10" stroke-width="8"/>
{outline}
<path d="M40 67H111M890 67H960" stroke="#8be0ed" stroke-width="4"/>
<path d="M45 74H98M903 74H954" stroke="#244d5b" stroke-width="3"/>
<path d="M487 100H513L505 108H495Z" fill="#86d4e2"/>
<g fill="#0a151e" stroke="#718893" stroke-width="1.5"><path d="M26 91h8v8h-8zM966 91h8v8h-8z"/></g>
</svg>'''
(assets/'cosmic-clash-cabinet-top.svg').write_text(svg)
(assets/'cosmic-clash-wordmark.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 8 795 92" role="img" aria-label="Cosmic Clash">{defs}{outline}</svg>')
(assets/'cosmic-clash-cabinet-frame.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
<defs><linearGradient id="rail"><stop stop-color="#627681"/><stop offset=".2" stop-color="#233641"/><stop offset=".7" stop-color="#15232e"/><stop offset="1" stop-color="#7c8f98"/></linearGradient></defs>
<path d="M2 0H238V220L220 238H20L2 220Z" fill="#061018" stroke="#060c10" stroke-width="4"/>
<path d="M5 0H235V218L218 235H22L5 218Z M18 0V214L27 222H213L222 214V0Z" fill="url(#rail)" fill-rule="evenodd" stroke="#6e818a" stroke-width="1.5"/>
<path d="M21 0V211L30 219H210L219 211V0" fill="none" stroke="#050d13" stroke-width="7"/>
<path d="M9 47V77M231 47V77" stroke="#85d2e0" stroke-width="2"/>
<path d="M9 82V94M231 82V94" stroke="#356272" stroke-width="2"/>
<path d="M7 197H15V216L25 227H47V231H21L7 218ZM233 197H225V216L215 227H193V231H219L233 218Z" fill="#71838b"/>
<path d="M56 228H93L99 233H141L147 228H184" fill="none" stroke="#8aa5b1" stroke-width="1.5"/>
<path d="M104 230H136" stroke="#67b9c9" stroke-width="2"/>
</svg>''')
