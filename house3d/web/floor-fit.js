import {BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,Color,Vector3,Matrix4,Quaternion,CatmullRomCurve3} from 'three';

// The play pose has its own stockinged feet. The source atlas welds the shoes
// to the legs, so removing shoe triangles would also cut holes at the ankles.
const smooth=(a,b,y)=>{const t=Math.max(0,Math.min(1,(y-a)/(b-a)));return t*t*(3-2*t)};
const joint=(mesh,name)=>mesh.skeleton.bones.findIndex(b=>b.name.replace(/^mixamorig[:_]?/,'')===name);
export function floorLegGeometry(mesh){
 const pos=[],norm=[],joints=[],weights=[],colors=[],indices=[],sections=[];
 // Longitudinal sections: softer toe box, narrower arch, deeper heel pocket.
 const profile=[[.042,.002,.002,.127],[.042,.012,.009,.124],
  [.042,.019,.014,.118],[.043,.024,.016,.108],[.044,.025,.017,.096],
  [.045,.023,.017,.080],[.046,.020,.018,.065],[.049,.019,.021,.054],
  [.055,.021,.024,.045],[.062,.022,.025,.041],[.075,.020,.021,.041],
  [.090,.022,.022,.045],
  [.105,.025,.025,.050],[.117,.027,.027,.055],[.121,.028,.028,.056],
  [.124,.027,.027,.057],[.125,.025,.025,.057],[.15,.029,.029,.065],
  [.17,.032,.033,.073],[.19,.036,.038,.082],[.208,.037,.039,.086],
  [.23,.040,.041,.083],[.26,.043,.044,.080],[.30,.044,.045,.077],[.336,.044,.045,.073]];
 const rings=profile.flatMap((r,j)=>j===profile.length-1?[r]:[r,r.map((x,k)=>(x+profile[j+1][k])/2)]);
 const sectors=32,skinLo=new Color('#d49a87'),skinHi=new Color('#ffe8d9'),sockLo=new Color('#a29ba9'),sockHi=new Color('#fff9ef'),col=new Color();
 for(const [side,s] of [['Left',1],['Right',-1]]){
  const bones=['UpLeg','Leg','Foot'].map(n=>joint(mesh,side+n));if(bones.includes(-1))throw Error('地面坐姿缺少腿部骨骼');
  const base=pos.length/3;sections.push({base,sectors,rings,side:s});
  for(let j=0;j<rings.length;j++){
   const [y,rx,rz,cz]=rings[j],prev=rings[Math.max(0,j-1)],next=rings[Math.min(rings.length-1,j+1)];
   const dy=next[0]-prev[0],dz=next[3]-prev[3],len=Math.hypot(dy,dz);
   const thigh=smooth(.181,.235,y),shin=(1-thigh)*smooth(.065,.099,y);
   for(let k=0;k<sectors;k++){
    const angle=k*2*Math.PI/sectors,x=Math.cos(angle),z=Math.sin(angle),ny=-z*dz/len,nz=z*dy/len;
    pos.push(s*(.036-.005*smooth(.080,.125,cz)-.01*Math.exp(-((y-.20)**2)/.002))+rx*x,y+rz*ny,cz+rz*nz);
    norm.push(x,ny,nz);joints.push(...bones,0);weights.push(thigh,shin,1-thigh-shin,0);
    const sock=y<.125,shade=.55+.17*ny+.18*nz+.09*s*x;
    col.copy(sock?sockLo:skinLo).lerp(sock?sockHi:skinHi,shade);
    if(sock&&y>.10)col.multiplyScalar(.96+.035*Math.cos(angle*16));
    colors.push(col.r,col.g,col.b);
   }
  }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<sectors;i++){
   const a=base+j*sectors+i,b=base+j*sectors+(i+1)%sectors;indices.push(a,a+sectors,b,b,a+sectors,b+sectors);
  }
  for(let i=1;i<sectors-1;i++)indices.push(base,base+i,base+i+1);

 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('normal',new Float32BufferAttribute(norm,3));g.setAttribute('skinIndex',new Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.userData.sections=sections;return g;
}

// Linear skinning collapses the inside of a bent knee. Fit the play-only rings
// around their posed centreline, then map them back through the same skin matrix.
export function roundPosedKnees(mesh){
 const g=mesh.geometry,p=g.attributes.position,joint=g.attributes.skinIndex,weight=g.attributes.skinWeight;
 const v=new Vector3(),axis=new Vector3(),front=new Vector3(),single=new Matrix4(),turn=new Quaternion();
 const light=new Vector3(-.32,.88,.34).normalize(),darkSock=new Color('#aaa3b1'),cream=new Color('#fff8ed'),skinShadow=new Color('#cb9383'),skinLight=new Color('#ffe7d8'),tint=new Color();
 for(const {base,sectors,rings,side} of g.userData.sections){
  const frames=rings.map((_,i)=>{
   const first=base+i*sectors,center=new Vector3(),m=new Matrix4();m.elements.fill(0);
   for(let k=0;k<4;k++){
    const id=joint.getComponent(first,k),w=weight.getComponent(first,k);if(!w)continue;
    single.multiplyMatrices(mesh.skeleton.bones[id].matrixWorld,mesh.skeleton.boneInverses[id]);for(let n=0;n<16;n++)m.elements[n]+=w*single.elements[n];
   }
   m.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix).premultiply(mesh.matrixWorld);
   for(let k=0;k<sectors;k++)center.add(v.fromBufferAttribute(p,first+k).applyMatrix4(m));
   center.divideScalar(sectors);return {center,x:v.fromBufferAttribute(p,first).applyMatrix4(m).sub(center).clone(),inverse:m.invert()};
  });
  // Rebuild each cross-section around the bend; transport its frame so the
  // sock and the inside knee cannot twist into a pinched hourglass.
  const centers=frames.map((f,i)=>!i||i===frames.length-1?f.center:f.center.clone().multiplyScalar(.5).addScaledVector(frames[i-1].center,.25).addScaledVector(frames[i+1].center,.25));
  // A relaxed sock follows the pointed foot, not the right-angle hinge
  // of the standing shoe rig. Ease its centreline into the folded shin.
  const ankle=rings.findIndex(r=>r[0]>=.075),cuff=rings.findIndex(r=>r[0]>=.117);
  const toe=centers[0],heel=centers[ankle],cuffPoint=centers[cuff];
  const toeRun=rings.slice(0,ankle+1).map(([y,,,z])=>Math.hypot(y-rings[0][0],z-rings[0][3]));
  const control=heel.clone().addScaledVector(toe,-(.32**2)).addScaledVector(cuffPoint,-(.68**2)).multiplyScalar(1/(2*.68*.32));
  for(let i=1;i<cuff;i++){
   const t=i<=ankle?.68*toeRun[i]/toeRun[ankle]:.68+.32*(rings[i][0]-.075)/(rings[cuff][0]-.075);
   centers[i]=toe.clone().multiplyScalar((1-t)**2).addScaledVector(control,2*t*(1-t)).addScaledVector(cuffPoint,t*t);
  }
  const path=new CatmullRomCurve3(centers);
  let previousTangent=path.getTangent(0);
  axis.crossVectors(previousTangent,new Vector3(0,1,0)).normalize();
  if(axis.dot(frames[0].x)<0)axis.negate();
  const scale=mesh.getWorldScale(new Vector3());
  for(let i=0;i<rings.length;i++){
   const {inverse}=frames[i],tangent=path.getTangent(i/(rings.length-1));
   axis.applyQuaternion(turn.setFromUnitVectors(previousTangent,tangent));
   axis.addScaledVector(tangent,-axis.dot(tangent)).normalize();front.crossVectors(axis,tangent);previousTangent=tangent;
   const rx=rings[i][1]*scale.x,rz=rings[i][2]*scale.z;
   for(let k=0;k<sectors;k++){
    const id=base+i*sectors+k,angle=2*Math.PI*k/sectors;
    v.copy(centers[i]).addScaledVector(axis,rx*Math.cos(angle)).addScaledVector(front,rz*Math.sin(angle)).applyMatrix4(inverse);
    p.setXYZ(id,v.x,v.y,v.z);
   }
  }
  const surface=rings.map((_,i)=>Array.from({length:sectors},(_,k)=>mesh.localToWorld(mesh.getVertexPosition(base+i*sectors+k,new Vector3()))));
  const around=new Vector3(),along=new Vector3();
  for(let i=0;i<rings.length;i++)for(let k=0;k<sectors;k++){
   around.subVectors(surface[i][(k+1)%sectors],surface[i][(k+sectors-1)%sectors]);
   along.subVectors(surface[Math.min(i+1,rings.length-1)][k],surface[Math.max(i-1,0)][k]);
   const normal=along.cross(around).normalize(),y=rings[i][0],sock=y<.125;
   const luminance=.46+.48*normal.dot(light);
   tint.copy(sock?darkSock:skinShadow).lerp(sock?cream:skinLight,luminance);
   if(sock){if(side<0)tint.multiplyScalar(.84);if(y>.108)tint.multiplyScalar(.96+.035*Math.cos(k*2*Math.PI/sectors*16));if(y>=.116&&y<.119)tint.multiplyScalar(.87)}
   g.attributes.color.setXYZ(base+i*sectors+k,tint.r,tint.g,tint.b);
  }
 }
 p.needsUpdate=true;g.attributes.color.needsUpdate=true;
}

// Keep adjoining bodice and underarm patch vertices on the same torso field.
// Below the waist leave the authored seated skirt corrective and weights alone.
export function floorBodiceGeometry(mesh){
 const g=mesh.geometry.clone(),{position,skinIndex,skinWeight}=g.attributes,hips=joint(mesh,'Hips'),spine=joint(mesh,'Spine2');
 for(let i=0;i<position.count;i++){const y=position.getY(i);if(y<.345)continue;
  const t=smooth(.37,.50,y);skinIndex.setXYZW(i,hips,spine,0,0);skinWeight.setXYZW(i,1-t,t,0,0);
 }
 return g;
}
