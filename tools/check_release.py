"""Verify runtime asset integrity and the tracked checkout size budget."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'runtime-assets.json').read_text())['assets']
for name,expected in manifest.items():
 p=root/name
 if not p.is_file() or p.stat().st_size!=expected['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=expected['sha256']:
  raise SystemExit('Runtime asset differs from verified full-project copy: '+name)
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).split(b'\0')
size=sum((root/f.decode()).stat().st_size for f in files if f)
if size>=100_000_000:raise SystemExit(f'Tracked size exceeds 100 MB budget: {size}')
print(json.dumps({'tracked_bytes':size,'tracked_MB':round(size/1e6,2),'runtime_assets_unchanged':len(manifest),'budget_bytes':100_000_000},indent=2))
