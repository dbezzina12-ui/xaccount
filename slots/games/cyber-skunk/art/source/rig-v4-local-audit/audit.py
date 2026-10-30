"""Read-only source QA for the v4 compact rig. Does not fit, repaint or activate art.
Usage: python3 audit.py --source /path/to/mascot-compact-v4
Outputs reproducible JSON + Markdown alongside this script.
"""
import argparse, json, math, hashlib
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);args=p.parse_args()
HERE=Path(__file__).resolve().parent;ART=HERE.parents[1]
contract_path=ART/'rig/pivots-v4.json';contract=json.loads(contract_path.read_text())
proposal=json.loads((args.source/'assembly-proposal.json').read_text())
source={x['name']:x for x in proposal['parts']};images={};decode=[]
for name,part in source.items():
    path=args.source/part['file'];im=Image.open(path);im.load()
    actual=hashlib.sha256(path.read_bytes()).hexdigest()
    decode.append({'part':name,'size':list(im.size),'mode':im.mode,'sha256':actual,'matches_staged_hash':actual==part['sha256']})
    assert im.size==tuple(contract['canvas']) and im.mode=='RGBA'
    assert actual==part['sha256'],name
    images[name]=im.getchannel('A')
def alpha_at(name,pivot):
    if name not in images:return None
    return images[name].getpixel(tuple(pivot))
def disk_coverage(name,pivot):
    if name not in images:return None
    r=contract['overlap'];cx,cy=pivot;hit=total=0
    for y in range(cy-r,cy+r+1):
        for x in range(cx-r,cx+r+1):
            if (x-cx)**2+(y-cy)**2<=r*r:
                total+=1
                if 0<=x<1600 and 0<=y<2000 and images[name].getpixel((x,y))>=128:hit+=1
    return round(hit/total,4)
rows=[]
for name,part in sorted(contract['parts'].items(),key=lambda x:x[1]['order']):
    own=source.get(name);point=part['pivot'];parent=part['parent']
    shift=None if own is None else [point[i]-own['pivot'][i] for i in (0,1)]
    rows.append({'part':name,'status':'missing' if own is None else 'present','v4_pivot':point,'provisional_pivot':None if own is None else own['pivot'],'translation_to_v4':shift,'pivot_displacement_px':None if shift is None else round(math.hypot(*shift),1),'v4_pivot_alpha':alpha_at(name,point),'v4_disk_coverage':disk_coverage(name,point),'parent':parent,'parent_at_v4_joint_alpha':alpha_at(parent,point),'parent_v4_disk_coverage':disk_coverage(parent,point),'provisional_pivot_alpha':None if own is None else alpha_at(name,own['pivot']),'provisional_disk_coverage':None if own is None else disk_coverage(name,own['pivot'])})
missing=[n for n in contract['parts'] if n not in source];extra=[n for n in source if n not in contract['parts']]
report={'contract_version':contract['version'],'contract_sha256':hashlib.sha256(contract_path.read_bytes()).hexdigest(),'source_manifest_sha256':hashlib.sha256((args.source/'assembly-proposal.json').read_bytes()).hexdigest(),'canvas':contract['canvas'],'overlap_radius':contract['overlap'],'missing':missing,'extra':extra,'decoded_inputs':decode,'parts':rows,'interpretation':'55px disk coverage is a conservative geometric diagnostic, not proof that rendered extreme poses are gap-free. Accessories may intentionally have empty pivots. No source pixels, pivots or runtime were changed.'}
(HERE/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
lines=['# Compact rig v4: staged-source registration audit','','Source audit of the initial sixteen-piece set. Publication approved by Dylan on 2026-10-30; runtime integration is still pending.','','All 16 input PNGs fully decode as 1600×2000 RGBA and match the staged manifest hashes. Missing required files: **'+', '.join(missing)+'**. Extra source: **'+', '.join(extra)+'**.','','The coordinates are v4, not the obsolete full-body guide. “Coverage” is the fraction of the 55px-radius disk with alpha ≥128. An empty pivot alone is not a failure for eyelids/goggles, but limb seams require painted overlap on both parts. This diagnostic cannot certify extreme poses.','','| Part | Move to v4 (dx,dy) | Pivot alpha | Own disk | Parent disk |','|---|---:|---:|---:|---:|']
for r in rows:
    fmt=lambda x:'—' if x is None else f'{x*100:.1f}%'
    lines.append(f"| {r['part']} | {r['translation_to_v4'] or 'MISSING'} | {r['v4_pivot_alpha'] if r['v4_pivot_alpha'] is not None else '—'} | {fmt(r['v4_disk_coverage'])} | {fmt(r['parent_v4_disk_coverage'])} |")
lines += ['','## Required corrections, in dependency order','','1. Paint `tail-4` separately, with overlap at (760,265) and nozzle joint (1085,365). Existing `tail-3` spans the upper curl and tip; do not stretch or rename it to pretend both bones exist.','2. Paint independent `jaw` under `head` at (905,742), including hidden mouth interior. Remove/occlude the duplicated lower jaw in the head artwork. Keep 55px overlap; a hard crop will expose holes.','3. Re-register complete limb pieces to v4 using their proximal AND distal joint landmarks. The translation column diagnoses the offset; it is not a sufficient fit because scale and orientation also differ.','4. Reconcile `far-ear` into the head composition or obtain an explicit revised contract from Claude. Do not silently introduce an 18th runtime bone.','5. Fit both eyelids to the actual eye shapes on the conformed head. Check fully closed state, half-close and reopen at phone size. Do not infer a passing blink from an open-eye composite.','6. Restore the original reference blob 196a844a9dccb4f6fa910f4b1cdf3b12a81ce125 (restored in this publication). A byte-exact, fully decoding copy is included here as `reference-original.png`.','7. Claude: integrate only after source review, then exercise extreme tail/arm poses, spray endpoint, idle, blink and skip on phone/desktop. Keep game outcomes unchanged.','','## Limits','','No painted corrections or final registration are claimed by this audit. Source pixels are unchanged. Tail-tip/jaw art, overlap repaint, fitting and browser QA remain open. Separate tail-tip and jaw fitting candidates are now included; see LOCAL-HANDOFF.md for remaining correction work.','']
(HERE/'AUDIT.md').write_text('\n'.join(lines))
print(json.dumps({'decoded':len(decode),'missing':missing,'extra':extra,'v4_pivots_with_nonzero_alpha':sum((r['v4_pivot_alpha'] or 0)>0 for r in rows),'v4_pivots_with_alpha_at_least128':sum((r['v4_pivot_alpha'] or 0)>=128 for r in rows)}))
