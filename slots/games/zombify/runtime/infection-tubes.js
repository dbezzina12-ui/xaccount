// Presentation only: the round's existing infection state owns every threshold.
// Retain each tube across bite/reveal events so liquid and bubbles stay continuous.
export function createInfectionTubes({container,people,labels,multipliers}){
 const doc=container.ownerDocument;
 const make=(tag,className)=>{const node=doc.createElement(tag);node.className=className;return node;};
 const tubes=people.map((kind,index)=>{
  const entry=make('div','infection-person tube-person');
  entry.setAttribute('role','img');entry.dataset.kind=kind;
  const tube=make('div',`infection-tube art-${kind}`);tube.setAttribute('aria-hidden','true');
  tube.style.setProperty('--tube-phase',`${index*-.71}s`);
  const window=make('div','tube-window');
  const back=make('div','tube-liquid tube-liquid-back');
  const human=make('span','tube-character tube-human');
  const zombie=make('span','tube-character tube-zombie');
  const front=make('div','tube-liquid tube-liquid-front');
  const surface=make('span','tube-surface');front.append(surface);
  for(let n=0;n<4;n++){
   const bubble=make('i','tube-bubble');bubble.style.setProperty('--bubble',String(n));front.append(bubble);
  }
  window.append(back,human,zombie,front);
  const frame=make('span','tube-frame');
  const marks=make('span','tube-markers'),markers=[];
  for(let bite=1;bite<=3;bite++){
   const mark=make('i','tube-marker');mark.style.setProperty('--mark',String(bite));markers.push(mark);marks.append(mark);
  }
  const count=make('span','tube-count');
  const value=make('strong','tube-value');value.textContent=`+${multipliers[kind]}×`;
  tube.append(window,frame,marks,count,value);
  const name=make('span','tube-name');name.textContent=labels[kind];name.setAttribute('aria-hidden','true');
  entry.append(tube,name);
  return {kind,entry,count,markers,previous:-1};
 });
 container.replaceChildren(...tubes.map(tube=>tube.entry));
 return {
  update(progress={}){
   let infected=0;
   for(const tube of tubes){
    const raw=progress[tube.kind];
    const bites=Number.isFinite(raw)?Math.max(0,Math.min(3,Math.floor(raw))):0;
    if(bites===3)infected++;
    if(bites===tube.previous)continue;
    tube.entry.classList.remove(`stage-${tube.previous}`);
    tube.entry.classList.add(`stage-${bites}`);
    tube.entry.classList.toggle('tube-reset',bites===0||tube.previous<0);
    tube.entry.dataset.bites=String(bites);
    tube.entry.style.setProperty('--goo-level',`${bites/3*100}%`);
    tube.entry.setAttribute('aria-label',`${labels[tube.kind]}: ${bites} of 3 bites. ${bites===3?'Infected, adds':'Unlocks'} ${multipliers[tube.kind]} times.`);
    tube.count.textContent=`${bites}/3`;
    tube.markers.forEach((marker,i)=>marker.classList.toggle('filled',bites>i));
    tube.previous=bites;
   }
   return infected;
  }
 };
}
