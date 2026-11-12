export const degrees=radians=>radians*180/Math.PI;
export const radians=degrees=>degrees*Math.PI/180;
export const normalizeAngle=value=>((value+180)%360+360)%360-180;
const blend=(from,to,mix)=>from+normalizeAngle(to-from)*mix;
const inParent=(bone,worldAngle)=>normalizeAngle(worldAngle-degrees(Math.atan2(bone.parent.appliedPose.c,bone.parent.appliedPose.a)));
export function clientToRig(point,rect,{canvas=[1024,1536],origin}){
 if(!(rect.width>0&&rect.height>0))throw Error('Character viewport is hidden.');
 return {x:(point.x-rect.left)*canvas[0]/rect.width-origin[0],y:origin[1]-(point.y-rect.top)*canvas[1]/rect.height};
}
export function solveArm({shoulder,target,upperLength,foreLength,bend=1,reach=.86}){
 const dx=target.x-shoulder.x,dy=target.y-shoulder.y,d=Math.hypot(dx,dy);
 const length=Math.max(Math.abs(upperLength-foreLength)+.001,Math.min(d,(upperLength+foreLength)*reach));
 const elbow=bend*Math.acos(Math.max(-1,Math.min(1,(length*length-upperLength*upperLength-foreLength*foreLength)/(2*upperLength*foreLength))));
 const upper=Math.atan2(dy,dx)-Math.atan2(foreLength*Math.sin(elbow),upperLength+foreLength*Math.cos(elbow));
 return {upper:degrees(upper),fore:degrees(upper+elbow),reach:length};
}
// Unit-scale skeleton. CSS scales the fixed 1024x1536 viewport.
export function applyAim(skeleton,target,manifest,physicsNone,{mix=1,recoil=0}={}){
 const upper=skeleton.findBone('shoot_upper'),fore=skeleton.findBone('shoot_forearm'),gun=skeleton.findBone('revolver');
 const up=upper.appliedPose,solved=solveArm({shoulder:{x:up.worldX,y:up.worldY},target,upperLength:manifest.arm.upperLength,foreLength:manifest.arm.foreLength,bend:manifest.facing});
 upper.pose.rotation=blend(upper.pose.rotation,inParent(upper,solved.upper),mix);
 skeleton.updateWorldTransform(physicsNone);
 fore.pose.rotation=blend(fore.pose.rotation,inParent(fore,solved.fore),mix);
 skeleton.updateWorldTransform(physicsNone);
 const hand=skeleton.findBone('shoot_hand'),wristDriven=manifest.aimDriver==='wrist';
 const gp=wristDriven?hand.appliedPose:gun.appliedPose,dx=target.x-gp.worldX,dy=target.y-gp.worldY,distance=Math.hypot(dx,dy);
 // Solve the bore ray with the muzzle's perpendicular offset from the grip.
 const wristOffset=wristDriven?-(manifest.wristToGripLocal?.[0]||0)*Math.sin(radians(gun.pose.rotation)):0;
 const sine=Math.max(-1,Math.min(1,(manifest.muzzleLocal[1]+wristOffset)/Math.max(1,distance)));
 const heading=degrees(Math.atan2(dy,dx)-Math.atan2(sine,manifest.facing*Math.sqrt(1-sine*sine)))+recoil;
 if(wristDriven)hand.pose.rotation=blend(hand.pose.rotation,inParent(hand,heading-gun.pose.rotation),mix);
 else gun.pose.rotation=blend(gun.pose.rotation,inParent(gun,heading),mix);
 skeleton.updateWorldTransform(physicsNone);
 return skeleton.findBone('muzzle').appliedPose;
}
