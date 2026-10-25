// Studio owns its layout. Standalone play needs the original viewport and entry flow.
if(window.frameElement?.id==='runtime'){
 await import('../../../studio/bridge.js');
 if(new URLSearchParams(location.search).get('entry')==='full')await import('./entry.js');
}else{
 await Promise.all([import('./viewport.js'),import('./entry.js')]);
}
