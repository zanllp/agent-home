// The bed's own painted quilt has three shapes: made, turned down and occupied.
// Shapes are prepared once per cached model. Each placed bed owns only its weights.
import { Float32BufferAttribute, Mesh, MeshStandardMaterial, MeshBasicMaterial, DataTexture, RepeatWrapping, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter, PlaneGeometry } from 'three';
import {finishBedLinen} from './bed-linen.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t = clamp(v); return t*t*(3-2*t) };

function cottonTicking() {
  const n=128, data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const line=x<2||x===5, thread=((x^y)&1)*3-1;
    const rgb=line?[170,191,203]:[241,232,216];
    data.set([...rgb.map(v=>v+thread),255],4*(y*n+x));
  }
  const t=new DataTexture(data,n,n);t.colorSpace=SRGBColorSpace;
  t.wrapS=t.wrapT=RepeatWrapping;t.repeat.set(15,16);t.magFilter=LinearFilter;
  t.minFilter=LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}

// Soft contact on the sheet, strongest beneath the torso and two heels.
// Local to this sleeper; it fades with the sleep pose, not the cover switch.
function sheetContact() {
  const w=80,h=128,data=new Uint8Array(w*h*4);
  function lobe(x,z,cx,cz,rx,rz){return Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2))}
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const x=(i/(w-1)-.5)*1.04,z=(.5-j/(h-1))*1.43;
    const shade=.39*lobe(x,z,0,-.08,.22,.36)+.24*lobe(x,z,0,-.46,.25,.16)
      +.35*(lobe(x,z,-.084,.37,.061,.095)+lobe(x,z,.084,.37,.061,.095));
    data.set([98,75,82,Math.round(255*shade)],(j*w+i)*4);
  }
  const map=new DataTexture(data,w,h);map.magFilter=map.minFilter=LinearFilter;map.colorSpace=SRGBColorSpace;map.needsUpdate=true;
  const shadow=new Mesh(new PlaneGeometry(1.04,1.43),new MeshBasicMaterial({map,transparent:true,depthWrite:false}));
  shadow.name='Bedding-contact';shadow.rotation.x=-Math.PI/2;return shadow;
}

export function prepareBedding(root, asset) {
  const child = asset.model.endsWith('/whale-bed-v1.glb');
  const quilt = root.getObjectByName(child ? 'Sleep-quilt' : 'Channel-quilt');
  if (!quilt) return;
  if (!child) finishBedLinen(quilt);
  if (child) {
    // The generated asset has no mattress sides underneath the draped portion.
    const sheet = new Mesh(new RoundedBoxGeometry(1.40,.18,1.55,4,.047),
      new MeshStandardMaterial({color:'#fffaf0',map:cottonTicking(),roughness:.96}));
    sheet.name='Fitted-sheet'; sheet.position.set(0,.351,.006);
    sheet.receiveShadow=sheet.castShadow=true;
    root.add(sheet);
    const rail=new Mesh(new RoundedBoxGeometry(1.40,.17,1.53,3,.019),
      new MeshStandardMaterial({color:'#a57554',roughness:.69}));
    rail.position.set(0,.177,.006); root.add(rail);
  }
  const geometry=quilt.geometry, p=geometry.attributes.position, folded=[], occupied=[], side=[], sleepwear=[];
  const start=child?-.439:-.41, end=child?.78:1.05;
  const [cx,rootY,rootZ]=asset.interactions.sleep.root;
  const contact=sheetContact();contact.position.set(cx,(child?.441:.48)+.001,rootZ-.45);
  contact.visible=false;root.add(contact);
  for (let i=0;i<p.count;i++) {
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i), v=clamp((z-start)/(end-start));
    const sheetY=child?.441:.48;
    const hemDrop=Math.max(0,(child?.485:.55)-y);
    folded.push(x*.94,sheetY+.028+.035*v+.028*Math.sin(v*Math.PI*3)**2-.32*hemDrop,
      end-.21+.20*v+.036*Math.sin(2*Math.PI*v));
    // Ease the top binding down to the collar; keep the hanging edges on the bed.
    const newZ=z+(.185*(1-v)**2), d=newZ-rootZ;
    const reach=(.32+.038*Math.sin(12*d))*(1-.27*smooth((d+.36)/.25));
    const loft=(.251+.018*Math.cos(d*13) - .085*smooth((d+.32)/.20))
      * (1-smooth((d-.01)/.23));
    const under= (rootY+loft+.048-sheetY)*Math.exp(-Math.pow((x-cx)/reach,4));
    const relief=(y-(child?.51:.56))*(child?.40:.60);
    const flat=sheetY+.029+relief-.60*hemDrop;
    occupied.push(x,flat+under,newZ);
    const sideLoft=(rootY+loft+.105-sheetY)*Math.exp(-Math.pow((x-cx+.035)/(reach*.88),4));
    side.push(x,flat+sideLoft,newZ);
    // Add clearance for the pajama collar, gathered shoulders and trouser cuffs.
    // Absolute morph: its delta is added to the existing back/side shape.
    const allowance=(.044*(1-smooth((d+.55)/.28))+.019*Math.exp(-(((d+.16)/.15)**2)))*Math.exp(-Math.pow((x-cx)/.35,4));
    sleepwear.push(x,y+allowance,z);
  }
  geometry.morphAttributes.position=[folded,occupied,side,sleepwear].map(a=>new Float32BufferAttribute(a,3));
  geometry.morphAttributes.normal=geometry.morphAttributes.position.map(position=>{
    const copy=geometry.clone(); copy.morphAttributes={}; copy.setAttribute('position',position);
    copy.computeVertexNormals();const n=copy.attributes.normal;copy.dispose();return n;
  });
  quilt.updateMorphTargets();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

export function poseBedding(quilt, sleep, covered, away, side=0, pajamas=false) {
  quilt.visible=!away;
  const influences=quilt.morphTargetInfluences;
  const turn=smooth(sleep/.46);
  const tuck=covered?smooth((sleep-.64)/.36):0;
  influences[0]=turn*(1-tuck); influences[1]=tuck*(1-side); influences[2]=tuck*side; influences[3]=pajamas&&!away?tuck:0;
}
