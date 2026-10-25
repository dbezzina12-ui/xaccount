// Studio owns its layout. Standalone play needs the original viewport and entry flow.
// ?perf adds the on-device frame-time recorder (perf-probe.js).
if(new URLSearchParams(location.search).has('perf'))void import('./perf-probe.js');
if(window.frameElement?.id==='runtime'){
 await import('../../../studio/bridge.js');
}else{
 await Promise.all([import('./viewport.js'),import('./entry.js')]);
}
