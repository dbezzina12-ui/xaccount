export const symbolNames={ruby:'Jack-o-lantern',sapphire:'Skull',emerald:'Witch hat',amethyst:'Ghost',amber:'Candy apple',shield:'Potion',crown:'Candy',wild:'Reaper wild','arrow-wild':'Mage wild','roam-wild':'Roaming wild',fs:'Free spins',sfs:'Super tombstone'};
export const symbolAssets=[...new Set(Object.keys(symbolNames).map(k=>'assets/nightfall/symbols/'+(k==='arrow-wild'||k==='roam-wild'?'wild':k==='sfs'?'fs':k)+'.webp'))];
export function symbolArt(kind){
 // The gold Super tombstone is the FS tombstone, gilded, until it has its own art.
 if(kind==='fs'||kind==='sfs')return `<span class="fs-symbol${kind==='sfs'?' fs-super':''}" role="img" aria-label="${symbolNames[kind]}"><img class="fs-shield" src="assets/nightfall/symbols/fs.webp" alt="" draggable="false"><span class="fs-letters" aria-hidden="true"></span></span>`;
 return `<img src="assets/nightfall/symbols/${kind==='arrow-wild'||kind==='roam-wild'?'wild':kind}.webp" alt="${symbolNames[kind]||kind}" draggable="false">`;
}
