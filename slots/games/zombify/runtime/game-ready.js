import {IMAGE_ASSETS} from './preload-manifest.js?v=125';
import {AUDIO_ASSETS} from './audio-manifest.js?v=116';
import {loadImage,loadBytes} from './asset-cache.js';
import {preloadApprovedRigs} from './approved-rig.js';
import {recliningArtReady} from './reclining-art.js';
import {warmWinZombie} from './win-zombie.js';
import {createLoadingState} from './loading-state.js';
export const gameReady=createLoadingState([
 ...IMAGE_ASSETS.map(url=>()=>loadImage(url)),
 preloadApprovedRigs,recliningArtReady,()=>warmWinZombie({strict:true}),
 ()=>globalThis.document?.fonts?.ready,
 // Hidden bonus dialogs do not cause font loading by themselves. Warm both
 // display faces before Play so the first door reveal never swaps lettering.
 ...['400 32px Creepster','400 32px "Lilita One"'].map(font=>async()=>{
  const fonts=globalThis.document?.fonts;if(!fonts)return;
  const faces=await fonts.load(font);
  if(!faces.length)throw new Error('Bonus lettering is still loading. Please retry.');
 }),
 // Download silently; decoding/unlocking audio still follows a user gesture.
 ...Object.values(AUDIO_ASSETS).map(url=>()=>loadBytes(url))
]);
