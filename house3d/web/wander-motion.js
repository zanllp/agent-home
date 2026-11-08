import {Quaternion,Vector3} from 'three';

// Offsets are always removed before the mixer runs, including cached idle frames.
export function createSecondaryMotion(model){
 const entries=new Map(),root=model.getWorldQuaternion(new Quaternion()).invert();
 model.traverse(b=>{if(!b.isBone)return;const name=b.name.replace(/^mixamorig[:_]?/,'');
  const basis=root.clone().multiply(b.getWorldQuaternion(new Quaternion()));
  entries.set(name,{bone:b,base:b.quaternion.clone(),axes:[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)].map(v=>v.applyQuaternion(basis.clone().invert()))});
 });
 const q=new Quaternion();let applied=false;
 function tilt(name,x,y,z){const e=entries.get(name);if(!e)return;
  for(const [i,a] of [x,y,z].entries())if(a)e.bone.quaternion.multiply(q.setFromAxisAngle(e.axes[i],a));
 }
 return {
  restore(){if(!applied)return;for(const e of entries.values())e.bone.quaternion.copy(e.base);applied=false},
  apply({phase,time,weight,turn=0,runBlend=0}){
   for(const e of entries.values())e.base.copy(e.bone.quaternion);
   const w=Math.max(0,Math.min(1,weight)),p=phase*Math.PI*2,breath=Math.sin(time*1.7),sway=Math.sin(p);
   const jog=w*Math.min(1,Math.max(0,runBlend));
   tilt('Spine',.027*jog,0,.014*sway*w+.019*sway*jog+.002*breath*(1-w));
   tilt('Spine1',.008*Math.sin(p*2-.2)*w+.003*breath,0,0);
   tilt('Head',.006*Math.sin(p*2-.4)*w,(1-w)*.04*Math.sin(time*.9),-.012*sway*w+.004*Math.sin(time*.8)*(1-w));
   for(const [side,sign] of [['Left',1],['Right',-1]]){
    tilt(side+'Arm',sign*(.045*w+.085*jog)*Math.sin(p-.45),0,sign*.004*breath*(1-w));
    tilt(side+'ForeArm',sign*(.012*w+.035*jog)*Math.sin(p-.8),0,0);
   }
   applied=true;
   tilt('WhaleTail',0,(.06*w+.065*jog)*Math.sin(p-.6)+.014*Math.sin(time*1.2)*(1-w)-Math.max(-.025,Math.min(.025,turn*.012)),0);
  },
 };
}
