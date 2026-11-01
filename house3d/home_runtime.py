"""SQLite-backed viewer lease and bounded, durable world feedback."""
import json,math
from home_observation import observe
from room_geometry import dimensions

def init_runtime(con):
 con.executescript('CREATE TABLE IF NOT EXISTS home_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,at REAL,kind TEXT,body TEXT); CREATE TABLE IF NOT EXISTS home_viewer(id INTEGER PRIMARY KEY,body TEXT);')
def event(con,now,kind,body):
 con.execute('INSERT INTO home_events(at,kind,body) VALUES(?,?,?)',(now,kind,json.dumps(body)))
 # Keep a bounded recent history. The cursor is monotonic even after pruning.
 con.execute('DELETE FROM home_events WHERE seq < (SELECT COALESCE(MAX(seq),0)-1000 FROM home_events)')
def feedback(con,state,assets,catalog,now,since):
 row=con.execute('SELECT body FROM home_viewer WHERE id=1').fetchone();snapshot=json.loads(row[0]) if row else None
 rows=con.execute('SELECT * FROM home_events WHERE seq>? ORDER BY seq LIMIT 100',(since,)).fetchall()
 events=[{'seq':r['seq'],'at':r['at'],'kind':r['kind'],**json.loads(r['body'])} for r in rows]
 for item in events:
  if item['kind']=='action_progress':
   item['message']={'approaching':'正在走过去。','entering':'正在慢慢坐稳、调整姿势。','active':'已经躺好。' if item['action']=='sleep' else '坐好，开始看书。' if item['action']=='read' else '已经坐稳。','leaving':'正在放下书、起身。' if item.get('pose')=='read' else '正在起身。','completed':'已经到达。' if item['action']=='walk_to' else '已经站稳。','failed':'走不过去或动作未能完成；请查看原因。'}.get(item['phase'],'动作状态已更新。')
  elif item['kind']=='command_accepted':item['message']='收到请求，等待身体执行。' if item['status']=='requested' else '家里的设置已更新。'
  else:item['message']='这次操作没能执行；请查看原因。'
 result=observe(state,assets,catalog,snapshot,now,events);result['cursor']=events[-1]['seq'] if events else since;result['more']=len(rows)==100;first=con.execute('SELECT MIN(seq) FROM home_events').fetchone()[0];result['history_truncated']=bool(first and since<first-1)
 return result

def heartbeat(con,body,state,now):
 if not isinstance(body,dict) or set(body)-{'session_id','visible','body','job_id','paused'}:raise ValueError('Invalid viewer feedback')
 session=body.get('session_id')
 if not isinstance(session,str) or not 1<=len(session)<=100:raise ValueError('Invalid viewer session')
 if 'paused' in body and not isinstance(body['paused'],bool):raise ValueError('paused must be boolean')
 if not isinstance(body.get('visible'),bool):raise ValueError('visible must be boolean')
 actor=body.get('body')
 if not isinstance(actor,dict) or set(actor)!={'x','y','z','yaw','pose','moving'}:raise ValueError('Invalid body feedback')
 size=dimensions(state.get('room'));coordinate_limits={'x':size['width']/2+.2,'z':size['depth']/2+.2,'y':size['height']+.2,'yaw':10}
 for key in ['x','y','z','yaw']:
  v=actor[key]
  if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or abs(v)>coordinate_limits[key]:raise ValueError('Invalid body coordinate')
 if actor['pose'] not in ['stand','sit','sleep','read','transition'] or not isinstance(actor['moving'],bool):raise ValueError('Invalid body pose')
 row=con.execute('SELECT body FROM home_viewer WHERE id=1').fetchone();previous=json.loads(row[0]) if row else None
 if previous and previous['session_id']!=session and previous['visible'] and now-previous['received_at']<6:return {'controller':False,'owner_age_seconds':now-previous['received_at']}
 if body.get('job_id') is not None and body['job_id']!=state.get('interaction',{}).get('id'):raise ValueError('Stale job feedback')
 snapshot={**body,'received_at':now};con.execute('INSERT OR REPLACE INTO home_viewer VALUES(1,?)',(json.dumps(snapshot),))
 return {'controller':True,'received_at':now}

def viewer_allowed(con,session,now):
 row=con.execute('SELECT body FROM home_viewer WHERE id=1').fetchone()
 if not row:return True
 current=json.loads(row[0]);return current['session_id']==session and current['visible'] and now-current['received_at']<6
