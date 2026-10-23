let renderer=null;
export function registerFSAnimator(adapter){if(adapter!==null&&typeof adapter.play!=='function')throw new TypeError('FS animator needs play(context).');renderer=adapter;return()=>{if(renderer===adapter)renderer=null;};}
export async function playFS(node,clip,{animate,shouldSkip=()=>false}={}){
 if(!node||shouldSkip())return;
 if(renderer)return renderer.play({node,clip,shouldSkip});
 const frames=clip==='trigger'?[{transform:'scale(1)'},{transform:'scale(.88)',offset:.18},{transform:'scale(1.18)',filter:'brightness(1.4)',offset:.45},{transform:'scale(1)',filter:'brightness(1)'}]:[{transform:'translateY(-12%) scale(.9,1.1)'},{transform:'translateY(0) scale(1.1,.88)',offset:.45},{transform:'scale(1)'}];
 await animate(node,frames,clip==='trigger'?850:380);
}
