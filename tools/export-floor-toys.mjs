import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createFloorToys} from '../house3d/web/floor-toys.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.()})}};
const path='house3d/assets/furniture/floor-robot-kit-v1.glb',bytes=new Uint8Array(await new GLTFExporter().parseAsync(createFloorToys(),{binary:true}));
writeFileSync(path,bytes);const manifest=JSON.parse(readFileSync('runtime-assets.json'));
manifest.assets[path]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'Original local geometry: house3d/web/floor-toys.js'};
writeFileSync('runtime-assets.json',JSON.stringify(manifest,null,2)+'\n');
