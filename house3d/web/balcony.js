import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {balconyGeometry,balconyLocal} from '../shared/space.mjs';
export function createBalcony(room,view,door){
 const b=balconyGeometry(room);if(!b)return null;
 const root=new T.Group();root.name='Walkable-balcony';root.position.set(b.origin.x,0,b.origin.z);root.rotation.y=b.wall==='left'?Math.PI/2:0;
 const stone=new T.MeshStandardMaterial({color:'#e5dece',roughness:.88}),grout=new T.MeshStandardMaterial({color:'#bfb8a9',roughness:1}),frame=new T.MeshStandardMaterial({color:'#647371',roughness:.4,metalness:.35}),glass=new T.MeshPhysicalMaterial({color:'#e5efec',transparent:true,opacity:.08,roughness:.12,depthWrite:false,side:T.DoubleSide});
 function box(name,w,h,d,x,y,v,m){const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.012,w/4,h/4,d/4)),m);mesh.name=name;mesh.position.set(x,y,-v);mesh.castShadow=m!==glass;mesh.receiveShadow=true;root.add(mesh);return mesh}
 box('Balcony-floor',b.width,.10,b.depth,0,-.045,b.depth/2,stone);
 for(let x=-b.width/2+.45;x<b.width/2;x+=.45)box('Balcony-tile-grout',.004,.002,b.depth-.02,x,.006,b.depth/2,grout);
 for(let v=.45;v<b.depth;v+=.45)box('Balcony-tile-grout',b.width-.02,.002,.004,0,.006,v,grout);
 for(const sign of [-1,1]){const start=root.children.length,x=sign*b.width/2;box('Balcony-side-sill',.07,.13,b.depth,x,.065,b.depth/2,stone);box('Balcony-side-rail',.035,.035,b.depth,x,1.07,b.depth/2,frame);box('Balcony-side-glass',.01,.88,b.depth-.05,x,.59,b.depth/2,glass);for(const v of [0,b.depth])box('Balcony-safety-post',.04,1.1,.04,x,.55,v,frame);for(const mesh of root.children.slice(start))mesh.userData.cutawayEdge=sign<0?'left':'right'}
 const n=Math.max(3,Math.ceil(b.width/.95));
 const outerStart=root.children.length;
 for(let i=0;i<=n;i++)box('Balcony-front-post',.035,1.1,.04,-b.width/2+b.width*i/n,.55,b.depth,frame);
 for(const y of [.10,1.07])box('Balcony-front-rail',b.width,.035,.045,0,y,b.depth,frame);
 const pane=box('Balcony-front-glass',b.width-.03,.88,.008,0,.60,b.depth+.005,glass);pane.castShadow=false;for(const mesh of root.children.slice(outerStart))mesh.userData.cutawayEdge='outer';
 if(view){
  const geometry=view.geometry.clone();geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new T.Vector3()),center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-center.z);geometry.scale((b.width+4)*2/size.x,8/size.y,1);
  const mat=new T.MeshBasicMaterial({map:view.material.map,toneMapped:false,side:T.DoubleSide,stencilWrite:true,stencilRef:200,stencilFunc:T.EqualStencilFunc,stencilFail:T.KeepStencilOp,stencilZFail:T.KeepStencilOp,stencilZPass:T.KeepStencilOp});
  const city=new T.Mesh(geometry,mat);city.name='Distant-city-only';city.position.set(0,1.8,-b.depth-2);city.renderOrder=12;root.add(city);
  const mask=new T.Mesh(new T.PlaneGeometry(b.width,2.4),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide,stencilWrite:true,stencilRef:200,stencilFunc:T.AlwaysStencilFunc,stencilFail:T.KeepStencilOp,stencilZFail:T.KeepStencilOp,stencilZPass:T.ReplaceStencilOp}));mask.name='Balcony-city-aperture';mask.position.set(0,1.2,-b.depth-.01);mask.renderOrder=10;root.add(mask);
  const inner=mask.clone();inner.geometry=new T.PlaneGeometry(2.42,2.17);inner.name='Balcony-door-aperture';const q=door?balconyLocal(room,door):{u:0,v:-.14};inner.position.set(q.u,1.11,-q.v-.035);root.add(inner);
  root.userData.updateView=position=>{const q=balconyLocal(room,position),outside=q.v>0;city.visible=q.v<b.depth-.03;mask.visible=outside;inner.visible=!outside;for(const mesh of root.children){const edge=mesh.userData.cutawayEdge;if(edge)mesh.visible=!(edge==='left'&&q.u< -b.width/2+.03||edge==='right'&&q.u>b.width/2-.03||edge==='outer'&&q.v>b.depth-.03)}};
 }
 return root;
}
export function disposeBalcony(root){if(!root)return;const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}
