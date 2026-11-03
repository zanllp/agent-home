import {PointLight,SpotLight} from 'three';

// The bulb, its target and the reflected fill stay in lamp-local coordinates.
// Each placed lamp owns its diffuser, so switching one off cannot darken another.
export function lightStudyDesk(instance,{on=true,brightness=.7}={}){
 const face=instance.getObjectByName('Task-light-diffuser'),intensity=on?brightness:0;
 const bulb=face.material.clone();face.material=bulb;bulb.emissive.set('#ffdfa3');bulb.emissiveIntensity=intensity*1.1;
 const beam=new SpotLight('#ffe2b1',intensity*1.24,1.45,.91,.74,2);
 beam.visible=intensity>0;beam.name='Reading pool';beam.position.copy(face.position);beam.position.y-=.007;
 beam.target.position.set(.25,.01,-.08);instance.add(beam,beam.target);
 const bounce=new PointLight('#ffd59b',intensity*.38,1.25,2);
 bounce.visible=intensity>0;bounce.name='Warm page reflection';bounce.position.set(.09,.25,-.025);instance.add(bounce);
 return ()=>{bulb.dispose();beam.dispose();bounce.dispose()};
}
