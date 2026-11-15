import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';

test('release size report lists concept previews separately and treats 100 MB as a target',()=>{
 const report=JSON.parse(execFileSync(process.execPath,['tools/check-release.mjs'],{encoding:'utf8'}));
 const dir='docs/images/concepts';
 const previews=readdirSync(dir).filter(f=>/\.(?:jpe?g|png|webp)$/.test(f));
 const bytes=previews.reduce((n,f)=>n+statSync(join(dir,f)).size,0);
 assert.equal(previews.length,4);
 assert.equal(report.concept_image_bytes,bytes);
 assert.equal(report.checkout_bytes-report.checkout_without_concepts_bytes,bytes);
 assert.equal(report.target_bytes,100_000_000);
 assert.equal(report.over_target_bytes,Math.max(0,report.checkout_bytes-report.target_bytes));
 assert.ok(report.runtime_assets_unchanged>0);
});
