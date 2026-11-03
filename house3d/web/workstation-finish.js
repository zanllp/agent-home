import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Keep the desktop as a single placeable set. Angle the portrait panel towards the keyboard,
// and widen the landscape panel into the old gap without extending its left edge.
export function finishWorkstation(root){
 const kit=root.getObjectByName('Refined-monitor-kit');if(!kit)return;
 const original=[...kit.children],panels=original.filter(o=>/^Monitor-back/.test(o.name)).sort((a,b)=>a.position.x-b.position.x);
 if(panels.length!==2)return;
 for(const [i,back] of panels.entries()){
  const pivot=new T.Group(),cx=back.position.x,cy=back.position.y,cz=back.position.z;
  pivot.name=i?'Portrait display swivel':'Landscape display cradle';kit.add(pivot);
  for(const o of original)if(o.parent===kit&&/^(Monitor-back|Blue_screen|Monitor-lower-bezel|Monitor-power-indicator)/.test(o.name)&&((o.position.x<.15)===(i===0))){
   o.position.x-=cx;o.position.y-=cy;o.position.z-=cz;pivot.add(o);
  }
  pivot.position.set(i?.335:-.134,cy,cz);
  if(i)pivot.rotation.y=-.27;else pivot.scale.set(1.135,1.10,1);
 }
 original.filter(o=>/^Monitor-(VESA-arm|stand-post|clamp|cable)/.test(o.name)).forEach(o=>{o.visible=false});
 const groups=new Map(),m=(name,color,roughness=.5,metalness=0)=>new T.MeshStandardMaterial({name,color,roughness,metalness,side:T.DoubleSide});
 const metal=m('Graphite hardware','#454d4e',.38,.31),alloy=m('Satin collars','#9a9b90',.41,.40),rubber=m('Braided cable','#363e40',.89),wood=m('Maple speaker shells','#b8956e',.71),cone=m('Woven speaker cones','#4d5354',.94);
 function add(geometry,material){if(!groups.has(material))groups.set(material,[]);groups.get(material).push(geometry)}
 function box(w,h,d,x,y,z,r,mat){add(new RoundedBoxGeometry(w,h,d,1,r).translate(x,y,z),mat)}
 function bar(a,b,r,mat,r2=r){
  const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p),c=p.lerp(q,.5);
  add(new T.CylinderGeometry(r2,r,v.length(),16).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize())).translate(...c.toArray()),mat);
 }
 function cable(path){add(new T.TubeGeometry(new T.CatmullRomCurve3(path.map(p=>new T.Vector3(...p))),18,.0027,6,false),rubber)}
 box(.208,.012,.123,-.134,.008,-.054,.005,metal);
 bar([-.134,.013,-.084],[-.134,.246,-.122],.014,metal,.011);
 bar([-.134,.238,-.122],[-.134,.389,-.109],.009,alloy);box(.067,.064,.014,-.134,.388,-.104,.003,metal);
 box(.079,.026,.055,.186,.015,-.151,.004,metal);
 bar([.186,.027,-.15],[.186,.351,-.15],.015,metal);
 bar([.186,.248,-.15],[.266,.325,-.155],.013,metal);
 bar([.266,.325,-.155],[.332,.428,-.113],.011,metal);
 for(const [x,y,z] of [[.186,.248,-.15],[.266,.325,-.155],[.332,.428,-.113]])bar([x,y,z-.012],[x,y,z+.012],.018,alloy);
 cable([[.335,.393,-.105],[.268,.31,-.168],[.176,.232,-.169],[.179,.037,-.165],[.160,.011,-.162]]);
 cable([[-.106,.346,-.104],[-.121,.174,-.137],[-.128,.028,-.130],[-.184,.008,-.151]]);
 for(const x of [-.387,.407]){
  box(.079,.127,.076,x,.065,-.083,.005,wood);box(.070,.115,.004,x,.065,-.044,.002,metal);
  for(const [y,r] of [[.048,.026],[.098,.013]]){
   bar([x,y,-.043],[x,y,-.039],r,alloy);bar([x,y,-.039],[x,y,-.037],r*.85,cone,r*.72);bar([x,y,-.037],[x,y,-.036],r*.33,rubber);
  }
 }
 for(const [material,parts] of groups){
  const flat=parts.map(g=>g.index?g.toNonIndexed():g),joined=mergeGeometries(flat);
  const o=new T.Mesh(joined,material);o.name='Workstation-'+material.name;o.castShadow=o.receiveShadow=true;kit.add(o);
  new Set([...parts,...flat]).forEach(g=>g.dispose());
 }
}
