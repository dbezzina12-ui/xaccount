// One shared GPU surface for all native meshes. Rasterizing a complete mesh
// avoids Canvas triangle clipping seams along the characters' dark coats.
let painter,unavailable=false;
export function paintGPU(ctx,rig,view,exclude){
 if(unavailable||typeof document==='undefined')return false;
 try{if(!painter)painter=createPainter();if(!painter)return false;return painter(ctx,rig,view,exclude);}catch(e){unavailable=true;console.warn('Using Canvas animation fallback',e);return false;}
}
function createPainter(){
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
 if(!gl){unavailable=true;return null;}
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();unavailable=true;});
 canvas.addEventListener('webglcontextrestored',()=>{painter=null;unavailable=false;});
 const shader=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p;attribute vec2 uv;uniform vec2 size;varying vec2 v;void main(){vec2 q=p/size*2.0-1.0;gl_Position=vec4(q.x,-q.y,0.0,1.0);v=uv;}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D tex;uniform float alpha;varying vec2 v;void main(){vec4 c=texture2D(tex,v);float a=c.a*alpha;gl_FragColor=vec4(c.rgb*a,a);}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const pos=gl.getAttribLocation(program,'p'),uv=gl.getAttribLocation(program,'uv'),size=gl.getUniformLocation(program,'size'),alpha=gl.getUniformLocation(program,'alpha');
 const vertices=gl.createBuffer(),indices=gl.createBuffer(),textures=new WeakMap();
 return (ctx,rig,view,exclude)=>{
  if(gl.isContextLost())return false;
  const ratio=ctx.getTransform().a,width=ctx.canvas.width,height=ctx.canvas.height;
  if(canvas.width<width||canvas.height<height){canvas.width=Math.max(canvas.width,width);canvas.height=Math.max(canvas.height,height);}
  gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.uniform2f(size,width/ratio,height/ratio);gl.uniform1i(gl.getUniformLocation(program,'tex'),0);
  gl.enable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);gl.activeTexture(gl.TEXTURE0);
  for(const slot of rig.skeleton.drawOrder.appliedPose){
   if(exclude.has(slot.data.name))continue;
   const pose=slot.appliedPose,mesh=pose.getAttachment(),a=pose.color.a*(mesh?.color.a??1);if(!mesh?.triangles||a<.001)continue;
   const si=mesh.sequence.resolveIndex(pose),coords=mesh.sequence.getUVs(si),image=rig.textures.get(mesh.sequence.regions[si].page.name);if(!image)continue;
   let texture=textures.get(image);if(!texture){texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);textures.set(image,texture);}else gl.bindTexture(gl.TEXTURE_2D,texture);
   const world=new Float32Array(mesh.worldVerticesLength);mesh.computeWorldVertices(rig.skeleton,slot,0,mesh.worldVerticesLength,world,0,2);const data=new Float32Array(world.length*2);
   for(let i=0,j=0;i<world.length;i+=2,j+=4){data[j]=view.x+world[i]*view.scale;data[j+1]=view.y-world[i+1]*view.scale;data[j+2]=coords[i];data[j+3]=coords[i+1];}
   gl.uniform1f(alpha,a);gl.blendFunc(gl.ONE,slot.data.blendMode===1?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STREAM_DRAW);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(mesh.triangles),gl.STREAM_DRAW);gl.drawElements(gl.TRIANGLES,mesh.triangles.length,gl.UNSIGNED_SHORT,0);
  }
  ctx.drawImage(canvas,0,canvas.height-height,width,height,0,0,width/ratio,height/ratio);return true;
 };
}
