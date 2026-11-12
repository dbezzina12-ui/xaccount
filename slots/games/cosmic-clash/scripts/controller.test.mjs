import test from 'node:test';
import assert from 'node:assert/strict';
import {controllerMarkup,controllerView,mountController} from '../dist/controller/controller.js';
function host(){
 const nodes=new Map(),handlers=new Map();
 const root={
  set innerHTML(html){for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set(id,{id,style:{setProperty(){}},dataset:{},attributes:{},disabled:false,textContent:'',innerHTML:'',appendChild(node){node.parentNode=this;},setAttribute(k,v){this.attributes[k]=v;}});for(const [,id,action] of html.matchAll(/<button[^>]+id="([^"]+)"[^>]+data-action="([^"]+)"/g))nodes.get(id).dataset.action=action;},
  getElementById:id=>nodes.get(id),querySelector:()=>({dataset:{},style:{setProperty(){}}}),addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),replaceChildren:()=>nodes.clear(),
 };
 return {dataset:{},shadowRoot:null,attachShadow(){this.shadowRoot=root;return root;},click(id){const button=nodes.get(id);handlers.get('click')?.({target:{closest:()=>button}});},nodes,handlers};
}
test('Play, Stop, Continue and result hold follow authoritative round state',()=>{
 assert(controllerView({}).playDisabled);
 assert(controllerView({}).settingsDisabled);
 for(const state of [{busy:true},{busy:true,holding:true},{busy:true,continuing:true},{busy:true,autoActive:true}]){
  const view=controllerView({ready:true,...state});assert(!view.settingsDisabled);assert(!view.turboDisabled);assert(!view.soundDisabled);assert(view.betDisabled);assert(view.buyDisabled);
 }
 assert.equal(controllerView({ready:true}).playLabel,'Play');
 const busy=controllerView({ready:true,busy:true});assert.equal(busy.playLabel,'Stop spin');assert(!busy.playDisabled);assert(busy.buyDisabled);assert(busy.minusDisabled);assert(!busy.settingsDisabled);
 const holding=controllerView({ready:true,busy:true,holding:true});assert(holding.playDisabled);assert.equal(holding.phase,'holding');
 assert.equal(controllerView({ready:true,busy:true,continuing:true}).playLabel,'Continue');
});
test('Autoplay can always be stopped while the round is running; a second paid round cannot be started between spins',()=>{
 const running=controllerView({ready:true,busy:true,autoActive:true});assert(!running.autoDisabled);assert.equal(running.autoLabel,'Stop autoplay');
 const between=controllerView({ready:true,autoActive:true});assert(between.playDisabled);assert(between.buyDisabled);assert(between.minusDisabled);
 assert(controllerView({ready:true,busy:true}).autoDisabled);
});
test('all required actions are unique and a mounted controller blocks disabled actions',()=>{
 const actions=[...controllerMarkup().matchAll(/data-action="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(actions).size,9);assert.deepEqual([...actions].sort(),['auto','bet','betMinus','betPlus','buy','play','settings','sound','turbo']);
 const h=host(),calls=[],c=mountController(h,{onAction:a=>calls.push(a),initial:{ready:true}});
 h.click('play');c.update({busy:true});h.click('buy');h.click('betPlus');h.click('settings');h.click('auto');h.click('play');
 assert.deepEqual(calls,['play','settings','play']);c.update({holding:true});h.click('play');assert.equal(calls.length,3);
 c.destroy();assert.equal(h.handlers.size,0);assert.equal(h.nodes.size,0);
});
test('partial audio updates retain the latest win, autoplay count and bet boundaries',()=>{
 const h=host(),c=mountController(h,{initial:{ready:true,win:'$0.00'}});
 c.update({win:'$12,500,000.00',autoActive:true,remaining:23,canDecrease:false});c.update({muted:true});
 assert.equal(c.element('win').textContent,'$12,500,000.00');assert.equal(c.element('remaining').textContent,'23');assert(c.element('betMinus').disabled);
 assert.equal(c.state.muted,true);
 assert.equal(c.element('auto').attributes['aria-label'],'Stop autoplay');
 c.update({autoActive:false,buyActive:true,banner:'DUEL SPINS'});assert(c.element('remaining').hidden);assert.equal(c.element('buy').attributes['aria-label'],'Disable feature spins');assert.equal(c.element('buyLabel').innerHTML,'DISABLE');assert.equal(c.element('banner').textContent,'DUEL SPINS');
});
test('two games can mount independent controllers without ID or state collisions',()=>{
 const a=mountController(host(),{initial:{ready:true}}),b=mountController(host(),{initial:{ready:true}});
 a.update({turbo:true,busy:true,win:'$500.00'});assert.equal(b.state.busy,false);assert.equal(b.element('win').textContent,'$0.00');
 const copy=a.state;copy.win='changed';assert.equal(a.state.win,'$500.00');
});

test('moving Buy into the scene preserves its action, feature and disabled states; compact mode restores it',()=>{
 const h=host(),calls=[],properties=new Map(),surface={dataset:{},style:{setProperty:(k,v)=>properties.set(k,v)}};
 const deck={getBoundingClientRect:()=>({left:640,top:740})};
 const attach=h.attachShadow.bind(h);h.attachShadow=()=>{const root=attach();root.querySelector=s=>s==='.deck'?deck:surface;return root;};
 const c=mountController(h,{initial:{ready:true,buyActive:true,featureColor:'#58e3ee'},onAction:a=>calls.push(a)});
 const original=c.element('buy');c.setBuyAnchor({x:500,y:175,size:132});
 assert.equal(properties.get('--buy-x'),'-140px');assert.equal(properties.get('--buy-y'),'-565px');
 assert.equal(properties.get('--buy-size'),'132px');assert.equal(surface.dataset.buyAnchored,'true');h.click('buy');assert.deepEqual(calls,['buy']);
 c.update({busy:true});h.click('buy');assert.equal(calls.length,1);
 c.setBuyAnchor(null);assert.equal(surface.dataset.buyAnchored,'false');assert.equal(c.element('buy'),original);
 assert.equal(original.dataset.active,'true');assert(original.disabled);
});

test('feature colors survive spins and audio updates, then reset with the feature',()=>{
 const h=host();let color;const surface={dataset:{},style:{setProperty:(name,value)=>{if(name==='--feature-color')color=value;}}};
 const attach=h.attachShadow.bind(h);h.attachShadow=()=>{const root=attach();root.querySelector=()=>surface;return root;};
 const c=mountController(h,{initial:{ready:true}});
 for(const featureColor of ['#ff941f','#58e3ee']){
  c.update({featureColor,buyActive:true,busy:false});c.update({busy:true});c.update({muted:true});c.update({busy:false});
  assert.equal(color,featureColor);assert.equal(surface.dataset.featureActive,'true');assert.equal(c.element('buy').attributes['aria-label'],'Disable feature spins');assert.equal(c.element('banner').hidden,true);
 }
 c.update({featureColor:null,buyActive:false});assert.equal(surface.dataset.featureActive,'false');assert.equal(c.element('buy').attributes['aria-label'],'Buy bonus');assert.equal(c.element('buyLabel').innerHTML,'BUY<br><b>BONUS</b>');
});

test('the whole BET button requests a picker, keeps its current cost label, and locks during paid play or autoplay',()=>{
 const h=host(),calls=[],c=mountController(h,{onAction:a=>calls.push(a)});
 h.click('betPicker');assert.deepEqual(calls,[]);
 c.update({ready:true,bet:'$50.00',featureColor:'#58e3ee'});h.click('betPicker');
 assert.deepEqual(calls,['bet']);assert.equal(c.element('betPicker').attributes['aria-label'],'Change bet, current spin cost $50.00');
 c.update({busy:true});h.click('betPicker');c.update({busy:false,autoActive:true});h.click('betPicker');assert.equal(calls.length,1);
 c.update({autoActive:false});h.click('betPicker');assert.equal(calls.length,2);
 assert(!c.element('winReadout').hidden);c.update({win:'$15.00'});assert(!c.element('winReadout').hidden);
});

test('rotating between mobile and desktop moves the original controller without resetting a paid round',()=>{
 const h=host(),calls=[],listeners=new Set();
 const media={matches:false,addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn)};
 const desktop={appendChild:node=>{node.parentNode=desktop;}},mobile={appendChild:node=>{node.parentNode=mobile;}};
 const c=mountController(h,{layoutMedia:media,layoutTargets:{desktop,mobile},onAction:a=>calls.push(a),initial:{ready:true}});
 const play=c.element('play'),bet=c.element('betPicker');
 assert.equal(h.parentNode,desktop);
 c.update({busy:true,autoActive:true,remaining:7,buyActive:true,featureColor:'#58e3ee',bet:'$50.00',win:'$123.45'});
 for(const matches of [true,false,true]){
  media.matches=matches;for(const change of listeners)change();
  assert.equal(h.parentNode,matches?mobile:desktop);assert.equal(h.dataset.layout,matches?'mobile':'desktop');
  assert.equal(c.element('betSteps').parentNode,c.element(matches?'playControls':'betGroup'));
  assert.equal(c.element('desktopStyles').media,matches?'not all':'all');
  assert.equal(c.element('mobileBaseStyles').media,matches?'all':'not all');
  assert.equal(c.element('mobileStyles').media,matches?'all':'not all');
  assert.equal(c.element('play'),play);assert.equal(c.element('betPicker'),bet);
  assert.equal(c.state.remaining,7);assert.equal(c.state.featureColor,'#58e3ee');
  assert.equal(c.element('win').textContent,'$123.45');assert.equal(c.element('bet').textContent,'$50.00');
  assert(bet.disabled);assert(c.element('buy').disabled);
  h.click('betPicker');h.click('buy');h.click('betPlus');h.click('auto');
 }
 assert.deepEqual(calls,['auto','auto','auto']);
 c.update({busy:false,autoActive:false});h.click('betPicker');assert.equal(calls.at(-1),'bet');
 c.destroy();assert.equal(listeners.size,0);
});


test('mobile sound and turbo use authoritative state without changing the round or bet',()=>{
 const h=host(),calls=[],c=mountController(h,{onAction:a=>calls.push(a)});
 h.click('turbo');h.click('sound');assert.deepEqual(calls,[]);
 c.update({ready:true,bet:'$50.00',win:'$25.00'});h.click('turbo');h.click('sound');
 assert.deepEqual(calls,['turbo','sound']);
 c.update({turbo:true,muted:true,busy:true});
 assert.equal(c.element('turbo').attributes['aria-label'],'Disable turbo');assert(!c.element('turbo').disabled);
 assert.equal(c.element('sound').attributes['aria-label'],'Unmute sound');assert(!c.element('sound').disabled);
 h.click('turbo');h.click('sound');assert.deepEqual(calls,['turbo','sound','turbo','sound']);
 assert.equal(c.state.bet,'$50.00');assert.equal(c.state.win,'$25.00');assert(c.state.busy);
 assert.equal(c.element('play').attributes['aria-label'],'Stop spin');
 assert(!controllerMarkup().includes('skip-icon'));
});

test('zero WIN stays visible across rotation and partial audio updates',()=>{
 const h=host(),media={matches:true,addEventListener(name,fn){this.change=fn;},removeEventListener(){}};
 const c=mountController(h,{layoutMedia:media,initial:{ready:true}});
 assert(!c.element('winReadout').hidden);assert.equal(c.element('win').textContent,'$0.00');
 c.update({muted:true});assert(!c.element('winReadout').hidden);
 media.matches=false;media.change();assert(!c.element('winReadout').hidden);
 media.matches=true;media.change();assert(!c.element('winReadout').hidden);
});
