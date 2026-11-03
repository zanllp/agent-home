import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const mat=(name,color,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({name,color,roughness,metalness,side:T.DoubleSide});
function part(parent,name,geo,m,x=0,y=0,z=0){const o=new T.Mesh(geo,m);o.name=name;o.position.set(x,y,z);parent.add(o);return o}
function box(g,name,w,h,d,x,y,z,m,r){return part(g,name,new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/2,h/2,d/2)),m,x,y,z)}
function bar(g,name,a,b,r,m){const p=new T.Vector3(...a),q=new T.Vector3(...b),length=p.distanceTo(q),o=part(g,name,new T.CylinderGeometry(r,r,length,10),m);o.position.copy(p).lerp(q,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize());return o}

export function enamelWasher(g){
 const enamel=mat('Warm porcelain enamel','#f5f1e7',.36,.08),edge=mat('Ivory edge','#e4dfd4',.5),steel=mat('Satin aluminium','#a3a49c',.34,.45),gasket=mat('Rubber gasket','#565c59',.88),dial=mat('Control glass','#475452',.25),drum=mat('Dim stainless drum','#88948e',.37,.50);
 box(g,'Damped feet',.54,.041,.49,0,.021,-.018,gasket,.014);
 // The drum is recessed behind an actual cutout, not a tinted disk on top of a solid box.
 for(const side of [-1,1])box(g,'Folded enamel side',.018,.785,.532,side*.294,.429,-.022,enamel,.008);
 box(g,'Rear casing',.592,.785,.020,0,.429,-.279,edge,.008);
 const front=new T.Shape(),w=.302,h=.392,r=.014;
 front.moveTo(-w+r,-h);front.lineTo(w-r,-h);front.quadraticCurveTo(w,-h,w,-h+r);front.lineTo(w,h-r);front.quadraticCurveTo(w,h,w-r,h);front.lineTo(-w+r,h);front.quadraticCurveTo(-w,h,-w,h-r);front.lineTo(-w,-h+r);front.quadraticCurveTo(-w,-h,-w+r,-h);
 const hole=new T.Path();hole.absarc(0,-.022,.199,0,Math.PI*2,true);front.holes.push(hole);
 part(g,'Pressed front with hatch opening',new T.ExtrudeGeometry(front,{depth:.011,bevelEnabled:true,bevelSegments:2,bevelThickness:.002,bevelSize:.002,curveSegments:16}),enamel,0,.429,.232);
 box(g,'Rolled top',.62,.027,.567,0,.82,-.015,edge,.011);
 for(const side of [-1,1])for(let n=0;n<3;n++)box(g,'Pressed side rib',.006,.424,.014,side*.303,.383,-.10+n*.07,edge,.006);
 box(g,'Lower seam',.566,.006,.001,0,.114,.245,edge,.002);
 box(g,'Filter access',.089,.083,.004,.213,.074,.247,edge,.007);
 box(g,'Detergent drawer',.162,.097,.010,-.204,.738,.249,edge,.006);
 box(g,'Drawer finger recess',.084,.009,.005,-.204,.708,.255,gasket,.002);
 function disc(name,x,y,r,z,d,m){const o=part(g,name,new T.CylinderGeometry(r,r,d,56),m,x,y,z);o.rotation.x=Math.PI/2;return o}
 const y=.407;

 // Lathe profile in radius and depth; local +Y turns towards the room.
 function ring(name,profile,m){const o=part(g,name,new T.LatheGeometry(profile.map(([r,z])=>new T.Vector2(r,z)),64),m,0,y,.245);o.rotation.x=Math.PI/2;return o}
 ring('Hatch shadow reveal',[[.222,.003],[.222,.011],[.214,.015],[.200,.007]],gasket);
 ring('Rounded door bezel',[[.219,.008],[.219,.018],[.212,.034],[.200,.043],[.185,.044],[.177,.040],[.174,.030]],edge);
 ring('Metal inner bezel',[[.179,.038],[.177,.046],[.170,.043],[.167,.031]],steel);
 ring('Recessed bellows',[[.169,.032],[.164,.039],[.153,.027],[.148,.008],[.151,-.009],[.147,-.018],[.140,-.027]],gasket);
 ring('Stainless drum wall',[[.141,-.025],[.145,-.050],[.140,-.073],[.119,-.088],[.087,-.095]],drum);
 disc('Pressed drum back',0,y,.093,.146,.005,drum);
 for(let i=0;i<3;i++){
  const a=i*Math.PI*2/3+.24;
  bar(g,'Drum lifter',[.067*Math.cos(a),y+.067*Math.sin(a),.151],[.134*Math.cos(a+.18),y+.134*Math.sin(a+.18),.204],.009,steel);
 }
 const holes=mat('Drum perforation','#52605f',.68);
 // All perforations lie in the drum face; one indexed mesh is enough.
 const points=[],indices=[];
 for(let j=0;j<3;j++)for(let i=0;i<14;i++){
  const a=(i+j*.44)*Math.PI/7,r=.081+j*.022,x=r*Math.cos(a),cy=y+r*Math.sin(a),start=points.length/3;
  const z=.151+Math.max(0,r-.088)*.38;points.push(x,cy,z);for(let k=0;k<8;k++){const t=k*Math.PI/4;points.push(x+.003*Math.cos(t),cy+.003*Math.sin(t),z);indices.push(start,start+1+k,start+1+(k+1)%8)}
 }
 const perforations=new T.BufferGeometry();perforations.setAttribute('position',new T.Float32BufferAttribute(points,3));perforations.setIndex(indices);perforations.computeVertexNormals();part(g,'Drum perforations',perforations,holes);
 const glass=mat('Inspection glass','#cfddd8',.10,.04);glass.transparent=true;glass.opacity=.24;glass.depthWrite=false;
 const lens=ring('Convex inspection glass',[[0,.062],[.050,.061],[.092,.055],[.127,.045],[.147,.031],[.155,.021]],glass);
 lens.castShadow=false;
 box(g,'Inset door pull',.023,.068,.013,.191,y+.002,.289,edge,.006);
 disc('Selector seat',-.036,.741,.042,.251,.010,gasket);disc('Selector',-.036,.741,.037,.262,.022,enamel);
 box(g,'Selector index',.003,.014,.003,-.036,.766,.275,steel,.001);
 box(g,'Display gasket',.179,.057,.006,.153,.743,.249,gasket,.007);
 box(g,'Tinted display',.168,.048,.004,.153,.743,.254,dial,.005);
 for(const x of [.101,.145,.191])disc('Touch control',x,.693,.008,.249,.002,steel);
 const face=part(g,'Wash fascia lettering',new T.PlaneGeometry(.576,.133),mat('Printed controls','#ffffff'),0,.744,.279);
 face.material.transparent=true;face.material.opacity=0;face.material.depthWrite=false;
}

export function balconyLinenRail(g){
 const tube=mat('Warm aluminium','#b1b6ad',.38,.38),shoe=mat('Foot caps','#797f79'),wood=mat('Beech pegs','#c4a176');
 const h=1.16;
 for(const x of [-.709,.709]){
  for(const side of [-1,1]){bar(g,'Slim folding leg',[x,.022,side*.119],[x,h,-side*.035],.011,tube);box(g,'Quiet floor shoe',.035,.029,.046,x,.016,side*.113,shoe,.008)}
  bar(g,'End saddle',[x,h,-.037],[x,h,.037],.012,tube);
 }
 for(const z of [-.035,.035])bar(g,'Hanging rail',[-.711,h,z],[.711,h,z],.011,tube);
 bar(g,'Foot brace',[-.709,.18,-.095],[.709,.18,-.095],.007,tube);
 const cloth=mat('Washed cotton','#ffffff',.98);cloth.vertexColors=true;
 function fabric(name,wSeg,hSeg,sample,ink){
  const geo=new T.PlaneGeometry(1,1,wSeg,hSeg),p=geo.attributes.position,col=[];
  for(let i=0;i<p.count;i++){const u=p.getX(i)+.5,v=p.getY(i)+.5;p.setXYZ(i,...sample(u,v));col.push(...ink(u,v).toArray())}
  geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.computeVertexNormals();part(g,name,geo,cloth);
 }
 function peg(x){const p=box(g,'Wood peg',.015,.052,.016,x,h+.018,.056,wood,.004);p.rotation.z=.14;bar(g,'Peg pin',[x-.009,h+.017,.063],[x+.009,h+.017,.063],.002,tube)}
 for(const [cx,w,drop,base,band] of [[-.425,.43,.59,'#ede2c9','#c9a679'],[.40,.33,.47,'#dfcfaf','#a9aa97']]){
  const linen=new T.Color(base),stripe=new T.Color(band);
  const curve=new T.CatmullRomCurve3([[-.026,h-drop*.7],[.012,h-.035],[.035,h+.014],[.054,h-.025],[.067,h-drop]].map(([z,y])=>new T.Vector3(z,y,0)));
  fabric('Turned linen',20,42,(u,v)=>{
   const p=curve.getPoint(v),loose=Math.min(1,Math.abs(v-.5)*2),waves=Math.sin(u*12+cx)+.46*Math.sin(u*20+2*v);
   return [cx+(u-.5)*w+.009*loose*Math.sin(2*v+u),p.y-.012*loose*(1-Math.sin(u*8))+.008*(u-.5),p.x+.015*loose*waves];
  },(_u,v)=>v>.82&&v<.86||v>.9&&v<.935?stripe:linen);peg(cx-w*.31);peg(cx+w*.32);
 }
 const sx=.038,stripe=new T.Color('#dae2dc'),blue=new T.Color('#98b4c5');
 for(const side of [-1,1])bar(g,'Beech hanger',[sx,h-.076,.031],[sx+side*.143,h-.166,.031],.006,wood);
 const hook=[[sx,h-.079,.030],[sx-.006,h-.029,.030],[sx+.011,h+.014,.028],[sx+.005,h+.019,.028],[sx-.012,h+.009,.028],[sx-.012,h-.002,.028]];
 for(let i=1;i<hook.length;i++)bar(g,'Wire hook',hook[i-1],hook[i],.002,tube);
 const color=(_u,v)=>v>.16&&v<.2||v>.26&&v<.30?stripe:blue;
 fabric('Little striped top',20,26,(u,v)=>[sx+(u-.5)*(.282+.018*v),.616+v*(.438+.031*Math.sin(Math.abs(u-.5)*Math.PI*2))+.007*Math.sin(u*9)*(1-v),.044+.018*Math.cos(u*11+.7*v)*(.45+.55*(1-v))],color);
 for(const side of [-1,1])fabric('Short sleeve',7,8,(u,v)=>[sx+side*(.132+.074*u),1.062-.039*u-.077*(1-v),.044+.008*Math.cos(v*3)],(u)=>u>.84?stripe:blue);
 const piping=mat('Neck binding','#e8e2ce');for(let i=1;i<=12;i++){
  const p=i=>[sx-.061+.122*i/12,1.068-.021*Math.sin(i*Math.PI/12),.056];
  bar(g,'Collar binding',p(i-1),p(i),.0035,piping);
 }
}
