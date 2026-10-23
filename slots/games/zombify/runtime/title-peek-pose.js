// Trace of the connected dark opening in the untouched 2043 × 770 title.
// This follows the painted inner rim rather than an estimated ellipse.
export const TITLE_SIGN={width:2043,height:770,opening:{x:574,y:398,bounds:{x:492,y:327,width:162,height:144},path:'M573 329.5 L596.5 332.5 L606.5 336.5 L615.5 340.5 L621.5 344.5 L626.5 348.5 L631.5 352.5 L634.5 356.5 L638.5 360.5 L640.5 364.5 L643.5 368.5 L645.5 372.5 L646.5 376.5 L647.5 380.5 L649.5 384.5 L649.5 388.5 L650.5 392.5 L650.5 396.5 L650.5 400.5 L650.5 404.5 L649.5 408.5 L649.5 412.5 L648.5 416.5 L647.5 420.5 L645.5 424.5 L643.5 428.5 L640.5 432.5 L638.5 436.5 L635.5 440.5 L632.5 444.5 L628.5 448.5 L623.5 452.5 L617.5 456.5 L609.5 460.5 L599.5 464.5 L573 468.5 L545.5 464.5 L535.5 460.5 L528.5 456.5 L522.5 452.5 L517.5 448.5 L513.5 444.5 L509.5 440.5 L506.5 436.5 L503.5 432.5 L501.5 428.5 L499.5 424.5 L497.5 420.5 L496.5 416.5 L495.5 412.5 L494.5 408.5 L494.5 404.5 L494.5 400.5 L494.5 396.5 L494.5 392.5 L494.5 388.5 L495.5 384.5 L496.5 380.5 L498.5 376.5 L499.5 372.5 L501.5 368.5 L504.5 364.5 L506.5 360.5 L509.5 356.5 L514.5 352.5 L518.5 348.5 L522.5 344.5 L529.5 340.5 L537.5 336.5 L548.5 332.5 Z'}};
export const PEEK_DURATION=3200;
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function titlePeekPose(elapsed){
 const enter=smooth(elapsed/780),leave=smooth((elapsed-2350)/800);
 const visible=enter*(1-leave);
 return {y:202*(1-enter+leave)+Math.sin(elapsed/1900*Math.PI*2)*1.3*visible,
  angle:Math.sin(elapsed/1500*Math.PI)*.025*visible};
}
