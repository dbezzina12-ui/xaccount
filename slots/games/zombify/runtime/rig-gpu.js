import {pose,slotAlpha,slotAttachment,drawRig} from './approved-rig-renderer.js';
import {attachmentGeometry} from './rig-geometry.js';

// A single shared GPU surface avoids one WebGL context per reel/portrait.
// Canvas2D remains a fallback for browsers without WebGL.
let shared;
function createGPU(){
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
 if(!gl)return null;
 const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();
 gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 aPosition; attribute vec2 aUV; uniform vec4 uFit; uniform vec2 uSize; varying vec2 vUV; void main(){vec2 q=vec2(aPosition.x,-aPosition.y)*uFit.z;float c=cos(uFit.w),s=sin(uFit.w);vec2 p=vec2(q.x*c-q.y*s,q.x*s+q.y*c)+uFit.xy;gl_Position=vec4(p.x/uSize.x*2.0-1.0,1.0-p.y/uSize.y*2.0,0.0,1.0);vUV=aUV;}'));
 gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 vUV; uniform sampler2D uTexture; uniform float uAlpha; void main(){gl_FragColor=texture2D(uTexture,vUV)*uAlpha;}'));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const pos=gl.getAttribLocation(program,'aPosition'),uv=gl.getAttribLocation(program,'aUV'),fit=gl.getUniformLocation(program,'uFit'),size=gl.getUniformLocation(program,'uSize'),alpha=gl.getUniformLocation(program,'uAlpha');
 const vertices=gl.createBuffer(),indices=gl.createBuffer(),textures=new WeakMap();
 function texture(image){
  if(textures.has(image))return textures.get(image);
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  textures.set(image,t);return t;
 }
 return {draw(ctx,rig,clip,time,s,x,y,w,h,dpr,rotation){
  if(gl.isContextLost())return false;
  const pw=Math.max(1,Math.round(w*dpr)),ph=Math.max(1,Math.round(h*dpr));
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
  gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.enable(gl.BLEND);
  gl.uniform4f(fit,x,y,s,rotation);gl.uniform2f(size,w,h);gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);
  gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);
  const data=rig.data,world=pose(data,clip,time),skin=data.skins[0].attachments;
  for(const slot of data.slots){
   const name=slotAttachment(data,clip,slot,time),art=skin[slot.name]?.[name];if(!art)continue;
   const img=rig.images[art.path||name];if(!img)continue;
   const g=attachmentGeometry(art,world,data.bones,slot.bone),packed=new Float32Array(g.xy.length*2);
   for(let i=0;i<g.xy.length/2;i++){packed[i*4]=g.xy[i*2];packed[i*4+1]=g.xy[i*2+1];packed[i*4+2]=g.uv[i*2];packed[i*4+3]=g.uv[i*2+1];}
   gl.bufferData(gl.ARRAY_BUFFER,packed,gl.DYNAMIC_DRAW);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(g.indices),gl.DYNAMIC_DRAW);
   gl.bindTexture(gl.TEXTURE_2D,texture(img));gl.uniform1f(alpha,slotAlpha(data,clip,slot,time));gl.blendFunc(gl.ONE,slot.blend==='additive'?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);
   gl.drawElements(gl.TRIANGLES,g.indices.length,gl.UNSIGNED_SHORT,0);
  }
  ctx.drawImage(canvas,0,0,w,h);return true;
 }};
}
export function paintRig(ctx,rig,clip,time,{scale,x,y,rotation=0},width,height,dpr=1){
 if(shared===undefined){try{shared=createGPU();}catch{shared=null;}}
 let drawn=false;try{drawn=shared?.draw(ctx,rig,clip,time,scale,x,y,width,height,dpr,rotation);}catch{shared=null;}
 if(!drawn){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);drawRig(ctx,rig.data,rig.images,clip,time,scale);ctx.restore();}
}
