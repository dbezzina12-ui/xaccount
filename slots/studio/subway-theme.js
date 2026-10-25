// Scene and symbol presentation only. Never changes a selected game outcome.
const asset=file=>new URL('../games/zombify/runtime/assets/studio/'+file,import.meta.url).href;
const cssURL=url=>`url(${JSON.stringify(url)})`;
export const subwayPreloads=['subway-lab.webp','subway-desktop.webp','subway-lab-desktop.webp','subway-infected.webp'].map(asset);
export const HUMAN_CROPS={j:[58,447,118,120],q:[305,447,118,120],k:[554,447,118,120],a:[554,704,118,120],skater:[182,576,118,120],nurse:[430,447,118,120],builder:[182,447,118,120],cop:[677,447,118,120],scientist:[554,576,118,120],zombie:[430,704,118,120]};
export const INFECTED_CELLS={skater:[0,0],nurse:[1,0],builder:[2,0],cop:[0,1],scientist:[1,1],vial:[2,1]};
export function subwayLayout(s){
 const mobile=s.width<s.height;
 return mobile?{counter:{x:s.width*56/390,y:s.height*147/844,w:s.width*148/390,h:s.height*25/844},rack:{x:s.width*.05,y:s.height*.632,w:s.width*.90,h:s.height*.122},label:10.5,value:20}:
 {counter:{x:s.width*1035/1280,y:s.height*386/800,w:s.width*170/1280,h:s.height*32/800},rack:{x:s.width*365/1280,y:s.height*596/800,w:s.width*550/1280,h:s.height*78/800},label:13,value:26};
}
export function subwayRules(project,title,g,s,reels,src){
 const sheet=cssURL(src('subway-art')),infected=cssURL(asset('subway-infected.webp'));
 const crop=([x,y,w,h])=>`background-image:${sheet}!important;background-size:${853/w*100}% ${1844/h*100}%!important;background-position:${x/(853-w)*100}% ${y/(1844-h)*100}%!important;background-repeat:no-repeat!important;`;
 const cell=([x,y])=>`background-image:${infected}!important;background-size:300% 200%!important;background-position:${x*50}% ${y*100}%!important;background-repeat:no-repeat!important;`;
 const paint='mask-image:none!important;filter:none!important;transform:scale(1)!important;';
 const scope=':is(#game,#welcome)';
 let rules=`html[data-studio-theme=subway]{--entry-frame-width:8px;--entry-frame-slice:64;--entry-reels:#222323;--entry-reel-texture:none;--entry-reel-mask:none}#game .board-wrap{border-image-slice:64!important;border-image-width:1!important}#game .tile{box-shadow:inset -1px -1px #73737336!important}`;
 if(title.assetId==='subway-art')rules+=`#game .brand{${crop([180,204,490,146])}}#game .brand h1{visibility:hidden!important}#welcome .guide-heading{${crop([180,204,490,146])}aspect-ratio:490 / 146;max-width:400px}#welcome #guide-page .guide-heading>img{visibility:hidden;height:100%;width:100%;object-fit:contain}`;
 for(const [id,box] of Object.entries(HUMAN_CROPS))if(project.symbols[id]==='symbol-'+id)rules+=`${scope} .symbol.art-${id}{${crop(box)}${paint}}`;
 for(const [id,box] of Object.entries(INFECTED_CELLS)){
  if(project.symbols[id]!=='symbol-'+id)continue;
  if(id==='vial'){rules+=`${scope} .symbol.art-vial{${cell(box)}${paint}}`;continue;}
  rules+=`${scope} .tile:is([data-infection="2"],.carrier-3,.carrier-5)>.symbol.art-${id}{${cell(box)}${paint}}`;
  rules+=`#game .infection-tube.art-${id} .tube-human{${crop(HUMAN_CROPS[id])}${paint}}#game .infection-tube.art-${id} .tube-zombie{${cell(box)}${paint}}`;
 }
 const mobile=s.width<s.height,lab=cssURL(asset(mobile?'subway-lab.webp':'subway-lab-desktop.webp'));
 const {counter:c,rack:r,label,value}=subwayLayout(s);
 rules+=`
 #game[data-free-spins] .studio-background{background-image:${lab}!important}
 #game[data-free-spins] .brand{visibility:hidden!important}
 #game[data-free-spins] .free-spins-counter{left:${c.x-reels.x}px!important;right:auto!important;top:${c.y-reels.y}px!important;bottom:auto!important;width:${c.w}px!important;height:${c.h}px!important;transform:none!important;z-index:35!important}
 #game[data-free-spins] .counter-art{display:none!important}
 #game[data-free-spins] .counter-lift{position:relative!important;inset:0!important;width:100%!important;height:100%!important;transform:none!important;filter:none!important;animation:none!important}
 #game[data-free-spins] .counter-copy{position:absolute!important;inset:0!important;box-sizing:border-box!important;width:100%!important;height:100%!important;display:grid!important;grid-template-columns:minmax(0,1fr) 2ch!important;align-items:center!important;justify-content:center!important;text-align:center!important;padding:0 3px!important;gap:4px!important;overflow:hidden!important;transform:none!important}
 #game[data-free-spins] .counter-copy>span{font-size:${label}px!important;line-height:1!important;letter-spacing:0!important;white-space:nowrap!important;color:#fff1d3!important;margin:0!important;padding:0!important}
 #game[data-free-spins] .counter-copy>strong{font-size:${value}px!important;line-height:1!important;letter-spacing:0!important;transform:none!important;filter:none!important;color:#c3f63d!important;margin:0!important;padding:0!important}
 #game[data-free-spins] .infection-tracker{left:${r.x-reels.x}px!important;top:${r.y-reels.y}px!important;width:${r.w}px!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;margin:0!important}
 #game[data-free-spins] .infection-tracker:before,#game[data-free-spins] .infection-tracker:after,#game[data-free-spins] .infection-heading{display:none!important}
 #game[data-free-spins] .infection-people{gap:${mobile?8:18}px!important;align-items:end!important}
 #game[data-free-spins] .infection-tube{height:${r.h}px!important;width:${mobile?'100%':r.h*.67+'px'}!important;margin-inline:auto!important;max-height:none!important;filter:drop-shadow(0 2px 1px #0008)!important}
 #game[data-free-spins] .tube-window{inset:13% 7% 21%!important;border:2px solid #a3d75e!important;border-radius:5px!important;background:#193023!important}
 #game[data-free-spins] .tube-frame{inset:0!important;background:none!important;border-radius:7px!important;border-top:10px solid #455c75!important;border-bottom:18px solid #263a52!important;box-shadow:inset 2px 0 #78969f,inset -2px 0 #132439,0 0 0 2px #0a1522!important}
 #game[data-free-spins] .tube-count{top:auto!important;bottom:3%!important;font-size:12px!important}
 #game[data-free-spins] .tube-value{bottom:-13%!important;left:0!important;right:0!important;font-size:11px!important;color:#d7fca3!important}
 #game[data-free-spins] .tube-markers{inset:18% 9% 26%!important}
 #game[data-free-spins] .tube-character{inset:0!important}
 #game[data-free-spins] .tube-name{display:none!important}
 `;
 return rules;
}
