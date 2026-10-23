import test from 'node:test';
import assert from 'node:assert/strict';
import {mentions,segments,typing} from '../studio/mentions.js';

test('mentions route to the right assistant, typos included',()=>{
 for(const word of ['@Claude','@claude','@claudr','@cl','@CLAUDE'])assert.deepEqual(mentions(word+' check the lock'),['claude'],word);
 for(const word of ['@ChatGPT','@chat','@chatgtp','@gpt','@openai','@OpenAI'])assert.deepEqual(mentions('hey '+word+' new art'),['openai'],word);
 assert.deepEqual(mentions('@both look'),['openai','claude']);
 assert.deepEqual(mentions('@claude then @chat'),['claude','openai'],'in the order mentioned');
 assert.deepEqual(mentions('@claude @claudr again'),['claude'],'no duplicates');
 assert.deepEqual(mentions('mail dylan@chat.com about @zombies'),[],'emails and unknown words are not mentions');
 assert.deepEqual(mentions('(@chat) please'),['openai']);
});

test('display segments and the mention being typed',()=>{
 assert.deepEqual(segments('hi @claudr, and @zombies'),[{text:'hi '},{text:'@claudr',mention:true},{text:', and @zombies'}]);
 assert.deepEqual(typing('hello @cl',9),{start:6,word:'cl'});
 assert.deepEqual(typing('@',1),{start:0,word:''});
 assert.equal(typing('dylan@ch',8),null);
 assert.equal(typing('@claude done',12),null);
});
