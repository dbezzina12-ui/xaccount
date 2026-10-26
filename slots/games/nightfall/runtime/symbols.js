export const symbolNames={ruby:'Jack-o-lantern',sapphire:'Skull',emerald:'Witch hat',amethyst:'Ghost',amber:'Candy apple',shield:'Potion',crown:'Candy',wild:'Reaper wild','arrow-wild':'Mage wild','roam-wild':'Roaming wild',fs:'Free spins',sfs:'Super tombstone',hfs:'Hidden tombstone'};
const lanternPath='assets/nightfall/roaming-wild/';
const lanternFiles=['glass','front','wisp-left','wisp-right','fire-strip','full'];
export const symbolAssets=[...new Set(Object.keys(symbolNames).filter(k=>k!=='roam-wild').map(k=>'assets/nightfall/symbols/'+(k==='arrow-wild'?'wild':k==='sfs'||k==='hfs'?'fs':k)+'.webp')),...lanternFiles.map(name=>lanternPath+name+'.webp')];
// Pause decorative sprite clocks when hidden; the menu pause is handled in CSS.
if(typeof document!=='undefined'){
 const pauseLanterns=()=>document.documentElement.classList.toggle('lantern-paused',document.hidden);
 document.addEventListener('visibilitychange',pauseLanterns);pauseLanterns();
}
export function symbolArt(kind){
 if(kind==='roam-wild')return `<span class="roaming-wild" role="img" aria-label="Roaming wild soul lantern"><img class="roam-layer roam-wisp-left" src="${lanternPath}wisp-left.webp" alt="" draggable="false"><img class="roam-layer roam-wisp-right" src="${lanternPath}wisp-right.webp" alt="" draggable="false"><img class="roam-layer" src="${lanternPath}glass.webp" alt="" draggable="false"><span class="roam-fire-window"><img class="roam-fire-strip" src="${lanternPath}fire-strip.webp" alt="" draggable="false"></span><img class="roam-layer" src="${lanternPath}front.webp" alt="" draggable="false"><img class="roam-still" src="${lanternPath}full.webp" alt="" draggable="false"></span>`;
 // The gold Super and Hidden tombstones are the FS tombstone, tinted, until they have their own art.
 if(kind==='fs'||kind==='sfs'||kind==='hfs')return `<span class="fs-symbol${{sfs:' fs-super',hfs:' fs-hidden'}[kind]||''}" role="img" aria-label="${symbolNames[kind]}"><img class="fs-shield" src="assets/nightfall/symbols/fs.webp" alt="" draggable="false"><span class="fs-letters" aria-hidden="true"></span></span>`;
 return `<img src="assets/nightfall/symbols/${kind==='arrow-wild'?'wild':kind}.webp" alt="${symbolNames[kind]||kind}" draggable="false">`;
}
