// Presentation-only particles. Absolute time keeps Quick/Turbo and frame stalls
// from extending an effect or accumulating simulation error.
export function createFXModel({limit=128,random=Math.random}={}) {
  let nextId=0;
  const particles=[],frame=[];
  function add(p) {
    if(particles.length>=limit)particles.shift();
    particles.push({...p,id:nextId++,view:{}});
  }
  function burst({x,y,scale=60,count=14,color=0xc4f657,angle=-Math.PI/2,spread=Math.PI*2,power=1,tag='impact',now=0}) {
    for(let i=0;i<count;i++) {
      const direction=angle+(random()-.5)*spread,speed=scale*(.55+random()*1.25)*power;
      add({tag,shape:i%3?'chip':'dot',x,y,vx:Math.cos(direction)*speed,vy:Math.sin(direction)*speed,
        gravity:scale*2,size:scale*(.025+random()*.035),color:i%5===0?0xfff8c9:color,
        rotation:random()*Math.PI,spin:(random()-.5)*9,born:now,life:360+random()*260});
    }
  }
  function ring({x,y,scale=60,color=0xc4f657,tag='impact',now=0}) {
    add({tag,shape:'ring',x,y,vx:0,vy:0,gravity:0,size:scale*.35,color,rotation:0,spin:0,born:now,life:360});
  }
  function trace({points,scale=60,now=0,duration=530}) {
    if(points.length<2)return;
    const segments=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
    const length=segments.reduce((a,b)=>a+b,0);if(!length)return;
    for(let i=0;i<5;i++)add({tag:'line',shape:'dot',points,segments,length,delay:i*19,size:scale*(i===0?.15:.06),color:i===0?0xfff7d3:0xf5cc70,born:now,life:duration+i*19});
  }
  function pathPoint(p,progress) {
    let distance=p.length*Math.max(0,Math.min(1,progress));
    for(let i=0;i<p.segments.length;i++) {
      const length=p.segments[i];
      if(distance<=length||i===p.segments.length-1) {
        const t=length?distance/length:0,a=p.points[i],b=p.points[i+1];
        return [a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t];
      }
      distance-=length;
    }
  }
  function update(now) {
    frame.length=0;
    for(let i=particles.length-1;i>=0;i--)if(now-particles[i].born>=particles[i].life)particles.splice(i,1);
    for(const p of particles) {
      const elapsed=Math.max(0,now-p.born),t=elapsed/1000,progress=elapsed/p.life,v=p.view;
      Object.assign(v,{id:p.id,shape:p.shape,color:p.color,rotation:(p.rotation||0)+(p.spin||0)*t});
      if(p.points) {
        if(elapsed<p.delay)continue;
        [v.x,v.y]=pathPoint(p,(elapsed-p.delay)/(p.life-p.delay));
        v.size=p.size;v.alpha=Math.min(1,(1-progress)*7);
      } else {
        v.x=p.x+p.vx*t;v.y=p.y+p.vy*t+p.gravity*t*t/2;
        v.size=p.shape==='ring'?p.size*(1+progress*2.2):p.size*(1-progress*.65);
        v.alpha=(1-progress)**(p.shape==='ring'?1.7:1.2)*(p.shape==='ring'?.65:1);
      }
      frame.push(v);
    }
    return frame;
  }
  function clear(tag) {
    for(let i=particles.length-1;i>=0;i--)if(!tag||particles[i].tag===tag)particles.splice(i,1);
    frame.length=0;
  }
  return {burst,ring,trace,update,clear,get count(){return particles.length;}};
}
