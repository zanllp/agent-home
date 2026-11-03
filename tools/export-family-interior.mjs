import {makeMapleChair} from './maple-chair.mjs';
import {enamelWasher,balconyLinenRail} from './balcony-laundry.mjs';
import {makeTrailingPothos,hangingBounds} from './trailing-pothos.mjs';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.()})}};
const paint=(color,r=.75,m=0)=>new T.MeshStandardMaterial({color,roughness:r,metalness:m,side:T.DoubleSide});
const oak=paint('#c59b70'),edge=paint('#ad805a'),honey=paint('#d7af83'),grain=paint('#b78b64'),cream=paint('#e8e0cb'),dark=paint('#524b42'),blue=paint('#839aaf'),thread=paint('#c2cccf'),linen=paint('#cec5b0'),metal=paint('#978e7a',.35,.53);
function mesh(p,n,geo,m,x=0,y=0,z=0){const o=new T.Mesh(geo,m);o.name=n;o.position.set(x,y,z);p.add(o);return o}
function box(p,n,w,h,d,x,y,z,m,r=.012){return mesh(p,n,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.45,h*.45,d*.45)),m,x,y,z)}
function egg(p,n,w,h,d,x,y,z,m){const o=mesh(p,n,new T.SphereGeometry(1,20,12),m,x,y,z);o.scale.set(w,h,d);return o}
function rod(p,n,a,b,r,m,r2=r){const u=new T.Vector3(...a),v=new T.Vector3(...b),o=mesh(p,n,new T.CylinderGeometry(r2,r,u.distanceTo(v),12),m);o.position.copy(u).lerp(v,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.sub(u).normalize());return o}
function line(p,n,pts,r,m){return mesh(p,n,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(a=>new T.Vector3(...a))),Math.max(10,pts.length*3),r,5,false),m)}
function lathe(p,n,path,m){return mesh(p,n,new T.LatheGeometry(path.map(a=>new T.Vector2(...a)),40),m)}
const libraryShelves=[.49,.82,1.16,1.49,1.82];
const makers={
 wovenRug(g){
  box(g,'Bound denim edge',3.74,.013,2.48,0,.0065,0,paint('#84949d',.99),.005);
  const face=mesh(g,'Rug weave face',new T.PlaneGeometry(3.725,2.465),paint('#fff',.99),0,.0136,0);face.rotation.x=-Math.PI/2;
 },
 lowTable(g){
  // A gently bowed rectangle with an eased edge and a narrower underside.
  const w=1.18,d=.68,sections=[[.306,.947],[.310,.960],[.326,.991],[.332,1],[.351,1],[.358,.993]];
  const points=[],uv=[],indices=[],N=80;
  for(const [y,f] of sections)for(let i=0;i<N;i++){
   const a=i*2*Math.PI/N,power=v=>Math.sign(v)*Math.abs(v)**.54;
   const x=power(Math.cos(a))*w*.5*f,z=power(Math.sin(a))*d*.5*f;
   points.push(x,y,z);uv.push(x/w+.5,z/d+.5);
  }
  for(let j=0;j<sections.length-1;j++)for(let i=0;i<N;i++){
   const a=j*N+i,b=j*N+(i+1)%N;indices.push(a,a+N,b,b,a+N,b+N);
  }
  const last=N*(sections.length-1);
  for(let i=1;i<N-1;i++){indices.push(last,last+i+1,last+i);indices.push(0,i,i+1)}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();for(let i=0;i<N;i++){geo.attributes.normal.setXYZ(i,0,-1,0);geo.attributes.normal.setXYZ(last+i,0,1,0)}mesh(g,'Maple-slab',geo,paint('#cba37c',.52));
  for(const x of [-1,1])for(const z of [-1,1]){
   rod(g,'Tapered oak foot',[x*.477,.002,z*.254],[x*.431,.316,z*.214],.020,honey,.040);
   rod(g,'Felt pad',[x*.477,.001,z*.254],[x*.477,.004,z*.254],.019,edge);
  }
  for(const s of [-1,1]){box(g,'Low side rail',.872,.049,.024,0,.293,s*.214,honey,.003);box(g,'Low end rail',.025,.049,.414,s*.431,.293,0,honey,.003)}
 },
 coffeeService(g){
  const ivory=paint('#f7eed9',.36),denim=paint('#799bb8',.42),paper=paint('#f7efe0',.99),cork=paint('#bc9875',.94),ink=paint('#535b62');
  const tissue=new T.Group();g.add(tissue);tissue.position.set(-.305,0,-.07);tissue.rotation.y=.05;
  box(tissue,'Birch tissue sleeve',.178,.078,.102,0,.039,0,honey,.007);
  box(tissue,'Ivory sleeve lid',.180,.010,.104,0,.080,0,ivory,.004);
  box(tissue,'Tissue slot',.104,.002,.017,0,.086,0,ink,.0008);
  const sheet=new T.PlaneGeometry(1,1,14,14),v=sheet.attributes.position;
  for(let i=0;i<v.count;i++){const u=v.getX(i)+.5,t=v.getY(i)+.5;v.setXYZ(i,(u-.5)*(.071+.058*t)+.021*t,.085+t*(.045+.043*u)+.014*Math.sin(u*4.3)*t,.015*t*Math.sin(u*8+t)+.014*t*t)}
  sheet.computeVertexNormals();mesh(tissue,'Folded tissue',sheet,paper);
  const bottle=new T.Group();g.add(bottle);bottle.position.set(-.065,0,-.12);
  lathe(bottle,'Powder blue flask',[[0,.002],[.033,.002],[.038,.008],[.038,.158],[.035,.171],[.029,.176],[.029,.181],[0,.181]],denim);
  lathe(bottle,'Bottle collar',[[.029,.172],[.031,.173],[.031,.185],[.029,.188]],metal);
  lathe(bottle,'Cup cap',[[0,.184],[.030,.184],[.032,.188],[.032,.211],[.029,.216],[0,.216]],blue);
  line(bottle,'Flask carry loop',[[.026,.206,0],[.039,.223,0],[.030,.237,0],[.014,.239,0],[.014,.213,0]],.0032,denim);
  line(bottle,'Flask wave mark',[[-.014,.105,.035],[0,.109,.038],[.014,.104,.035]],.0016,ivory);
  for(const x of [-.007,.007])egg(bottle,'Enamel drop',.0028,.004,.001,x,.117,.036,ivory);
  const cup=new T.Group();g.add(cup);cup.position.set(.278,0,.08);cup.rotation.y=-.19;
  lathe(cup,'Cork coaster',[[0,0],[.053,0],[.055,.004],[.052,.006],[0,.006]],cork);
  lathe(cup,'Glazed tea cup',[[0,.006],[.03,.006],[.032,.010],[.039,.071],[.039,.076],[.035,.077],[.034,.070],[.027,.017],[0,.016]],ivory);
  lathe(cup,'Tea surface',[[0,.060],[.034,.060],[.034,.061],[0,.061]],paint('#967045',.33));
  line(cup,'Cup handle',[[.034,.061,0],[.055,.064,0],[.062,.050,0],[.058,.031,0],[.035,.025,0]],.0045,ivory);
  for(const [x,y] of [[-.009,.037],[.002,.043],[.011,.036]])egg(cup,'Blue petal',.004,.006,.001,x,y,.035,denim);
  const magazine=new T.Group();g.add(magazine);magazine.position.set(-.10,.001,.115);magazine.rotation.y=-.18;
  box(magazine,'Magazine cover',.178,.007,.130,0,.0035,0,blue,.002);box(magazine,'Magazine leaves',.174,.007,.126,0,.009,0,paper,.001);
  const front=mesh(magazine,'Weekend print',new T.PlaneGeometry(.178,.130),paper,0,.013,0);front.rotation.x=-Math.PI/2;
  const remote=new T.Group();g.add(remote);remote.position.set(.18,.001,-.115);remote.rotation.y=.17;
  box(remote,'TV remote',.046,.012,.116,0,.006,0,ink,.005);
  egg(remote,'Power key',.004,.0015,.004,-.012,.012,-.043,paint('#c1846c'));
  const dial=mesh(remote,'Remote dial',new T.TorusGeometry(.009,.002,6,20),metal,0,.013,-.017);dial.rotation.x=-Math.PI/2;
  for(let i=0;i<6;i++)box(remote,'Soft button',.007,.002,.004,(i%3-1)*.011,.012,.009+Math.floor(i/3)*.012,thread,.0008);
 },

 mediaUnit(g){
  const birch=paint('#d7b68c',.51),edge=paint('#c1a17c',.56),ivory=paint('#eae4d8',.58),recess=paint('#ac8e69',.8);
  const w=2.192,d=.54,h=.441,base=.073;
  box(g,'Maple media plinth',w-.095,.045,d-.088,0,.0225,-.01,edge,.005);
  box(g,'Maple media bottom',w-.015,.029,d-.018,0,base-.0145,0,birch,.005);
  box(g,'Maple media top',w,h-.410,d,0,(h+.410)/2,0,birch,.007);
  for(const s of [-1,1]){
   box(g,'Maple media stile',.023,.338,d-.022,s*(w/2-.018),.241,0,birch,.004);
   box(g,'Maple cubby stile',.018,.338,d-.028,s*.57,.241,-.004,birch,.003);
   box(g,'Ivory inset door',.485,.312,.020,s*.828,.239,.248,ivory,.004);
   box(g,'Recess under tab',.050,.010,.004,s*.623,.366,.259,recess,.001);
   box(g,'Bronze edge pull',.047,.012,.014,s*.623,.373,.260,edge,.002);
  }
  box(g,'Maple media back',w-.06,.333,.018,0,.238,-.239,birch,.003);
  box(g,'Maple open shelf',1.127,.019,.406,0,.239,-.005,birch,.003);
  box(g,'Solid_edge_lip',1.125,.019,.009,0,.239,.199,edge,.002);
  // A fixed fabric-front cable compartment only occupies the left part of the upper shelf.
  box(g,'Cable compartment divider',.016,.161,.416,-.10,.329,-.005,birch,.002);
  const fabric=paint('#baae99',.96);box(g,'Woven cable grille',.449,.144,.013,-.334,.327,.202,fabric,.004);
  box(g,'Grille tab',.035,.008,.007,-.141,.362,.213,edge,.001);
  // Darken the inside corners of the two real recesses, not the faces of movable props.
  for(const [low,high] of [[.073,.2295],[.2485,.410]]){
   const span=1.118,height=high-low,geo=new T.PlaneGeometry(span,height,24,8),pos=geo.attributes.position,colors=[];
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);
    const v=.94-.17*Math.exp(-(span/2-Math.abs(x))/.045)-.25*Math.exp(-(height/2-y)/.04)-.08*Math.exp(-(height/2+y)/.026);colors.push(v,v,v)}
   geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));const mat=birch.clone();mat.vertexColors=true;mesh(g,'Maple bay lining',geo,mat,0,(low+high)/2,-.228);
  }
  // The slot is at the back, outside both usable surfaces.
  box(g,'Cable exit',.182,.035,.004,.09,.290,-.227,paint('#605c50',.97),.006);
 },
 gameCorner(g){
  const dock=new T.Group(),pad=new T.Group();makers.game(dock);makers.gamepad(pad);
  pad.position.set(.057,0,.079);pad.rotation.y=-.16;g.add(dock,pad);
 },
 gamepad(g){
  const porcelain=paint('#eee9de',.51),soft=paint('#d0d8d4',.61),dark=paint('#4d5456',.78),gold=paint('#d3ab72',.56);
  egg(g,'Controller body',.065,.018,.035,0,.024,-.006,porcelain);
  for(const s of [-1,1]){
   const grip=egg(g,'Hand grip',.021,.016,.037,s*.049,.019,.013,porcelain);grip.rotation.y=s*.33;
   egg(g,'Shoulder trigger',.017,.008,.006,s*.045,.024,-.034,soft);
  }
  for(const [x,z] of [[-.035,-.014],[.016,.006]]){
   const a=mesh(g,'Thumbstick ring',new T.CylinderGeometry(.008,.009,.003,20),soft,x,.041,z);
   egg(g,'Thumb pad',.0065,.003,.0065,x,a.position.y+.003,z,dark);
  }
  box(g,'D-pad horizontal',.014,.002,.005,-.021,.042,.006,dark,.001);
  box(g,'D-pad vertical',.005,.003,.014,-.021,.043,.006,dark,.001);
  for(const [i,[x,z]] of [[.040,-.020],[.047,-.014],[.034,-.014],[.040,-.008]].entries())egg(g,'Button',.003,.002,.003,x,.039,z,i===0?gold:dark);
  box(g,'Paired lamp',.011,.001,.002,-.002,.042,-.017,blue,.0005);
 },

 library(g){
  const veneer=paint('#d5af85',.53),band=paint('#be9369',.49),porcelain=paint('#e9e3d4',.55),shadow=paint('#9f805f');
  const w=1.104,d=.475,h=2.245,bottom=.49;
  box(g,'Recessed maple plinth',w-.064,.071,d-.085,0,.0355,-.012,band);
  box(g,'Lower cabinet body',w-.025,bottom-.071,d-.012,0,(bottom+.071)/2,0,veneer);
  for(const s of [-1,1]){
   box(g,'Inset porcelain door',(w-.044)/2-.008,.385,.019,s*(w-.044)/4,.27,.236,porcelain,.006);
   box(g,'Handle recess',.080,.014,.007,s*.105,.426,.247,shadow,.004);
   box(g,'Brushed tab',.074,.011,.024,s*.105,.432,.251,honey,.004);
   box(g,'Maple case stile',.027,h-.069,d,s*(w-.027)/2,(h+.069)/2,0,veneer,.005);
  }
  box(g,'Maple case crown',w,.033,d,0,h-.0165,0,veneer,.005);
  box(g,'Maple case back',w-.050,h-bottom-.02,.024,0,(h+bottom)/2,-.214,veneer,.003);
  for(const y of libraryShelves){
   box(g,'Maple shelf',w-.053,.024,d-.047,0,y-.012,-.001,veneer,.003);
   box(g,'Solid edge lipping',w-.053,.026,.013,0,y-.013,(d-.047)/2+.002,band,.003);
  }
  // Modulate only the permanent wood join at the back of each niche; loose books cast real shadows.
  const backing=veneer.clone();backing.vertexColors=true;
  for(const [index,y] of libraryShelves.entries()){
   const top=libraryShelves[index+1]||h-.009,height=top-.025-y,geo=new T.PlaneGeometry(w-.056,height,24,16),pos=geo.attributes.position,colors=[];
   for(let j=0;j<pos.count;j++){const x=pos.getX(j),v=pos.getY(j),side=(w-.056)/2-Math.abs(x),roof=height/2-v,floor=v+height/2;
    const light=1-.12*Math.exp(-side/.047)-.16*Math.exp(-roof/.060)-.06*Math.exp(-floor/.030);colors.push(light,light,light)}
   geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));mesh(g,'Maple niche lining',geo,backing,0,y+height/2,-.2006);
  }
  for(const y of [.49,1.16,1.82])box(g,'Maple back-panel batten',.022,.306,.016,.012,y+.153,-.188,veneer,.002);
  // Panel pins sit behind the shelf lip, not in the usable space for books.
  const brass=paint('#b19b75',.41,.28);
  for(const y of libraryShelves)for(const s of [-1,1])for(const z of [-.16,.115])
   rod(g,'Shelf pin',[s*.52,y-.035,z],[s*.508,y-.035,z],.005,brass);
 },
 bookend(g){
  const glaze=paint('#e6e3d6',.32),ink=paint('#526474',.56),foam=paint('#acc5c4',.44);
  box(g,'Ceramic plinth',.228,.014,.123,0,.007,0,foam,.006);
  egg(g,'Porcelain whale body',.073,.046,.044,-.013,.060,0,glaze);
  for(const s of [-1,1]){
   const tail=egg(g,'Upturned fluke',.025,.009,.019,.072,.078,s*.014,foam);tail.rotation.z=.40;tail.rotation.x=-s*.3;
   egg(g,'Ink dot eye',.004,.004,.002,-.057,.068,s*.035,ink);
   const fin=egg(g,'Ceramic fin',.019,.010,.011,-.01,.047,s*.041,foam);fin.rotation.z=-.2;
  }
  line(g,'Between the waves',[[-.09,.018,.050],[-.05,.020,.054],[0,.018,.052],[.04,.022,.052],[.087,.019,.050]],.002,glaze);
 },

 studyChair(g){
  const shell=paint('#deded2'),upholstery=paint('#a4b8c6',.94),piping=paint('#c2cfd2',.95),wheel=paint('#707779',.86),peg=paint('#ede9da'),silver=paint('#aab3ae',.35,.5);
  rod(g,'Gas lift',[0,.07,0],[0,.274,0],.025,silver);rod(g,'Column shroud',[0,.074,0],[0,.179,0],.036,shell);
  for(let i=0;i<5;i++){
   const a=i*Math.PI*2/5+.3,x=Math.sin(a),z=Math.cos(a);
   rod(g,'Tapered star spoke',[x*.017,.113,z*.017],[x*.229,.065,z*.229],.023,shell,.016);
   const fork=new T.Group();fork.position.set(x*.231,.039,z*.231);fork.rotation.y=a;g.add(fork);
   box(fork,'Caster fork',.028,.05,.038,0,.006,0,shell,.008);
   for(const s of [-1,1]){
    const tire=mesh(fork,'Soft caster wheel',new T.CylinderGeometry(.031,.031,.012,20),wheel,s*.022,-.008,0);tire.rotation.z=Math.PI/2;
    const cap=mesh(fork,'Caster hub',new T.CylinderGeometry(.014,.014,.013,16),silver,s*.023,-.008,0);cap.rotation.z=Math.PI/2;
   }
  }
  // Slightly squared cushion with a convex centre; total height matches the calibrated seated pose.
  function cushion(n,radii,centre,material,power,tilt=0){
   const geo=new T.SphereGeometry(1,52,32),p=geo.attributes.position;
   for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)].map((k,j)=>Math.sign(k)*Math.pow(Math.abs(k),power)*radii[j]);p.setXYZ(i,...v)}
   geo.computeVertexNormals();const m=mesh(g,n,geo,material,...centre);m.rotation.x=tilt;return m
  }
  cushion('Ivory seat pan',[.267,.028,.223],[0,.278,.025],shell,.64);
  cushion('Blue woven saddle',[.27,.042,.227],[0,.3095,.028],upholstery,.69);
  const rim=[];for(let i=0;i<=56;i++){const a=2*Math.PI*i/56,sq=k=>Math.sign(k)*Math.abs(k)**.69;rim.push([.268*sq(Math.cos(a)),.3,.028+.225*sq(Math.sin(a))])}line(g,'Soft welt',rim,.0024,piping);
  line(g,'Swept rear spine',[[0,.27,-.08],[0,.284,-.165],[0,.356,-.224],[0,.513,-.245],[0,.64,-.25]],.025,shell);
  cushion('Curved back shell',[.244,.204,.029],[0,.575,-.23],shell,.65,-.095);
  cushion('Foam back pad',[.237,.195,.032],[0,.579,-.205],upholstery,.68,-.095);
  for(const x of [-.058,.058]){
   line(g,'Forked back support',[[x*.4,.396,-.246],[x,.535,-.266],[x*.86,.652,-.269]],.013,peg);
   egg(g,'Inset fastener',.006,.006,.002,x,.536,-.28,silver);
  }
  line(g,'Carry handle',[[-.061,.65,-.267],[-.072,.669,-.282],[-.057,.682,-.286],[.057,.682,-.286],[.072,.669,-.282],[.061,.65,-.267]],.008,shell);
 },

 shelfLamp(g){
  lathe(g,'Turned maple foot',[[0,.003],[.052,.003],[.055,.010],[.050,.020],[.024,.029],[.022,.054],[.012,.060],[0,.060]],oak);
  rod(g,'Brass socket',[0,.05,0],[0,.116,0],.009,metal);
  lathe(g,'Linen shade',[[.066,.085],[.077,.095],[.066,.221],[.06,.226],[.057,.225],[.063,.215],[.073,.099],[.064,.09]],paint('#ffe5ad',.92));
  for(const [r,y] of [[.076,.097],[.065,.218]]){const ring=mesh(g,'Bound shade edge',new T.TorusGeometry(r,.0025,6,44),cream,0,y,0);ring.rotation.x=Math.PI/2}
 },
 portrait(g){
  const w=.83,h=.55;box(g,'Oak gallery moulding',w,h,.028,0,h/2,0,oak,.008);
  box(g,'Warm paper mount',w-.027,h-.027,.004,0,h/2,.015,cream,.001);
  const pic=mesh(g,'Picnic print',new T.PlaneGeometry(.722,.48),paint('#ffffff',.97),0,h/2,.018);
  pic.material.name='Pigment print';
 },
 studioBoard(g){
  box(g,'Maple pinboard frame',.70,.61,.030,0,.305,0,oak);
  box(g,'Linen backing',.678,.588,.005,0,.305,.016,paint('#c8b79a',.97));
  const card=(name,x,y,w,h,angle,color)=>{
   const clip=new T.Group();clip.position.set(x,y,.022);clip.rotation.z=angle;g.add(clip);
   box(clip,'Paper edge',w,h,.002,0,0,0,paint(color),.001);
   mesh(clip,name,new T.PlaneGeometry(w-.009,h-.009),paint('#ffffff',.95),0,0,.0014);
   egg(clip,'Drawing pin',.008,.008,.003,0,h/2-.012,.004,metal);
  };
  card('Weekend sketch',.070,.441,.40,.237,-.035,'#fff5dc');
  card('Garden diary',-.146,.166,.265,.227,.034,'#fff3df');
  card('Workshop ticket',.151,.176,.238,.153,-.054,'#f5dfa9');
  const swatches=['#b1c6bd','#e7c694','#afc3cf'];
  swatches.forEach((color,i)=>box(g,'Paint swatch',.054,.078,.002,-.276+i*.066,.438,.024,paint(color),.002).rotation.z=.04);
 },
 clock(g){
  const disk=(name,r,d,z,mat)=>{const m=mesh(g,name,new T.CylinderGeometry(r,r,d,48),mat,0,.194,z);m.rotation.x=Math.PI/2;return m};
  disk('Beech bentwood rim',.194,.042,0,oak);disk('Ivory dial',.183,.005,.023,cream);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,t=box(g,'Inlaid hour index',i%3===0?.011:.005,i%3===0?.028:.018,.003,Math.sin(a)*.152,.194+Math.cos(a)*.152,.027,dark,.001);t.rotation.z=-a}
  for(const [name,len,w,z] of [['Hour hand',.089,.013,.031],['Minute hand',.139,.009,.036]]){
   const pivot=new T.Group();pivot.name=name;pivot.position.set(0,.194,z);g.add(pivot);box(pivot,'Leaf hand',w,len+.019,.003,0,(len-.019)/2,0,dark,.002);
  }
  disk('Brass centre pin',.009,.009,.038,honey);
 },
 hooks(g){
  const cloth=paint('#e4d7ab',.99),seam=paint('#9b996e',.95),denim=paint('#829db4',.97);
  box(g,'Maple hook rail',.65,.075,.034,0,.56,0,oak,.014);
  for(const x of [-.224,0,.224]){rod(g,'Wood peg',[x,.55,.02],[x,.585,.083],.014,honey,.018);egg(g,'Mushroom end',.022,.021,.021,x,.584,.082,honey)}
  line(g,'Canvas handle',[[.12,.34,.102],[.16,.47,.105],[.215,.58,.094],[.24,.56,.095],[.30,.35,.11]],.010,seam);
  const bag=new T.Group();bag.position.set(.202,0,.106);g.add(bag);
  const ring=new T.LatheGeometry([[.0,.008],[.112,.016],[.131,.045],[.138,.24],[.129,.326],[.119,.326],[.123,.29],[.114,.12],[0,.035]].map(([r,y])=>new T.Vector2(r,y)),32);
  const body=mesh(bag,'Soft market tote',ring,cloth);body.scale.z=.36;
  for(const x of [-.077,.06]){line(bag,'Woven blue ribbon',[[x,.04,.038],[x+.004,.15,.043],[x,.304,.041]],.0035,denim)}
  line(g,'Hat loop',[[-.248,.46,.072],[-.225,.577,.092],[-.19,.47,.076]],.005,seam);
  const hat=new T.Group();g.add(hat);hat.position.set(-.215,.36,.105);hat.rotation.x=.44;hat.rotation.z=-.12;
  egg(hat,'Bucket hat brim',.125,.046,.118,0,0,0,denim);
  egg(hat,'Hat crown',.098,.102,.093,0,.052,0,denim);
  line(hat,'Crown stitch',[[-.091,.046,.019],[-.064,.042,.069],[0,.040,.09],[.064,.042,.069],[.089,.046,.019]],.0028,cream);
 },
 game(g){
  const shell=paint('#444a50',.44),mint=paint('#84bcb8',.48),coral=paint('#d99478',.48);
  box(g,'Charging dock',.178,.083,.061,0,.044,0,shell);
  box(g,'Handheld screen',.164,.093,.014,0,.09,-.011,dark);
  for(const sign of [-1,1]){const x=sign*.092;box(g,'Detachable grip',.028,.094,.019,x,.088,-.009,sign<0?mint:coral,.009);egg(g,'Joystick',.006,.006,.002,x,.117,.002,dark)}
  box(g,'Charge indicator',.008,.002,.001,-.067,.021,.031,mint,.0004);
  for(let i=0;i<3;i++)box(g,'Game case',.014,.108,.077,.134+i*.016,.054,0,[honey,blue,coral][i],.002);
 },
 vacuum(g){
  const disk=(name,r,h,y,m)=>mesh(g,name,new T.CylinderGeometry(r,r,h,48),m,0,y,0);
  const enamel=paint('#f1ebdb',.46),smoke=paint('#555b5b',.55);
  disk('Soft bumper',.151,.043,.038,smoke);disk('Ivory shell',.153,.036,.068,enamel);disk('Lidar ring',.040,.022,.092,metal).position.z=-.05;disk('Lidar cover',.038,.010,.107,enamel).position.z=-.05;
  for(let i=0;i<2;i++)box(g,'Touch control',.009,.0015,.014,-.010+i*.021,.086,.045,metal,.001);
 },
 table(g){
  const slab=box(g,'Maple-slab',1.84,.064,.98,0,.718,0,paint('#c59b70',.48),.03);
  // Project the grain across the round-over as well as the top; box-face UVs stretch at the rim.
  const {position,uv}=slab.geometry.attributes;
  for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/1.84+.5,(position.getZ(i)+position.getY(i)*.32)/1.01+.5);
  box(g,'Inset eased underside',1.805,.018,.944,0,.685,0,edge,.008);
  for(const s of [-1,1]){box(g,'Apron',1.53,.085,.045,0,.655,s*.38,edge);box(g,'End apron',.04,.085,.71,s*.74,.655,0,edge);
   for(const q of [-1,1])rod(g,'Tapered leg',[s*.82,.022,q*.415],[s*.735,.69,q*.357],.028,honey,.042)}
 },
 runner(g){
  box(g,'Linen placemat',.60,.009,.51,0,.005,0,linen,.005);
  for(let i=0;i<35;i++)for(const s of [-1,1])rod(g,'Thread fringe',[(i-17)*.0165,.005,s*.25],[(i-17)*.0165+.002*Math.sin(i),.004,s*.267],.0019,cream);
  for(const s of [-1,1])for(let i=0;i<2;i++)box(g,'Woven border',.58,.001,.0025,0,.0106,s*(.219+i*.008),cream,0);
 },
 entryTile(g){
  const w=1.24,d=.96,grout=paint('#b4a99a',.94),stone=[paint('#ddd3c3',.86),paint('#d7cbbb',.85),paint('#e4d9c9',.86)];
  box(g,'Grouted bed',w,.010,d,0,.005,0,grout,.003);
  for(let i=0;i<3;i++)for(let j=0;j<2;j++)box(g,'Honed tile',w/3-.003,.008,d/2-.003,(i-1)*w/3,.010,(j-.5)*d/2,stone[(i+j)%3],.002);
  box(g,'Brass transition',w,.012,.006,0,.006,d/2-.003,paint('#b7a384',.38,.33),.002);
 },
 entryMemory(g){
  const frame=new T.Group();g.add(frame);frame.position.set(-.071,.004,-.028);frame.rotation.x=-.14;
  box(frame,'Walnut photo frame',.177,.132,.012,0,.066,0,edge,.003);
  box(frame,'Ivory mount',.164,.120,.002,0,.066,.007,cream,.001);
  mesh(frame,'Picnic print',new T.PlaneGeometry(.147,.098),paint('#fff',.97),0,.067,.009);
  rod(g,'Frame easel',[-.071,.009,-.073],[-.071,.087,-.04],.004,honey);
  const tray=new T.Group();tray.position.set(.083,0,.014);g.add(tray);
  lathe(tray,'Glazed key dish',[[0,.002],[.052,.002],[.068,.013],[.070,.021],[.067,.023],[.062,.017],[.053,.009],[0,.008]],paint('#768d84',.34));
  const ring=mesh(tray,'Key split ring',new T.TorusGeometry(.013,.0019,6,32),metal,-.014,.015,0);ring.rotation.x=Math.PI/2;
  for(const sign of [-1,1]){
   const key=new T.Group();key.position.set(-.009,.017,sign*.006);key.rotation.y=sign*.58;tray.add(key);
   const eye=mesh(key,'Bow',new T.TorusGeometry(.0075,.0024,6,20),metal);eye.rotation.x=Math.PI/2;
   box(key,'Blade',.005,.002,.027,0,0,.020,metal,.0006);
   for(let j=0;j<2;j++)box(key,'Cut bit',.007,.002,.003,.003,0,.029-j*.006,metal,.0005);
  }
 },
 door(g){
  const wood=paint('#98734f'),inset=paint('#886548');
  box(g,'Frame',1.01,2.16,.083,0,1.08,0,edge);box(g,'Recessed reveal',.948,2.115,.028,0,1.06,.044,dark);
  box(g,'Door slab',.918,2.09,.032,0,1.055,.059,wood);
  for(let i=0;i<5;i++)box(g,'Oak veneer joint',.0025,2.01,.0015,(i-2)*.175,1.06,.076,inset,0);
  box(g,'Lock',.061,.22,.018,-.351,1.01,.083,dark);box(g,'Lever',.112,.016,.026,-.316,1.027,.104,metal);
  egg(g,'Peephole',.014,.014,.004,0,1.52,.078,metal);box(g,'Threshold',.95,.018,.11,0,.009,.014,metal);
 },
 cabinet(g){
  box(g,'Carcase',.81,.77,.285,0,.46,0,cream);box(g,'Oak top',.85,.034,.30,0,.86,0,oak);
  for(const s of [-1,1]){box(g,'Inset front',.382,.701,.016,s*.198,.455,.147,honey);
   for(let i=0;i<8;i++)box(g,'Slat',.019,.59,.008,s*.198+(i-3.5)*.041,.45,.157,oak);
   box(g,'Handle',.067,.012,.016,s*.078,.764,.167,dark)}
  for(const s of [-1,1])for(const q of [-1,1])rod(g,'Foot',[s*.35,0,q*.105],[s*.35,.085,q*.105],.022,edge);
 },
 tray(g){
  lathe(g,'Key dish',[[0,.002],[.065,.002],[.077,.009],[.081,.017],[.076,.019],[.063,.011],[0,.010]],paint('#648681',.42));
  const ring=mesh(g,'Keyring',new T.TorusGeometry(.018,.002,6,24),metal,-.016,.017,0);ring.rotation.x=Math.PI/2;
  for(const s of [-1,1]){const key=box(g,'Key',.009,.003,.041,s*.013,.018,.022,metal);key.rotation.y=s*.36}
 },
 mat(g){
  box(g,'Woven doormat',1.02,.016,.64,0,.008,0,paint('#bda98c'));
  for(let i=0;i<12;i++)box(g,'Row of weave',.96,.001,.008,0,.017,(i-5.5)*.05,i%3?linen:cream,0);
 },
 slippers(g,color){
  const felt=paint(color,.96);
  for(const s of [-1,1]){const f=new T.Group();g.add(f);f.position.set(s*.062,0,s*.021);f.rotation.y=s*.15;
   egg(f,'Padded sole',.051,.014,.126,0,.015,0,cream);egg(f,'Footbed',.046,.013,.119,0,.026,0,linen);
   egg(f,'Slipper toe',.048,.042,.069,0,.034,-.047,felt);
   line(f,'Piping',[[-.044,.035,.005],[-.03,.057,.012],[0,.066,.018],[.03,.057,.012],[.044,.035,.005]],.0025,cream)}
 },
 pillow(g){
  // Two bulging cloth panels meet at a piped, pinched edge instead of a rounded box.
  const cloth=paint('#9eb1c1',.96),cord=paint('#b7c6cc',.98),cushion=new T.Group();g.add(cushion);
  cushion.position.y=.175;cushion.rotation.z=.085;cushion.rotation.x=-.17;
  function point(u,v,sign){
   const b=Math.max(0,(1-u*u)*(1-v*v)),fold=.004*Math.cos(10*v+u)*Math.abs(u)**5;
   return new T.Vector3(.202*u*(1-.12*v*v)+fold,.166*v*(1-.11*u*u),sign*(.008+.073*b**.57-.004*Math.cos(v*5+u*8)*b));
  }
  for(const side of [-1,1]){
   const geo=new T.PlaneGeometry(2,2,34,30),p=geo.attributes.position;
   for(let i=0;i<p.count;i++){const v=point(p.getX(i)*side,p.getY(i),side);p.setXYZ(i,v.x,v.y,v.z)}
   geo.computeVertexNormals();mesh(cushion,'Filled linen panel',geo,cloth);
  }
  // Close the perimeter with a narrow fabric gusset; the fine piping follows the same outline.
  const edge=[];for(let i=0;i<4;i++)for(let j=0;j<24;j++){const t=j/12-1;edge.push([[t,-1],[1,t],[-t,1],[-1,-t]][i])}edge.push(edge[0]);
  const strip=new T.PlaneGeometry(1,1,edge.length-1,1),pos=strip.attributes.position;
  for(let i=0;i<pos.count;i++){const p=point(...edge[i%edge.length],i<edge.length?1:-1);pos.setXYZ(i,p.x,p.y,p.z)}strip.computeVertexNormals();mesh(cushion,'Sewn edge band',strip,cloth);
  line(cushion,'Piped pillow seam',edge.map(q=>point(...q,1).toArray()),.0023,cord);
 },
 whale(g){
  const blueWool=paint('#829db5',.99),belly=paint('#f1ece0',.97),stitch=paint('#4e5968',.98);
  // One closed skin from rounded nose to a raised tail; the pale underside is part of the same surface.
  const profiles=[[-.217,.119,.003,.004],[-.207,.132,.057,.063],[-.166,.139,.095,.096],[-.086,.138,.118,.118],[.009,.132,.115,.114],[.091,.130,.085,.090],[.151,.139,.046,.055],[.184,.160,.023,.029],[.208,.172,.006,.011]];
  const shape=new T.CatmullRomCurve3(profiles.map(([x,y,h])=>new T.Vector3(x,y,h)));
  const width=new T.CatmullRomCurve3(profiles.map(([x,y,,d])=>new T.Vector3(x,y,d)));
  function surface(u,a){const p=shape.getPoint(u);const y=p.y+p.z*Math.sin(a);return new T.Vector3(p.x,.044+Math.log1p(Math.exp((y-.044)*150))/150,width.getPoint(u).z*Math.cos(a))}
  const nu=46,na=44,vertices=[],indices=[],topIndices=[],lowerIndices=[];
  for(let i=0;i<=nu;i++)for(let j=0;j<na;j++)vertices.push(...surface(i/nu,j*2*Math.PI/na).toArray());
  for(let i=0;i<nu;i++)for(let j=0;j<na;j++){
   const p=i*na+j,q=i*na+(j+1)%na,dst=Math.sin((j+.5)*2*Math.PI/na)<-.33?lowerIndices:topIndices;
   dst.push(p,p+na,q,q,p+na,q+na);
  }
  for(let j=1;j<na-1;j++)topIndices.push(0,j+1,j,nu*na,nu*na+j,nu*na+j+1);
  indices.push(...topIndices,...lowerIndices);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);
  geo.addGroup(0,topIndices.length,0);geo.addGroup(topIndices.length,lowerIndices.length,1);geo.computeVertexNormals();mesh(g,'Velour whale',geo,[blueWool,belly]);
  for(const side of [-1,1]){
   const a=side>0?.15:Math.PI-.15,eye=surface(.23,a);eye.z+=side*.002;
   egg(g,'Embroidered eye',.011,.012,.005,...eye.toArray(),stitch);
   egg(g,'Cream eye stitch',.003,.003,.002,eye.x-.003,eye.y+.004,eye.z+side*.004,belly);
   const smile=[];for(let j=0;j<=9;j++){const p=surface(.09+j*.012,side>0?-.20-.11*Math.sin(j*Math.PI/9):Math.PI+.20+.11*Math.sin(j*Math.PI/9));p.z+=.0025*side;smile.push(p.toArray())}line(g,'Sewn smile',smile,.0018,stitch);
   const seam=[];for(let j=0;j<=28;j++){const p=surface(.055+j*.031,side>0?-.34:Math.PI+.34);p.z+=side*.0015;seam.push(p.toArray())}line(g,'Belly piping',seam,.0016,paint('#c5c2b2',.98));
   const fin=egg(g,'Soft side flipper',.047,.018,.034,-.011,.088,side*.109,blueWool);fin.rotation.z=-.32;
   const tail=egg(g,'Tail fluke',.051,.018,.048,.200,.171,side*.032,blueWool);tail.rotation.y=-.70*side;tail.rotation.x=-.26*side;
  }
 },
 throw(g){
  // Sample the crest and outer edge of the sofa arm. The hem hangs outside it, rather than through it.
  const cloth=paint('#8d9eaf',.98),yarn=paint('#ced3cb',.99),geo=new T.PlaneGeometry(1,1,66,46),pos=geo.attributes.position;
  const path=new T.CatmullRomCurve3([[.664,.453],[.717,.462],[.764,.523],[.814,.571],[.866,.586],[.916,.587],[.963,.565],[.990,.528],[1.010,.481],[1.019,.406],[1.017,.313],[1.020,.22],[1.024,.151]].map(([x,y])=>new T.Vector3(x,y,0)),false,'centripetal');
  function fold(u,v){
   const a=path.getPoint(u),hang=Math.max(0,(u-.46)/.54),s=v-.5;
   const w=Math.sin(12*v+u*.95)+.36*Math.sin(23*v-u*2+.5);
   return [a.x+.009*w*hang+.009*s*u,a.y+.0035*w+.017*s*(1-u)+.009*hang*Math.sin(7*v),.383*s+.022*Math.sin(3*u)-.014*u+.012*s*u];
  }
  for(let i=0;i<pos.count;i++){const q=fold(pos.getX(i)+.5,pos.getY(i)+.5);pos.setXYZ(i,...q)}
  geo.computeVertexNormals();mesh(g,'Wool drape',geo,cloth);
  for(const v of [0,1])line(g,'Bound selvage',Array.from({length:43},(_,j)=>fold(j/42,v)),.0024,yarn);
  for(let i=0;i<32;i++){
   const [x,y,z]=fold(1,(i+.5)/32),lean=.002*Math.sin(i*2.13),len=.031+.004*Math.cos(i*1.65);
   line(g,'Knotted cotton fringe',[[x,y,z],[x+.001,y-.009,z+.001],[x+.002+lean,y-.022,z-.0008],[x+lean,y-len,z+.001*Math.sin(i)]],.0018,yarn);
  }
 }
};
const catalog=JSON.parse(readFileSync('house3d/furniture-assets.json')),manifest=JSON.parse(readFileSync('runtime-assets.json'));
const top=(size,height)=>({surfaces:{top:{size,height}}});
const assets=[
 ['woven-rug','雾蓝拼织客厅地毯','rug',makers.wovenRug,{rug_fabric:'/models/materials/lounge-rug-v1.jpg'}],
 ['low-table','圆角枫木小茶几','coffee_table',makers.lowTable,top([.99,.51],.358)],
 ['weekend-tea','周末茶点和手作杂志','desktop',makers.coffeeService,{placement:'surface',print_texture:'/models/materials/family-assembly-guide-v1.jpg'}],
 ['maple-media-unit','白橡木电视矮柜','media_console',makers.mediaUnit,{surfaces:{top:{size:[2.12,.47],height:.441},upper_bay:{size:[.61,.37],center:[.225,0],height:.2485,clearance:.16},lower_bay:{size:[1.08,.37],height:.073,clearance:.155}},limitations:['两侧柜门为装饰；中间两层可布置低矮物品']}],
 ['game-corner','掌机底座和配套手柄','desktop',makers.gameCorner,{placement:'surface',limitations:['作为一组摆放；需要分开时选独立手柄和单独底座']}],
 ['wireless-pad','奶油白无线手柄','desktop',makers.gamepad,{placement:'surface',limitations:['独立摆件；不能操控电视节目']}],
 ['maple-library','枫木书墙与奶油色底柜','shelf',makers.library,{surfaces:Object.fromEntries(libraryShelves.map((height,i)=>['shelf-'+(i+1),{height,size:[.94,.34],clearance:Math.round(((libraryShelves[i+1]||2.236)-.025-height)*1000)/1000}])),limitations:['底柜门为装饰，不提供开关动作；五层开放层板可独立布置']}],
 ['porcelain-whale','浪花陶瓷小鲸鱼','desktop',makers.bookend,{placement:'surface'}],
 ['study-chair','雾蓝无扶手学习椅','chair',makers.studyChair,{interactions:catalog['whale-chair-v1'].interactions,limitations:['座垫按家庭坐姿标定；椅轮与升降柱为静态部件']}],
 ['shelf-lamp','木座奶油色小台灯','lamp',makers.shelfLamp,{placement:'surface'}],
 ['picnic-print','大肥鱼画的周末野餐','wall_art',makers.portrait,{placement:'wall',elevation:1.75,print_texture:'/models/materials/family-picnic-v1.jpg'}],
 ['maple-dining-chair','枫木弯背布垫餐椅','dining_chair',makeMapleChair,{interactions:{sit:{root:[0,.0975,-.015],yaw:0,seat_height:.449,approaches:[[-1.01,0,.14],[1.01,0,.14],[-.91,0,-.26],[.91,0,-.26],[0,0,1.0],[0,0,-.98]]}},limitations:['可从可达的一侧入座；不提供进食或端碗动画。']}],
 ['enamel-washer','暖白珐琅滚筒洗衣机','washer',enamelWasher,{placement:'floor',limitations:['机门、滚筒和面板为静态家具细节；不提供开机或洗衣动作。']}],
 ['linen-rail','晒着棉巾与条纹童装的窄轨晾衣架','drying_rack',balconyLinenRail,{placement:'floor',limitations:['作为一件独立家具摆放，衣物不能单独取下。']}],
 ['trailing-pothos','青釉盆垂藤绿萝','plant',makeTrailingPothos,{placement:'surface',limitations:['放在有开放前缘的层板上，让藤叶朝外；整盆可独立移动。']}],
 ['studio-board','书桌上的小小作品展','wall_art',makers.studioBoard,{placement:'wall',elevation:1.14,print_texture:'/models/materials/family-assembly-guide-v1.jpg'}],
 ['beech-clock','榉木指针挂钟','wall_art',makers.clock,{placement:'wall',elevation:1.62}],
 ['outing-hooks','挂着小帽和帆布袋的木挂钩','wall_art',makers.hooks,{placement:'wall',elevation:1.02}],
 ['game-dock','掌机底座与游戏卡盒','desktop',makers.game,{placement:'surface'}],
 ['robot-vacuum','奶油白扫地机','appliance',makers.vacuum,{limitations:['静态摆件，不会启动清扫']}],
 ['maple-table','圆角枫木家庭餐桌','dining_table',makers.table,top([1.74,.92],.734)],
 ['flax-mat','流苏亚麻餐垫','desktop',makers.runner,{placement:'surface',...top([.60,.51],.012)}],
 ['entry-landing','浅石色拼砖换鞋区','rug',makers.entryTile,top([1.23,.95],.014)],
 ['entry-memory','小家画框与钥匙碟','desktop',makers.entryMemory,{placement:'surface',print_texture:'/models/materials/family-picnic-v1.jpg'}],
 ['entry-door','橡木入户门','wall_art',makers.door,{placement:'wall',limitations:['装饰门，不通往另一个房间']}],
 ['shoe-cabinet','百叶窄鞋柜','sideboard',makers.cabinet,top([.79,.27],.878)],
 ['key-dish','钥匙与陶碟','desktop',makers.tray,{placement:'surface'}],
 ['entry-mat','燕麦色编织门垫','rug',makers.mat,top([.99,.61],.018)],
 ['blue-slippers','雾蓝室内拖鞋','desktop',g=>makers.slippers(g,'#778fac'),{placement:'surface'}],
 ['oat-slippers','燕麦色室内拖鞋','desktop',g=>makers.slippers(g,'#d4bf9f'),{placement:'surface'}],
 ['denim-pillow','雾蓝棉麻靠枕','desktop',makers.pillow,{placement:'surface'}],
 ['whale-plush','手缝小鲸鱼抱偶','desktop',makers.whale,{placement:'surface'}],
 ['fringed-throw','蓝灰流苏搭毯','desktop',makers.throw,{placement:'surface',support_offset:-.331}]
];
for(const [slug,label,kind,make,meta] of assets){
 if(process.argv[2]&&process.argv[2]!==slug)continue;
 const id='family-'+slug+'-v1',g=new T.Group();make(g);const box=new T.Box3().setFromObject(g,true),sz=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3());for(const item of g.children)item.position.sub(new T.Vector3(c.x,box.min.y,c.z));
 if(slug==='trailing-pothos'){
  // Keep the full foliage bounds for collisions. Only the pot needs to stand on the board.
  g.updateMatrixWorld(true);
  const tail=hangingBounds(['Trailing stems','Heart shaped foliage'].map(n=>g.getObjectByName(n)),.015-box.min.y);
  meta.support_offset=box.min.y;meta.ledge_mount={pot_center:[-c.x,-c.z],pot_radius:.084,tail:[tail.min.x,tail.min.y,tail.max.x,tail.max.y]};
  for(const name of ['urban-floating-shelf-v1','urban-floating-shelf-high-v1'])catalog[name].surfaces.top.front_edge=catalog[name].size[1]/2;
 }
 if(['enamel-washer','linen-rail'].includes(slug)){
  // Keep UVs for printed controls and cotton weave, not plain enamel or tubing.
  g.traverse(o=>{if(o.isMesh&&o.name!=='Wash fascia lettering'&&!o.material.vertexColors)o.geometry.deleteAttribute('uv')});
 }
 const source='Original local geometry: '+(slug==='trailing-pothos'?'tools/trailing-pothos.mjs':slug==='maple-dining-chair'?'tools/maple-chair.mjs':['linen-rail','enamel-washer'].includes(slug)?'tools/balcony-laundry.mjs':'tools/export-family-interior.mjs');
 const file='house3d/assets/furniture/'+id+'.glb',bytes=new Uint8Array(await new GLTFExporter().parseAsync(g,{binary:true}));writeFileSync(file,bytes);manifest.assets[file]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source};
 if(slug==='low-table')meta.surfaces.top.height=sz.y;
 const dim=n=>Math.ceil(n*1000)/1000;
 if(slug==='maple-library')meta.surfaces['shelf-5'].front_edge=dim(sz.z)/2;
 catalog[id]={label,kind,style:'urban-family-soft',model:'/models/furniture/'+id+'.glb',size:[dim(sz.x),dim(sz.z)],height:dim(sz.y),painted:false,recolorable:false,source_type:'native_geometry',native_materials:true,source,...meta};
}
// Same rail at adult shoulder height, clearing the keepsakes on the hall cabinet.
if(!process.argv[2]||process.argv[2]==='outing-hooks'||process.argv[2]==='entry-hooks'){
 catalog['family-entry-hooks-v1']={...catalog['family-outing-hooks-v1'],label:'玄关高挂帽袋架',elevation:1.34};
}
writeFileSync('runtime-assets.json',JSON.stringify(manifest,null,2)+'\n');writeFileSync('house3d/furniture-assets.json',JSON.stringify(catalog,null,2)+'\n');
