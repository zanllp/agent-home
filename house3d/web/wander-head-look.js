import {Quaternion,Vector3,MathUtils} from 'three';

export function createHeadLook(head){
 const base=head.quaternion.clone(),offset=new Quaternion(),axis=new Vector3(0,1,0);
 return {
  // A zero-delta mixer may skip unchanged tracks. Remove our offset first.
  restore(){head.quaternion.copy(base)},
  apply(angle){
   base.copy(head.quaternion);
   offset.setFromAxisAngle(axis,MathUtils.clamp(angle,-.05,.05));
   head.quaternion.multiply(offset);
  },
 };
}
