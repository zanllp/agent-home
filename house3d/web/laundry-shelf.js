import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Clip-on riser: the usable shelf is exposed in the catalog; potted plants are not part of this model.
export function fitLaundryShelf(root,surface){
 const metal=new T.MeshStandardMaterial({color:'#e5e3d5',roughness:.45,metalness:.16});
 const rubber=new T.MeshStandardMaterial({color:'#797a6f',roughness:.91});
 const wood=new T.MeshStandardMaterial({color:'#ceae82',roughness:.54});
 const box=(name,w,h,d,x,y,z,m,r)=>{
  const o=new T.Mesh(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/2,h/2,d/2)),m);
  o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;
 };
 const top=surface.height,thick=.024,bottom=.834;
 for(const x of [-.264,.264])for(const z of [-.218,.171]){
  box('Shelf vibration pad',.042,.008,.043,x,bottom+.004,z,rubber,.003);
  box('Ivory square upright',.019,top-thick-bottom-.008,.019,x,(top-thick+bottom+.008)/2,z,metal,.003);
 }
 for(const x of [-.264,.264])box('Side apron',.019,.028,.401,x,top-thick-.015,-.024,metal,.003);
 box('Shelf rear brace',.546,.020,.018,0,top-.09,-.218,metal,.003);
 box('Wood-laundry-shelf',.602,thick,.52,0,top-thick/2,-.021,wood,.008);
}
