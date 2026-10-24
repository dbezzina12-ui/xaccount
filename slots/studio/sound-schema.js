import {AUDIO_CUES} from '../games/zombify/runtime/audio-manifest.js';
export const SOUND_EVENTS=['music-base','music-bonus',...Object.keys(AUDIO_CUES)];
export function validateSounds(settings,assets){
 if(settings===undefined)return;
 if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('Invalid sound settings.');
 for(const [event,s] of Object.entries(settings)){
  if(!SOUND_EVENTS.includes(event)||!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['assetId','volume','fade','loop'].includes(k)))throw Error('Invalid sound event.');
  if(s.assetId!==undefined&&s.assetId!==null&&!assets.some(a=>a.id===s.assetId&&a.kind==='audio'))throw Error('Missing audio asset.');
  for(const [key,max] of [['volume',1],['fade',5]])if(s[key]!==undefined&&(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<0||s[key]>max))throw Error('Invalid sound '+key);
  if(s.loop!==undefined&&(typeof s.loop!=='boolean'||!event.startsWith('music-')))throw Error('Looping is only available for music.');
 }
}
