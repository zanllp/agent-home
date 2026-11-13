import * as T from 'three';
// One original model for the placed can and the carried copy.
export function createWateringCan(){
 const root=new T.Group(),mint=new T.MeshStandardMaterial({color:'#8fb6b1',roughness:.44,metalness:.06,side:T.DoubleSide}),cream=new T.MeshStandardMaterial({color:'#f1dfb5',roughness:.55,side:T.DoubleSide});
 const add=(name,g,m,p)=>{const o=new T.Mesh(g,m);o.name=name;o.position.set(...p);o.castShadow=o.receiveShadow=true;root.add(o);return o};
 add('Round belly',new T.SphereGeometry(.105,20,12),mint,[0,.12,0]).scale.set(1,1.02,.8);
 add('Flat base',new T.CylinderGeometry(.072,.069,.025,20),mint,[0,.024,0]);
 add('Filling rim',new T.TorusGeometry(.041,.006,6,20),cream,[0,.218,0]).rotation.x=Math.PI/2;
 add('Water surface',new T.CircleGeometry(.039,20),new T.MeshStandardMaterial({color:'#436b76',roughness:.25,side:T.DoubleSide}),[0,.217,0]).rotation.x=-Math.PI/2;
 const spout=new T.CatmullRomCurve3([new T.Vector3(.072,.085,0),new T.Vector3(.13,.12,0),new T.Vector3(.18,.20,0)]);
 add('Long spout',new T.TubeGeometry(spout,12,.014,7,false),mint,[0,0,0]);
 add('Sprinkler rose',new T.CylinderGeometry(.028,.019,.018,14),cream,[.184,.207,0]).rotation.z=-.65;
 const loop=new T.CatmullRomCurve3([[-.061,.18,0],[-.158,.19,0],[-.163,.082,0],[-.073,.062,0]].map(p=>new T.Vector3(...p)));
 add('Loop handle',new T.TubeGeometry(loop,20,.013,7,false),cream,[0,0,0]);
 return root;
}
