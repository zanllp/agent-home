import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Preserve the binary vertices, animations and bind data without a browser image decoder.
export function geometryOnly(name){
 const raw=readFileSync('house3d/assets/'+name+'.glb'),n=raw.readUInt32LE(12);
 const doc=JSON.parse(raw.subarray(20,20+n));
 for(const m of doc.materials)delete m.pbrMetallicRoughness?.baseColorTexture;
 const json=Buffer.from(JSON.stringify(doc)),pad=(4-json.length%4)%4;
 const buf=Buffer.concat([raw.subarray(0,20),json,Buffer.alloc(pad,32),raw.subarray(20+n)]);
 buf.writeUInt32LE(buf.length,8);buf.writeUInt32LE(json.length+pad,12);
 return new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.length),'');
}
