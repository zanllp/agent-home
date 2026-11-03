import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const material=(color,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness,side:T.DoubleSide});
function box(root,name,size,p,m,r=.006){const o=new T.Mesh(new RoundedBoxGeometry(...size,3,Math.min(r,Math.min(...size)/3)),m);o.name=name;o.position.set(...p);root.add(o);return o}
function cylinder(root,name,r1,r2,h,p,m,n=24){const o=new T.Mesh(new T.CylinderGeometry(r1,r2,h,n),m);o.name=name;o.position.set(...p);root.add(o);return o}
function rod(root,name,a,b,r,m){const v=new T.Vector3(...b).sub(new T.Vector3(...a)),o=cylinder(root,name,r,r,v.length(),new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5).toArray(),m,16);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o}
function tube(root,name,points,r,m){const o=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),32,r,8,false),m);o.name=name;root.add(o);return o}
function finish(root){root.traverse(o=>{if(o.isMesh){o.geometry?.normalizeNormals();o.castShadow=true;o.receiveShadow=true}});return root}
function table(child){
 const root=new T.Group(),w=child?1.095618724822998:1.2999999523162842,d=child?.6925340294837952:.6589042544364929,h=child?.6324999928474426:.6131115555763245;
 root.name=child?'Detailed-child-desk':'Detailed-work-desk';
 const oak=material('#d8ba94',.64),edge=material('#b6946c',.7),white=material('#e4e5dd',.55),steel=material('#b4bbb4',.4,.35),dark=material('#606b68',.65),blue=material('#a9c0c5',.6),paper=material('#ece5d7');
 box(root,'Wood-tabletop',[w,.038,d],[0,h-.019,0],oak,.013);
 box(root,'Wood-edge-inlay',[w-.018,.003,d-.018],[0,h-.032,0],edge,.001);
 box(root,'Under-desk-apron',[w-.13,.065,.028],[0,h-.09,-d/2+.055],white);
 for(const x of [-w/2+.045,w/2-.045]){
  for(const z of [-d/2+.065,d/2-.065]){
   const leg=cylinder(root,'Round-telescoping-leg',.018,.018,h-.075,[x,(h-.075)/2+.013,z],white);
   cylinder(root,'Leg-adjustment-collar',.022,.022,.026,[x,.21,z],child?blue:steel);
   cylinder(root,'Rubber-foot',.023,.023,.013,[x,.0065,z],dark);
   cylinder(root,'Leg-inner-section',.014,.014,.18,[x,.11,z],steel);
  }
  box(root,'Foot-cross-brace',[.025,.027,d-.11],[x,.05,0],white);
 }
 // Storage remains within the declared footprint and leaves the central knee space clear.
 const dx=child?-w/2+.145:w/2-.145,cw=child?.20:.20,base=.065,top=h-.075;
 box(root,'Drawer-cabinet',[cw,top-base,d-.14],[dx,(base+top)/2,-.025],white,.008);
 const heights=child?[.12,.12,.18]:[.075,.075,.16];let y=top-.015;
 for(const height of heights){y-=height;box(root,'Drawer-front',[cw-.012,height-.009,.013],[dx,y+height/2,d/2-.087],paper,.004);box(root,'Drawer-pull',[cw*.41,.012,.014],[dx,y+height*.68,d/2-.074],child?blue:dark,.004)}
 box(root,'Cable-tray',[w*.5,.035,.115],[0,h-.102,-d/2+.075],dark,.004);
 for(const x of [-.16,-.08,0,.08,.16])box(root,'Cable-tray-slot',[.034,.001,.055],[x,h-.083,-d/2+.075],steel,.001);
 if(child){
  box(root,'Study-front-edge',[w-.025,.012,.019],[0,h-.018,d/2-.010],blue,.004);
  for(const x of [dx-.065,dx+.065])for(const z of [-.20,.15]){
   rod(root,'Cabinet-caster-fork',[x,.068,z],[x,.034,z],.008,steel);
   const wheel=cylinder(root,'Cabinet-caster',.025,.025,.018,[x,.028,z],dark,24);wheel.rotation.z=Math.PI/2;
  }
  tube(root,'Schoolbag-hook',[[.42,.589,.278],[.42,.569,.298],[.42,.569,.318],[.42,.589,.324]],.004,steel);
  for(const x of [-w/2+.045,w/2-.045]){const bolt=cylinder(root,'Height-adjustment-button',.010,.010,.005,[x,.31,d/2-.041],blue,20);bolt.rotation.x=Math.PI/2}
 }else{
  for(const x of [-.36,.36]){const ring=new T.Mesh(new T.TorusGeometry(.015,.003,8,24),dark);ring.name='Cable-grommet';ring.rotation.x=-Math.PI/2;ring.position.set(x,h+.0001,-d/2+.045);root.add(ring)}
 }
 return finish(root);
}
function mug(){const g=new T.Group(),ceramic=material('#bccdd1',.25),rim=material('#e4e8df',.3),coffee=material('#634b38',.24);g.name='Ceramic-work-mug';const profile=[[0,0],[.023,0],[.029,.006],[.033,.064],[.034,.074],[.031,.078],[.028,.074],[.028,.014],[0,.014]].map(p=>new T.Vector2(...p));const body=new T.Mesh(new T.LatheGeometry(profile,40),ceramic);body.name='Mug-ceramic';body.position.x=-.006;g.add(body);const handle=new T.Mesh(new T.TorusGeometry(.019,.005,12,36,Math.PI*1.55),ceramic);handle.name='Mug-handle';handle.rotation.z=-Math.PI*.775;handle.position.set(.026,.042,0);g.add(handle);const drink=cylinder(g,'Coffee-surface',.0275,.0275,.001,[-.006,.060,0],coffee,40);drink.castShadow=false;g.scale.setScalar(1.1);return finish(g)}
function notebook(){const g=new T.Group(),cover=material('#718d99',.82),paper=material('#e9e4d6',.98),gold=material('#c7aa77',.55);g.name='Cloth-work-notebook';box(g,'Notebook-back-cover',[.24,.002,.13],[0,.001,0],cover,.003);box(g,'Notebook-pages',[.232,.012,.124],[.002,.008,0],paper,.002);box(g,'Notebook-cloth-cover',[.24,.003,.13],[0,.0155,0],cover,.003);for(const y of [.005,.007,.009,.011])box(g,'Notebook-page-edge',[.225,.0005,.0008],[.003,y,.0625],gold,.0001);box(g,'Notebook-elastic',[.006,.001,.129],[.083,.0175,0],gold,.0004);box(g,'Notebook-bookmark',[.008,.001,.03],[-.025,.003,.064],cover,.0003);return finish(g)}
function plant(){const g=new T.Group(),pot=material('#e3ded1',.65),soil=material('#655540',1),stem=material('#7b9153',.9),green=[material('#789756',.8),material('#98ad6d',.8),material('#5e824b',.78)];g.name='Potted-desk-plant';const profile=[[0,0],[.031,0],[.038,.051],[.04,.055],[.035,.057],[.032,.012],[0,.012]].map(p=>new T.Vector2(...p));const mesh=new T.Mesh(new T.LatheGeometry(profile,36),pot);mesh.name='Ceramic-planter';g.add(mesh);cylinder(g,'Plant-soil',.033,.033,.003,[0,.050,0],soil,32);
 for(let i=0;i<11;i++){const angle=i*2.399,r=.018+(i%3)*.008,y=.095+(i%4)*.019,end=[Math.cos(angle)*r,y,Math.sin(angle)*r];rod(g,'Plant-stem',[0,.051,0],end,.0013,stem);
  const geom=new T.PlaneGeometry(.045,.064,10,14),p=geom.attributes.position;for(let j=0;j<p.count;j++){const v=(p.getY(j)+.032)/.064,u=p.getX(j)/.0225;p.setXYZ(j,p.getX(j)*Math.max(0,Math.sin(Math.PI*Math.max(0,Math.min(1,v))))**.65,p.getY(j),.007*(1-u*u)*Math.sin(Math.PI*v))}geom.computeVertexNormals();const leaf=new T.Mesh(geom,green[i%3]);leaf.name='Curved-plant-leaf';leaf.position.set(...end);leaf.rotation.set(-.5,angle,Math.sin(angle)*.65);g.add(leaf)}return finish(g)}
function organizer(){
 const g=new T.Group(),wood=material('#d2b995'),white=material('#ede8dd',.6),blue=material('#a7bec7'),pink=material('#c89b86'),paper=material('#f7eed8');g.name='Study-desk-organizer';
 box(g,'Wood-organizer-base',[.18,.008,.095],[0,.004,0],wood);
 box(g,'Organizer-back',[.18,.072,.006],[0,.043,-.0445],white,.002);
 for(const x of [-.087,.087])box(g,'Organizer-side',[.006,.072,.089],[x,.043,0],white,.002);
 box(g,'Organizer-middle-shelf',[.174,.004,.089],[0,.046,0],white,.001);
 for(const [x,w] of [[-.052,.066],[.035,.095]]){box(g,'Organizer-drawer-front',[w,.026,.005],[x,.029,.043],blue,.002);box(g,'Organizer-drawer-front',[w,.026,.005],[x,.060,.043],white,.002);for(const y of [.031,.062])box(g,'Organizer-cutout-pull',[.019,.004,.001],[x,y,.046],wood,.001)}
 box(g,'Wood-organizer-top',[.18,.006,.095],[0,.082,0],wood);
 for(const x of [-.071,-.026])box(g,'File-holder-side',[.004,.075,.067],[x,.122,-.010],wood,.002);
 box(g,'File-holder-back',[.049,.075,.005],[-.048,.122,-.041],wood,.001);box(g,'File-holder-front',[.049,.047,.005],[-.048,.108,.021],wood,.002);
 for(let i=0;i<3;i++){const note=box(g,'Organizer-postcard',[.034,.068,.002],[-.048,.138+i*.003,-.018+i*.007],i%2?blue:paper,.0004);note.rotation.z=(i-1)*.09}
 const calendar=box(g,'Desk-calendar-paper',[.049,.055,.002],[.044,.119,.015],paper,.001);calendar.rotation.x=-.18;
 rod(g,'Calendar-easel',[.023,.085,-.027],[.023,.145,.006],.002,white);rod(g,'Calendar-easel',[.065,.085,-.027],[.065,.145,.006],.002,white);
 const sticker=new T.Mesh(new T.CircleGeometry(.008,24),pink);sticker.name='Organizer-round-sticker';sticker.position.set(.069,.058,.046);g.add(sticker);return finish(g);
}
function board(){const g=new T.Group(),wood=material('#c5ac86'),cork=material('#c4b292',1),paper=material('#f3eee0',1),blue=material('#b7cbd0'),gold=material('#c5a265');g.name='Family-study-pinboard';box(g,'Pinboard-frame',[.48,.42,.025],[0,.21,0],wood,.007);box(g,'Cork-board',[.455,.395,.006],[0,.21,.015],cork,.004);for(const [name,w,h,x,y,m] of [['Calendar-paper',.17,.23,-.105,.22,paper],['Drawing-postcard',.19,.13,.105,.30,paper],['Small-study-note',.12,.09,.09,.115,blue]]){const note=box(g,name,[w,h,.001],[x,y,.020],m,.0002);note.rotation.z=name==='Drawing-postcard'?-.05:.025;const pin=cylinder(g,'Pinboard-pin',.005,.005,.004,[x,y+h/2-.012,.024],gold,12);pin.rotation.x=Math.PI/2}return finish(g)}
export function createDeskAsset(id){return ({'urban-dual-monitor-detailed-v1':()=>{const g=monitorKit();g.position.z=-.008;return g},'urban-workdesk-detailed-v1':()=>table(false),'urban-child-desk-detailed-v1':()=>table(true),'urban-ceramic-mug-v1':mug,'urban-work-notebook-v1':notebook,'urban-desk-plant-v1':plant,'urban-study-organizer-v1':organizer,'urban-study-pinboard-v1':board,'urban-picture-book-v1':pictureBook,'urban-storybooks-v1':storyBooks,'urban-school-bottle-v1':schoolBottle,'urban-marker-cup-v1':markerCup,'urban-pencil-jar-v1':pencilJar,'urban-schoolbag-v1':schoolbag,'urban-pocket-notebook-v1':()=>{const g=notebook();g.scale.setScalar(.66);return g}})[id]?.()??null}

export function keyboardLayout(){const rows=[['esc','1','2','3','4','5','6','7','8','9','0','−','=','⌫'],['tab','Q','W','E','R','T','Y','U','I','O','P','[',']'],['caps','A','S','D','F','G','H','J','K','L',';',"'",'↵'],['shift','Z','X','C','V','B','N','M',',','.','/','↑'],['ctrl','fn','⌘','alt','space','alt','←','↓','→']];const result=[];for(let row=0;row<rows.length;row++){let x=-.168;for(const text of rows[row]){const width=text==='space'?.115:['shift','caps','tab','ctrl','⌫','↵'].includes(text)?.029:.022;result.push({text,x:x+width/2,z:-.05+row*.022,width:width-.002,depth:.019});x+=width}}return result}
function monitorKit(){
 const g=new T.Group(),shell=material('#374441',.47,.15),metal=material('#76847f',.4,.3),key=material('#d9ddd3',.7),rubber=material('#7c918b',.96),screen=material('#22323b',.6);g.name='Refined-monitor-kit';box(g,'Desk-felt-mat',[.70,.003,.18],[-.03,.0015,.108],rubber,.012);
 for(const [i,cx,cy,w,h] of [[0,-.1725,.388,.56,.33],[1,.3375,.428,.23,.41]]){box(g,'Monitor-back',[w,h,.028],[cx,cy,-.077],shell,.008);const face=box(g,i?'Blue_screen001':'Blue_screen',[w-.02,h-.02,.003],[cx,cy,-.0615],screen,.003);face.castShadow=false;box(g,'Monitor-lower-bezel',[w-.012,.012,.003],[cx,cy-h/2+.009,-.0605],shell,.002);const led=cylinder(g,'Monitor-power-indicator',.0015,.0015,.001,[cx+w/2-.025,cy-h/2+.01,-.0585],material('#aec6ad',.3),10);led.rotation.x=Math.PI/2;
 rod(g,'Monitor-VESA-arm',[cx,cy,-.095],[cx,.16,-.15],.010,metal);rod(g,'Monitor-stand-post',[cx,.026,-.15],[cx,.23,-.15],.012,metal);box(g,'Monitor-clamp',[.065,.024,.064],[cx,.012,-.15],shell,.006);
 tube(g,'Monitor-cable',[[cx,cy-.05,-.096],[cx+.02,.18,-.16],[cx+.035,.01,-.16]],.0027,shell)}
 const keyboardX=-.13,keyboardZ=.12,body=box(g,'Keyboard-body',[.36,.014,.128],[keyboardX,.010,keyboardZ],shell,.006),keys=[];
 for(const k of keyboardLayout()){const geo=new RoundedBoxGeometry(k.width,.006,k.depth,2,.002);geo.translate(keyboardX+k.x,.021,keyboardZ+k.z);keys.push(geo)}const merged=mergeGeometries(keys);keys.forEach(geo=>geo.dispose());const caps=new T.Mesh(merged,key);caps.name='Individual-keycaps';g.add(caps);
 const mouse=new T.Mesh(new T.SphereGeometry(1,28,18),shell);mouse.name='Mouse-body';mouse.scale.set(.026,.014,.043);mouse.position.set(.25,.015,.12);g.add(mouse);box(g,'Mouse-split',[.0008,.0007,.026],[.25,.029,.105],metal,.0002);const wheel=cylinder(g,'Mouse-wheel',.003,.003,.010,[.25,.028,.102],metal,16);wheel.rotation.z=Math.PI/2;
 return finish(g);
}
export function createStudyLamp(adjustable=false){
 const g=new T.Group(),white=material('#e6e7de',.45),metal=material('#9eaca6',.4,.25),light=new T.MeshStandardMaterial({color:'#fff5dc',emissive:'#ffe0a1',emissiveIntensity:adjustable?0:.8,roughness:.6,side:T.DoubleSide});
 const elbow=adjustable?.27:.18,tip=adjustable?.426:.29,h=tip+.023;
 g.name='Articulated-study-lamp';cylinder(g,'Lamp-base',.060,.064,.015,[-.075,.0075,0],white,40);
 cylinder(g,'Lamp-base-ring',.058,.06,.003,[-.075,.016,0],metal,40);
 for(const [a,b] of [[[-.078,.02,0],[-.085,elbow,0]],[[-.085,elbow,0],[.065,tip,0]]]){
  rod(g,'Lamp-arm',a,b,.007,white);rod(g,'Lamp-arm-link',[a[0]-.013,a[1],a[2]],[b[0]-.013,b[1],b[2]],.003,metal);
 }
 for(const p of [[-.078,.022,0],[-.085,elbow,0],[.065,tip,0]]){
  const joint=cylinder(g,'Lamp-hinge',.013,.013,.019,p,white);joint.rotation.x=Math.PI/2;const screw=cylinder(g,'Lamp-hinge-screw',.004,.004,.021,p,metal,16);screw.rotation.x=Math.PI/2;
 }
 cylinder(g,'Task-light-head',.061,.058,.017,[.065,h,0],white,40);
 const diffuser=cylinder(g,'Task-light-diffuser',.052,.052,.001,[.065,h-.009,0],light,40);
 box(g,'Lamp-switch',[.015,.002,.008],[-.075,.017,.024],metal,.002);
 if(!adjustable){const pool=new T.PointLight('#ffe1a6',.06,.65,2);pool.name='Warm-task-light';pool.position.set(.065,h-.021,0);g.add(pool)}
 finish(g);diffuser.castShadow=false;return g;
}
function pencilCup(){const g=new T.Group(),cup=material('#adc3ca',.5),wood=material('#d1b592',.9);g.name='Hollow-pencil-cup';const profile=[[0,0],[.031,0],[.034,.004],[.035,.085],[.032,.09],[.029,.085],[.028,.012],[0,.012]].map(p=>new T.Vector2(...p));const body=new T.Mesh(new T.LatheGeometry(profile,32),cup);body.name='Hollow-pencil-holder';g.add(body);for(let i=0;i<7;i++){const a=i*2.399,r=i===6?0:.018,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.107+(i%3)*.014,color=material(['#d86f55','#61a297','#d6b13b','#87a455','#ac7d9c','#dc9559','#6b9dc0'][i]);cylinder(g,'Painted-pencil',.003,.003,h,[x,.025+h/2,z],color,6);cylinder(g,'Sharpened-wood-tip',0,.003,.010,[x,.025+h+.005,z],wood,6);cylinder(g,'Pencil-pigment-tip',0,.0011,.004,[x,.025+h+.011,z],color,6)}return finish(g)}
function workbook(){const g=new T.Group(),cover=material('#aebdb0'),paper=material('#f1ebdc',.98);g.name='Open-illustrated-workbook';box(g,'Workbook-cover',[.27,.002,.18],[0,.001,0],cover,.003);for(const sign of [-1,1]){box(g,'Workbook-page-stack',[.131,.008,.174],[sign*.067,.006,0],paper,.002);const geometry=new T.PlaneGeometry(.131,.174,20,2),p=geometry.attributes.position;for(let i=0;i<p.count;i++){const u=(p.getX(i)+.0655)/.131;p.setZ(i,.0025*Math.sin(Math.PI*u))}geometry.computeVertexNormals();const page=new T.Mesh(geometry,paper);page.name=sign<0?'Workbook-page-left':'Workbook-page-right';page.rotation.x=-Math.PI/2;page.position.set(sign*.067,.0105,0);g.add(page)}return finish(g)}

function pictureBook(){
 const g=new T.Group(),paper=material('#f4e8d0',.95),cover=material('#789a83',.7);g.name='Garden-picture-book';
 box(g,'Picturebook-cover',[.42,.003,.24],[0,.0015,0],cover,.002);
 for(const sign of [-1,1]){
  box(g,'Picturebook-page-block',[.202,.009,.232],[sign*.104,.0075,0],paper,.001);
  for(let i=0;i<5;i++)box(g,'Picturebook-page-edge',[.199,.0004,.0008],[sign*.104,.004+i*.0015,.1164],material(i%2?'#e1ceb0':'#fff4dd'),.0001);
  const geom=new T.PlaneGeometry(.202,.232,28,6),p=geom.attributes.position;
  for(let i=0;i<p.count;i++){const u=(p.getX(i)+.101)/.202;p.setZ(i,.004*Math.sin(Math.PI*u))}geom.computeVertexNormals();
  const page=new T.Mesh(geom,paper);page.name=sign<0?'Picturebook-page-left':'Picturebook-page-right';page.rotation.x=-Math.PI/2;page.position.set(sign*.104,.012,0);page.castShadow=false;g.add(page);
 }
 box(g,'Picturebook-cloth-spine',[.004,.001,.234],[0,.010,0],cover,.0003);return finish(g);
}
function storyBooks(){
 const g=new T.Group(),paper=material('#eee4cc',.96),colors=['#d99567','#90aaa0','#80a4b9','#c3af71'];g.name='Well-loved-storybooks';
 for(let i=0;i<4;i++){
  const b=new T.Group();b.position.set((i%2)*.004-.002,.002+i*.015,.012);b.rotation.y=(i%2?1:-1)*.025;
  const m=material(colors[i],.73);box(b,'Storybook-pages',[.199,.010,.129],[.002,.006,0],paper,.001);
  for(const y of [.001,.013])box(b,'Storybook-cover',[.208,.002,.139],[0,y,0],m,.001);
  box(b,'Storybook-spine',[.005,.014,.137],[-.102,.007,0],m,.001);g.add(b);
 }
 for(let i=0;i<3;i++){
  const b=new T.Group();b.position.set(-.059+i*.037,.065,-.031);b.rotation.z=(i-1)*.035;
  const m=material(colors[(i+1)%4],.7);box(b,'Standing-book-pages',[.025,.147,.083],[0,.078,0],paper,.001);
  for(const x of [-.014,.014])box(b,'Standing-book-cover',[.003,.157,.089],[x,.079,0],m,.001);
  box(b,'Standing-book-spine',[.030,.156,.005],[0,.079,.042],m,.001);
  box(b,'Storybook-title-label',[.018,.058,.001],[0,.092,.045],paper,.0003);g.add(b);
 }
 return finish(g);
}
function schoolBottle(){
 const g=new T.Group(),blue=material('#91b8cd',.32),cream=material('#f0eadc',.4),dark=material('#647f92',.5);g.name='School-water-bottle';
 cylinder(g,'Bottle-body',.030,.032,.139,[0,.074,0],blue,40);cylinder(g,'Bottle-base',.032,.032,.010,[0,.005,0],cream,40);
 cylinder(g,'Bottle-shoulder',.023,.030,.018,[0,.1525,0],blue,40);cylinder(g,'Bottle-cap',.025,.025,.023,[0,.173,0],cream,32);
 tube(g,'Bottle-carry-loop',[[-.019,.182,0],[-.019,.204,0],[.019,.204,0],[.019,.182,0]],.003,dark);
 const badge=new T.Mesh(new T.SphereGeometry(.013,20,12),cream);badge.name='Bottle-flower-badge';badge.scale.set(1,1,.1);badge.position.set(0,.098,.030);g.add(badge);return finish(g);
}
function markerCup(){
 const g=new T.Group(),blue=material('#9bbbc6',.48);g.name='Short-marker-cup';
 const profile=[[0,0],[.024,0],[.027,.003],[.027,.062],[.024,.065],[.021,.061],[.021,.008],[0,.008]].map(p=>new T.Vector2(...p));
 const body=new T.Mesh(new T.LatheGeometry(profile,32),blue);body.name='Marker-cup';g.add(body);
 for(let i=0;i<7;i++){const a=i*2.399,r=i===6?0:.015,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.074+(i%3)*.006,m=material(['#db7360','#69a193','#dcba5e','#6c9aba','#bc86a1','#d69859','#8b9e64'][i]);cylinder(g,'Marker-barrel',.0035,.0035,h,[x,.022+h/2,z],m,12);cylinder(g,'Marker-cap',.004,.004,.014,[x,.022+h-.007,z],m,12);box(g,'Marker-cap-clip',[.002,.011,.002],[x+.004,.022+h-.009,z],material('#eee7da'),.0004)}return finish(g);
}
function pencilJar(){
 const g=new T.Group(),glass=material('#dae0cc',.17),wood=material('#c5a477',.6),label=material('#f3dfb3');g.name='Small-stationery-jar';
 // Opaque frosted glass avoids sorting artifacts with the small objects inside.
 cylinder(g,'Frosted-jar',.023,.022,.065,[0,.033,0],glass,32);cylinder(g,'Jar-lid',.024,.024,.010,[0,.071,0],wood,32);
 box(g,'Jar-paper-label',[.026,.028,.001],[0,.035,.023],label,.002);for(let i=0;i<3;i++){const bead=new T.Mesh(new T.SphereGeometry(.003,12,8),material(['#d5a060','#b3a074','#c58d78'][i]));bead.position.set(-.007+i*.007,.037,.024);g.add(bead)}return finish(g);
}
function schoolbag(){
 const g=new T.Group(),blue=material('#607fa8',.87),pink=material('#c5898d',.8),piping=material('#e0b3a7',.7),dark=material('#405878',.86),gold=material('#c7a469',.4,.25),cream=material('#e9cfa1',.95);g.name='Hanging-schoolbag';
 box(g,'Backpack-main',[.170,.226,.086],[0,.119,-.010],blue,.024);box(g,'Backpack-front-pocket',[.134,.114,.025],[0,.072,.043],blue,.012);
 box(g,'Backpack-top-flap',[.156,.060,.014],[0,.208,.037],blue,.018);
 tube(g,'Backpack-pocket-piping',[[-.066,.020,.058],[-.066,.122,.058],[0,.132,.058],[.066,.122,.058],[.066,.020,.058]],.0025,piping);
 tube(g,'Backpack-flap-piping',[[-.075,.218,.047],[-.071,.184,.047],[0,.179,.047],[.071,.184,.047],[.075,.218,.047]],.002,piping);
 tube(g,'Backpack-carry-handle',[[-.028,.231,-.004],[-.029,.286,-.004],[.029,.286,-.004],[.028,.231,-.004]],.005,pink);
 for(const x of [-.048,.048]){tube(g,'Backpack-shoulder-strap',[[x,.22,-.045],[x,.15,-.056],[x,.04,-.047]],.008,dark);box(g,'Backpack-zip-pull',[.005,.017,.003],[x,.124,.062],gold,.001)}
 box(g,'Backpack-side-pocket',[.015,.09,.065],[-.081,.075,-.008],pink,.005);
 const charm=new T.Group();charm.position.set(.020,.071,.066);rod(g,'Puppy-charm-chain',[.020,.153,.061],[.020,.102,.066],.0015,gold);
 const blob=(name,r,pos,scale,m)=>{const o=new T.Mesh(new T.SphereGeometry(r,24,16),m);o.name=name;o.position.set(...pos);o.scale.set(...scale);charm.add(o)};
 blob('Puppy-charm-head',.024,[0,0,0],[1,.9,.4],cream);for(const x of [-.023,.023])blob('Puppy-charm-ear',.014,[x,-.002,-.002],[.5,1.1,.45],cream);
 for(const x of [-.008,.008])blob('Puppy-charm-eye',.002,[x,.004,.009],[1,1,.5],dark);blob('Puppy-charm-nose',.003,[0,-.004,.010],[1,.7,.5],dark);blob('Puppy-charm-body',.017,[0,-.030,-.002],[.8,1,.4],cream);g.add(charm);return finish(g);
}
export function createStudyProp(model){const id=model.split('/').at(-1)?.replace('.glb','');return ({'urban-dual-monitor-kit-v1':monitorKit,'urban-study-lamp-v1':createStudyLamp,'urban-pencil-cup-v1':pencilCup,'urban-workbook-v1':workbook})[id]?.()??null}
