import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createDryingRack,createFamilyDryingRack} from '../house3d/web/drying-rack.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.()})}};
const family=process.argv.includes('--family'),id=family?'family-laundry-rack-v2':'balcony-drying-rack-v1';
const buffer=await new GLTFExporter().parseAsync(family?createFamilyDryingRack():createDryingRack(),{binary:true});
const file='house3d/assets/furniture/'+id+'.glb',bytes=new Uint8Array(buffer);writeFileSync(file,bytes);
if(family){
 const path='runtime-assets.json',manifest=JSON.parse(readFileSync(path));manifest.assets[file]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'Original local geometry: house3d/web/drying-rack.js'};writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
}
