import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createDeskAsset} from '../house3d/web/desk-models.js';
// Development-only exporter; the runtime serves the resulting GLBs without npm.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.()})}};
const assets=JSON.parse(readFileSync('house3d/furniture-assets.json')),manifest=JSON.parse(readFileSync('runtime-assets.json'));
for(const id of ['urban-dual-monitor-detailed-v1','urban-workdesk-detailed-v1','urban-child-desk-detailed-v1','urban-ceramic-mug-v1','urban-work-notebook-v1','urban-desk-plant-v1','urban-study-organizer-v1','urban-study-pinboard-v1',...Object.keys(assets).filter(id=>id.startsWith('urban-')&&['urban-picture-book-v1','urban-storybooks-v1','urban-school-bottle-v1','urban-marker-cup-v1','urban-pencil-jar-v1','urban-schoolbag-v1','urban-pocket-notebook-v1'].includes(id))]){
 const model=createDeskAsset(id),buffer=await new GLTFExporter().parseAsync(model,{binary:true}),bytes=new Uint8Array(buffer),path='house3d/assets/furniture/'+id+'.glb';writeFileSync(path,bytes);manifest.assets[path]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'New local native geometry; house3d/web/desk-models.js'};console.log(id,bytes.length);
}
writeFileSync('runtime-assets.json',JSON.stringify(manifest,null,2)+'\n');
