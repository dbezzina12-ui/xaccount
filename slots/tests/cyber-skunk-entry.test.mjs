import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
// Exercise the shipped launch decision; stub only the imported legacy boot.
const code=script.replace("import { boot } from './engine/client/main.js';",'');
for(const [name,input,expected] of [
  ['plain','https://example.test/slots/index.html?game=cyber-skunk','https://example.test/slots/games/cyber-skunk/runtime/index.html'],
  ['nested directory','https://example.test/demo/slots/?game=cyber-skunk','https://example.test/demo/slots/games/cyber-skunk/runtime/index.html'],
  ['parameters and fragment','https://example.test/slots/index.html?game=cyber-skunk&studioLayout=viewport&note=a%26b#entry','https://example.test/slots/games/cyber-skunk/runtime/index.html?studioLayout=viewport&note=a%26b#entry'],
])test(`Cyber Skunk entry routing: ${name}`,()=>{
  const redirects=[],boots=[];
  runInNewContext(code,{URL,location:{href:input,replace:u=>redirects.push(u)},boot:o=>boots.push(o)});
  assert.deepEqual(redirects,[expected]);assert.deepEqual(boots,[]);
});
for(const query of ['', '?game=game-001','?game=zombify','?game=nightfall'])test(`legacy entry preserved: ${query||'default'}`,()=>{
  const redirects=[],boots=[];
  runInNewContext(code,{URL,location:{href:'https://example.test/slots/index.html'+query,replace:u=>redirects.push(u)},boot:o=>boots.push(o.game)});
  assert.deepEqual(redirects,[]);assert.deepEqual(boots,['game-001']);
});
