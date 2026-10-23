const prefix='./assets/audio/';
export const AUDIO_ASSETS=Object.fromEntries(['ui','spin','stop-0','stop-1','stop-2','step-0','step-1','step-2','bite-0','bite-1','bite-2','vial','grow','land','full','infect','bonus','win','win-big','finish','music-base','music-bonus'].map(name=>[name,`${prefix}${name}.mp3`]));
// Dylan's corrected assignment: 2:05 base music and 77-second bonus music.
// Versioned URLs invalidate previous recordings in the preload/browser caches.
for(const scene of ['base','bonus'])AUDIO_ASSETS['music-'+scene]=`${prefix}approved-music-v116/music-${scene}.mp3`;
// The four approved shared tracks, kept byte-for-byte as supplied by Dylan.
// A distinct path also prevents an old cached Kenney cue being reused.
for(const tier of ['nice','big','epic','max'])AUDIO_ASSETS['celebrate-'+tier]=`${prefix}shared-wins-v109/celebrate-${tier}.mp3`;
AUDIO_ASSETS['buy']='./assets/audio/gg-bonus-buy-v1.mp3';
export const AUDIO_CUES={
 buy:{files:['buy'],gain:.55,gap:.15},
 heart:{files:['infect'],gain:.48,gap:.15,duck:.5},
 respin:{files:['grow'],gain:.4,gap:.3,duck:.5},
 ui:{files:['ui'],gain:.18,gap:.04},spin:{files:['spin'],gain:.28,gap:.15},
 stop:{files:['stop-0','stop-1','stop-2'],gain:.58,gap:.025},
 step:{files:['step-0','step-1','step-2'],gain:.24,gap:.09},
 bite:{files:['bite-0','bite-1','bite-2'],gain:.85,gap:.06},
 vial:{files:['vial'],gain:.56,gap:.065},grow:{files:['grow'],gain:.32,gap:.15},
 land:{files:['land'],gain:.62,gap:.08},full:{files:['full'],gain:.85,gap:.1,duck:.7},
 infect:{files:['infect'],gain:.62,gap:.15,duck:.6},bonus:{files:['bonus'],gain:.8,gap:.5,duck:1.3},
 win:{files:['win'],gain:.6,gap:.25,duck:.4},'win-big':{files:['win-big'],gain:.7,gap:.5,duck:.9},
 finish:{files:['finish'],gain:.75,gap:.5,duck:1.2},
 'celebrate-nice':{files:['celebrate-nice'],gain:1.6,gap:.4,duck:14.92},
 'celebrate-big':{files:['celebrate-big'],gain:1.4,gap:.4,duck:14},
 'celebrate-epic':{files:['celebrate-epic'],gain:1.5,gap:.4,duck:14.63},
 'celebrate-max':{files:['celebrate-max'],gain:1.65,gap:.4,duck:15.1},
};
