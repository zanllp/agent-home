import {writeFileSync} from 'node:fs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createDryingRack} from '../house3d/web/drying-rack.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.()})}};
const buffer=await new GLTFExporter().parseAsync(createDryingRack(),{binary:true});
writeFileSync('house3d/assets/furniture/balcony-drying-rack-v1.glb',new Uint8Array(buffer));
