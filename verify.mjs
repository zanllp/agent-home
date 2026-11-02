import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const packaged = new URL('package-manifest.json', root);
const manifest = JSON.parse(readFileSync(existsSync(packaged) ? packaged : new URL('runtime-assets.json', root), 'utf8'));
const files = manifest.files || manifest.assets;
for (const [name, expected] of Object.entries(files)) {
  const bytes = readFileSync(new URL(name, root));
  if (bytes.length !== expected.bytes || createHash('sha256').update(bytes).digest('hex') !== expected.sha256) {
    throw Error('Integrity check failed: ' + name);
  }
}
console.log(`Verified ${Object.keys(files).length} files. No files were changed.`);
