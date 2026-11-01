"""Agent CLI. No model or DSH dependency. Outputs JSON."""
import argparse,json,time,uuid,urllib.request,urllib.error,urllib.parse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('tool');p.add_argument('arguments',nargs='?',default='{}');p.add_argument('--url',default='http://127.0.0.1:19130');p.add_argument('--id');p.add_argument('--revision',type=int);p.add_argument('--output',type=Path,help='Wait for a screenshot and save its PNG locally');a=p.parse_args()
if a.output and a.tool!='screenshot':p.error('--output is only available for screenshot')
def call(path,data=None):
 req=urllib.request.Request(a.url+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=10) as r:return json.load(r)
try:
 if a.tool=='observe_home':result=call('/api/observe?'+urllib.parse.urlencode(json.loads(a.arguments)))
 elif a.tool=='list_objects':result=call('/api/objects?'+urllib.parse.urlencode(json.loads(a.arguments)))
 elif a.tool in ['get_state','get_catalog','get_tools','get_presets']:result=call({'get_state':'/api/state','get_catalog':'/api/catalog','get_tools':'/api/tools','get_presets':'/api/presets'}[a.tool])
 elif a.tool=='screenshot':
  result=call('/api/screenshots',json.loads(a.arguments))
  if a.output:
   deadline=time.monotonic()+32
   while time.monotonic()<deadline:
    try:
     with urllib.request.urlopen(a.url+result['url'],timeout=10) as response:
      if response.headers.get_content_type()=='image/png':
       a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(response.read())
       result.update(status='ready',output=str(a.output.resolve()));break
    except urllib.error.HTTPError as error:
     if error.code==410:raise RuntimeError('Screenshot expired: keep the house page open and visible') from error
     raise
    time.sleep(.3)
   else:raise RuntimeError('Screenshot timed out: keep the house page open and visible')
 else:
  revision=a.revision if a.revision is not None else call('/api/state')['revision']
  result=call('/api/commands',{'id':a.id or uuid.uuid4().hex,'expected_revision':revision,'tool':a.tool,'arguments':json.loads(Path(a.arguments[1:]).read_text() if a.arguments.startswith('@') else a.arguments)})
 print(json.dumps(result,ensure_ascii=False,indent=2))
except urllib.error.HTTPError as e:print(e.read().decode());raise SystemExit(1)
except RuntimeError as e:print(json.dumps({'error':str(e)},ensure_ascii=False));raise SystemExit(1)
