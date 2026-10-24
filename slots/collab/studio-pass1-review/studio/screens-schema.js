export const SCREEN_PARTS={
 base:{name:'Base game',root:'#game',parts:{}},
 counter:{name:'Bonus hand / counter',root:'#free-spins-counter',parts:{art:['Hand artwork only','.counter-art'],hand:['Whole hand + text','#free-spins-counter'],copy:['Text group','.counter-copy'],label:['Free-spins label','#free-spins-label'],value:['Remaining spins','#free-spins-value']}},
 infection:{name:'Regular bonus / infection jars',root:'#infection-tracker',parts:{rack:['Whole jar rack','#infection-tracker'],jars:['Jars','#infection-people'],heading:['Progress text','.infection-heading'],caption:['Jar heading','.infection-heading strong']}},
 win:{name:'Win celebration',root:'#win-celebration',parts:{actor:['Character artwork','.win-actor'],copy:['Whole text group','.win-copy'],heading:['Win heading','#celebration-title'],total:['Win amount','[data-win-amount]'],multiple:['Bet multiplier','[data-win-multiple]']}},
 bonus:{name:'Bonus introduction',root:'#feature',parts:{panel:['Panel','#feature-content'],heading:['Heading','#feature-heading'],award:['Spins awarded','#feature-award'],description:['Description','#feature-description'],button:['Continue button','#feature-continue']}},
 result:{name:'Bonus result',root:'#feature',parts:{panel:['Panel','#feature-content'],heading:['Heading','#feature-heading'],total:['Win amount','#feature-result-value'],description:['Description','#feature-description'],button:['Continue button','#feature-continue']}},
 intro:{name:'Intro branding',root:'#welcome',parts:{panel:['Whole intro','#studio-page'],logo:['Logo','.studio-monogram'],wordmark:['Wordmark','.studio-wordmark'],tagline:['Tagline','.studio-presenting']}},
 guide:{name:'How to play intro',root:'#welcome',parts:{panel:['Whole guide','#guide-page'],title:['Title','#guide-title'],cards:['Feature cards','.guide-cards'],copy:['Card descriptions','.guide-copy p']}},
 controls:{name:'Bottom controller',root:'#mobile-controller',parts:{panel:['Controller','#mobile-controller, #game .console']}}
};
export const DEFAULT_PART={x:0,y:0,scale:1,fontSize:0,opacity:1};
export const FONTS={'':'Original',creepster:'Creepster',lilita:'Lilita One',sans:'Sans serif',serif:'Serif'};
const FONT_CSS={creepster:'Creepster,sans-serif',lilita:'"Lilita One",sans-serif',sans:'Arial,sans-serif',serif:'Georgia,serif'};
export const TEXT_PARTS={counter:['copy','label','value'],infection:['heading','caption'],bonus:['heading','award','description','button'],result:['heading','total','description','button'],intro:['wordmark','tagline'],guide:['title','copy'],win:['copy','heading','total','multiple']};
// Only plain leaf labels can replace copy. Counts, amounts and formatted groups
// remain owned by the game, even in imported project files.
export const COPY_PARTS={counter:['label'],infection:['caption'],bonus:['heading','description','button'],result:['heading','button'],intro:['tagline']};
export const isTextPart=(screen,part)=>TEXT_PARTS[screen]?.includes(part)||false;
export const isCopyPart=(screen,part)=>COPY_PARTS[screen]?.includes(part)||false;
export function partSelector(screen,part){const selector=SCREEN_PARTS[screen].parts[part][1];return screen==='bonus'||screen==='result'?`#feature${screen==='result'?'[data-view="result"]':':not([data-view="result"])'} ${selector}`:selector;}
export function validateScreens(s){
 if(s===undefined)return;
 if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Invalid screen settings');
 for(const [screen,parts] of Object.entries(s)){
  if(!Object.hasOwn(SCREEN_PARTS,screen)||!parts||typeof parts!=='object'||Array.isArray(parts))throw Error('Unknown screen');
  for(const [part,v]of Object.entries(parts)){
   if(!Object.hasOwn(SCREEN_PARTS[screen].parts,part)||!v||typeof v!=='object'||Array.isArray(v))throw Error('Unknown screen part');
   for(const [k,n]of Object.entries(v)){
    if(k==='text'){if(!isCopyPart(screen,part)||typeof n!=='string'||n.length>500)throw Error('Only labels can replace text (500 characters maximum).');continue;}
    if(['color','fontFamily','textAlign'].includes(k)){
     const ok=isTextPart(screen,part)&&typeof n==='string'&&(k==='color'?(n===''||/^#[0-9a-f]{6}$/i.test(n)):k==='fontFamily'?Object.hasOwn(FONTS,n):['','left','center','right'].includes(n));
     if(!ok)throw Error('Invalid text style');continue;
    }
    const limits={x:[-2000,2000],y:[-2000,2000],scale:[.1,4],fontSize:[0,200],opacity:[0,1]}[k];
    if(!limits||typeof n!=='number'||!Number.isFinite(n)||n<limits[0]||n>limits[1])throw Error('Invalid screen adjustment');
   }
  }
 }
}
export function screenCSS(settings={}){
 validateScreens(settings);let css='';
 for(const [screen,parts]of Object.entries(settings))for(const [part,value]of Object.entries(parts)){
  const v={...DEFAULT_PART,...value},selector=partSelector(screen,part).split(',').map(s=>':is(html,#studio-adjustment-priority):is(html,#studio-adjustment-priority) '+s.trim()).join(',');
  const baseline=(screen==='bonus'||screen==='result')&&part==='panel'?'-50%':'0%';
  css+=`${selector}{translate:${v.x}px calc(${baseline} + ${v.y}px)!important;scale:${v.scale}!important;opacity:${v.opacity}!important;${v.fontSize?'font-size:'+v.fontSize+'px!important;':''}${v.color?'color:'+v.color+'!important;':''}${v.fontFamily?'font-family:'+FONT_CSS[v.fontFamily]+'!important;':''}${v.textAlign?'text-align:'+v.textAlign+'!important;':''}}\n`;
 }return css;
}
