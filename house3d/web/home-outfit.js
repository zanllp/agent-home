import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {usePaintedCharacter} from './character-material.js';
import {rebindPack,tryOn} from './outfit-fit.js';

import wardrobe from '../../modeling/wardrobe/manifest.json' with {type:'json'};
const files=new Map(wardrobe.outfits.map(({id,file})=>[id,file.split('/').pop()]));
function disposePack(group){group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.map?.dispose();o.material.dispose()}})}

// Called by the serialized state poll. Only download a garment when first worn.
export function homeOutfit(model,floorPlay,invalidate){
 let id='reference',worn=null,disposed=false;const packs=new Map();
 function release(){worn?.remove();worn=null;floorPlay.setReferenceClothes(true)}
 return {
  get current(){return id},
  async apply(next='reference'){
   if(disposed||id===next)return;
   if(next!=='reference'){
    if(!files.has(next))throw Error('未知的套装');
    if(!packs.has(next)){
     const {scene}=await new GLTFLoader().loadAsync('/models/outfits/'+files.get(next));
     usePaintedCharacter(scene);if(disposed){disposePack(scene);return}
     packs.set(next,rebindPack(model,scene));
    }
   }
   // Restore original hand/chin geometry before masking it for the next garment.
   release();
   if(next!=='reference'){floorPlay.setReferenceClothes(false);worn=tryOn(model,packs.get(next),true)}
   id=next;invalidate();
  },
  dispose(){disposed=true;release();for(const pack of packs.values())disposePack(pack);packs.clear()}
 };
}
