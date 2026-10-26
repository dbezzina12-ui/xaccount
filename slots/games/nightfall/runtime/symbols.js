export const symbolNames={ruby:'Jack-o-lantern',sapphire:'Skull',emerald:'Witch hat',amethyst:'Ghost',amber:'Candy apple',shield:'Potion',crown:'Candy',wild:'Reaper wild','arrow-wild':'Mage wild',fs:'Free spins'};
export const symbolAssets=[...new Set(Object.keys(symbolNames).map(k=>'assets/nightfall/symbols/'+(k==='arrow-wild'?'wild':k)+'.webp'))];
export function symbolArt(kind){
 if(kind==='fs')return '<span class="fs-symbol" role="img" aria-label="Free spins"><img class="fs-shield" src="assets/nightfall/symbols/fs.webp" alt="" draggable="false"><span class="fs-letters" aria-hidden="true"></span></span>';
 return `<img src="assets/nightfall/symbols/${kind==='arrow-wild'?'wild':kind}.webp" alt="${symbolNames[kind]||kind}" draggable="false">`;
}
