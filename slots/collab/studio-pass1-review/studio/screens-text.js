import {COPY_PARTS,partSelector,validateScreens} from './screens-schema.js';
// Keep the latest game-provided label so reset/Undo restores it, including when
// the game changes a bonus tier while an override is active. Never use HTML.
export function createScreenText(root,Observer=globalThis.MutationObserver){
 let settings={},observer;const states=new Map();
 function apply(){
  const desired=new Map();
  for(const [screen,parts]of Object.entries(COPY_PARTS))for(const part of parts){
   const text=settings[screen]?.[part]?.text;
   if(text)for(const el of root.querySelectorAll(partSelector(screen,part)))desired.set(el,text);
  }
  for(const [el,state]of states){
   if(el.textContent!==state.last)state.original=el.textContent;
   if(!desired.has(el)){if(el.textContent===state.last)el.textContent=state.original;states.delete(el);}
  }
  for(const [el,text]of desired){
   let state=states.get(el);if(!state){state={original:el.textContent,last:null};states.set(el,state);}
   if(el.textContent!==text)el.textContent=text;state.last=text;
  }
 }
 function watch(){observer?.disconnect();observer=undefined;
  if(!Object.entries(COPY_PARTS).some(([s,parts])=>parts.some(p=>settings[s]?.[p]?.text)))return;
  observer=new Observer(records=>{
   // Ignore the game's frequent reel/counter updates unless a target label or
   // feature context changed. Observer is disconnected during our own writes.
   const relevant=records.some(r=>r.type==='attributes'||[...states.keys()].some(el=>el===r.target||el.contains(r.target)));
   if(relevant){observer.disconnect();apply();observe();}
  });observe();
 }
 function observe(){observer?.observe(root,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-view','data-tier']});}
 return {set(next){validateScreens(next);observer?.disconnect();settings=next;apply();watch();},original(el){return states.get(el)?.original;},dispose(){observer?.disconnect();settings={};apply();}};
}
