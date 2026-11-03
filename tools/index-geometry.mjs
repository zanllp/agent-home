// Local authored geometry only. Reuse a vertex only when *every* attribute has identical bytes.
export function indexExactVertices(g){
 const entries=Object.entries(g.attributes),pos=g.attributes.position;
 if(g.index||!pos||Object.keys(g.morphAttributes).length)return false;
 if(entries.some(([,a])=>a.isInterleavedBufferAttribute||a.count!==pos.count))return false;
 const fields=entries.map(([name,a])=>({name,a,bytes:new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength),stride:a.itemSize*a.array.BYTES_PER_ELEMENT}));
 const width=fields.reduce((sum,f)=>sum+f.stride,0),lookup=new Map(),kept=[],indices=[];
 for(let i=0;i<pos.count;i++){
  let key='';for(const {bytes,stride} of fields)key+=String.fromCharCode(...bytes.subarray(i*stride,(i+1)*stride));
  let index=lookup.get(key);if(index===undefined){index=kept.length;lookup.set(key,index);kept.push(i)}
  indices.push(index);
 }
 if((pos.count-kept.length)*width<=indices.length*(kept.length>=65535?4:2))return false;
 for(const {name,a,bytes,stride} of fields){
  const out=new a.array.constructor(kept.length*a.itemSize),raw=new Uint8Array(out.buffer);
  kept.forEach((i,k)=>raw.set(bytes.subarray(i*stride,(i+1)*stride),k*stride));
  const next=a.clone();next.array=out;next.count=kept.length;g.setAttribute(name,next);
 }
 g.setIndex(indices);return true;
}
