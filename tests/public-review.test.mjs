import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {inspectText,inspectPath,textPayload,imageMetadata} from '../tools/check-public.mjs';

test('public review reports rules and locations without echoing credential values',()=>{
 const credential='gh'+'p_'+'a'.repeat(36),text='first\n'+credential+'\npassword: "'+('real'+'credential')+'"';
 const result=inspectText(text);assert.ok(result.some(f=>f.rule==='github-token'&&f.line===2));assert.ok(result.some(f=>f.rule==='literal-credential'));
 assert.ok(!JSON.stringify(result).includes(credential));assert.ok(!JSON.stringify(result).includes('real'+'credential'));
 assert.deepEqual(inspectText('password: "example-password"\nAuthor: zanllp <qc@zanllp.cn>\nhttp://127.0.0.1:19130\nTripo task 01234567-89ab-cdef-0123-456789abcdef'),[]);
});
test('local paths are review items, not a rule to strip legitimate names and provenance',()=>{
 const result=inspectText('input="/'+['Users','somebody','private','model.glb'].join('/')+'"');
 assert.deepEqual(result.map(f=>[f.rule,f.review]),[['personal-absolute-path',true]]);
 assert.deepEqual(inspectText('https://studio.tripo3d.ai/zh/workspace/generate/model-id'),[]);
 const signed='https://example.com/model?X-Amz'+'-Signature='+('a'.repeat(32));assert.equal(inspectText(signed)[0].rule,'signed-download');
});
test('private output is rejected but public examples and generated runtime files are allowed',()=>{
 for(const p of ['.env','.env.production','artifacts/output.png','house3d/data/house.sqlite','cookies.json','.npmrc','capture.har','user.key','bundle.zip'])assert.ok(inspectPath(p),p);
 for(const p of ['.env.example','.env.sample','LICENSE','runtime/shared-ABC123.mjs','tests/python-contracts.json.gz','docs/examples/after-school.json'])assert.equal(inspectPath(p),null,p);
});
test('GLB metadata and gzip fixture text are checked without interpreting binary texture bytes',()=>{
 const value='sk-'+'a'.repeat(30),text=JSON.stringify({asset:{generator:value}}),b=Buffer.alloc(20+Buffer.byteLength(text)+12);
 b.write('glTF');b.writeUInt32LE(Buffer.byteLength(text),12);b.writeUInt32LE(0x4e4f534a,16);b.write(text,20);
 assert.equal(inspectText(textPayload(b,'model.glb'))[0].rule,'model-key');
 assert.equal(textPayload(gzipSync('fixture text'),'tests/cases.json.gz'),'fixture text');
 assert.equal(textPayload(Buffer.from([0,1,2,3]),'file.bin'),null);
 assert.equal(textPayload(Buffer.from('image bytes'),'image.jpg'),null);
});
test('JPEG EXIF checks report GPS/identity tags without modifying bytes',()=>{
 const t=Buffer.alloc(26);t.write('II');t.writeUInt16LE(42,2);t.writeUInt32LE(8,4);t.writeUInt16LE(1,8);t.writeUInt16LE(0x8825,10);
 const payload=Buffer.concat([Buffer.from('Exif\0\0'),t]),b=Buffer.alloc(payload.length+8);b[0]=255;b[1]=216;b[2]=255;b[3]=225;b.writeUInt16BE(payload.length+2,4);payload.copy(b,6);b[b.length-2]=255;b[b.length-1]=217;
 const before=Buffer.from(b);assert.deepEqual(imageMetadata(b),['gps-ifd']);assert.deepEqual(b,before);
});
test('public documentation marks finite plans and separates artwork from code licences',()=>{
 const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
 assert.match(read('README.md'),/执行完会停止/);assert.match(read('docs/OPEN_SOURCE.md'),/不能直接标成/);
 assert.match(read('docs/LICENSING.md'),/CC BY-NC-SA 4\.0/);assert.match(read('SECURITY.md'),/不是用户认证/);
 assert.match(read('tools/package.mjs'),/docs\/LICENSING\.md/);assert.match(read('.gitignore'),/cookies\.json/);
});
