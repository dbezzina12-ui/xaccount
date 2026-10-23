// @mentions route a Studio chat message to one or both assistants. Matching is by prefix so quick typing still lands:
// "@cl…" (Claude, @claudr) is Claude; "@ch…", "@gpt…", "@op…" (ChatGPT, @chat, @openai) is ChatGPT; @both/@all is both.
export const NAMES={openai:'ChatGPT',claude:'Claude'};
const WORD=/(^|[\s(,])@([a-z]+)/gi;
export function resolve(word){
 const w=word.toLowerCase();
 if(/^(?:both|all|everyone|team)$/.test(w))return ['openai','claude'];
 if(w.startsWith('cl'))return ['claude'];
 if(/^(?:ch|gpt|op)/.test(w))return ['openai'];
 return [];
}
// Assistants in the order they were first mentioned.
export function mentions(text){
 const out=[];
 for(const m of text.matchAll(WORD))for(const p of resolve(m[2]))if(!out.includes(p))out.push(p);
 return out;
}
// Text split into plain runs and recognised mentions, for display.
export function segments(text){
 const out=[];let at=0;
 for(const m of text.matchAll(WORD)){
  if(!resolve(m[2]).length)continue;
  const start=m.index+m[1].length,end=start+1+m[2].length;
  if(start>at)out.push({text:text.slice(at,start)});
  out.push({text:text.slice(start,end),mention:true});
  at=end;
 }
 if(at<text.length)out.push({text:text.slice(at)});
 return out;
}
// The partial "@wor" just before the caret, if the user is typing a mention.
export function typing(text,caret){
 const m=/(^|[\s(,])@([a-z]*)$/i.exec(text.slice(0,caret));
 return m?{start:caret-m[2].length-1,word:m[2]}:null;
}
