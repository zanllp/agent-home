import json,sqlite3,time
from test_server import HouseCase
from home_observation import observe
from server import ASSETS,CATALOG
class HomeFeedbackTests(HouseCase):
 def state(self):return self.c.get('/api/state').json
 def command(self,tool,args,ident):return self.cmd(tool,args,self.state()['revision'],ident)
 def pulse(self,session='one',**changes):
  body={'session_id':session,'visible':True,'job_id':None,'body':{'x':0,'y':.006,'z':.5,'yaw':0,'pose':'stand','moving':False},**changes}
  return self.c.post('/api/viewer',json=body)
 def test_observe_is_explicit_when_no_body_viewer(self):
  result=self.c.get('/api/observe').json;self.assertFalse(result['fresh']);self.assertEqual(result['sight']['status'],'unavailable');self.assertEqual(result['touch'],[])
 def test_new_feedback_is_body_perspective_not_camera(self):
  self.assertEqual(self.pulse().status_code,200);result=self.c.get('/api/observe').json;self.assertTrue(result['fresh']);self.assertEqual(len(result['walls']),4);self.assertNotIn('emotions',result)
  before=result['sight'];self.command('set_camera',{'preset':'back'},'cam');self.assertEqual(self.c.get('/api/observe').json['sight'],before)
 def test_single_viewer_lease_and_stale_progress_rejected(self):
  self.assertTrue(self.pulse().json['controller']);self.assertFalse(self.pulse('two').json['controller'])
  self.command('apply_layout',{'objects':[]},'empty');self.command('walk_to',{'x':1,'z':0},'trip')
  self.assertEqual(self.c.post('/api/interactions/trip/progress',json={'phase':'approaching','viewer_session':'two'}).status_code,409)
  self.assertEqual(self.c.post('/api/interactions/trip/progress',json={'phase':'approaching','viewer_session':'one'}).status_code,200)
 def test_walk_is_async_persistent_and_revision_guarded(self):
  self.command('apply_layout',{'objects':[]},'empty');start=self.state()['character'].copy();result=self.command('walk_to',{'x':1,'z':0},'trip');self.assertEqual(result.status_code,200);self.assertEqual(self.state()['character'],start)
  self.assertEqual(self.c.post('/api/interactions/trip/progress',json={'phase':'completed'}).status_code,400)
  self.assertEqual(self.c.post('/api/interactions/trip/progress',json={'phase':'approaching'}).status_code,200)
  self.assertEqual(self.c.post('/api/interactions/trip/progress',json={'phase':'completed'}).status_code,200);self.assertEqual(self.state()['character']['x'],1)
  events=self.c.get('/api/observe').json;self.assertTrue(any(e.get('phase')=='completed' for e in events['events']));self.assertEqual(self.c.get('/api/observe?since='+str(events['cursor'])).json['events'],[])
 def test_room_paint_changes_not_wall_position(self):
  self.assertEqual(self.command('update_room',{'wall_color':'#fff0dd'},'paint').status_code,200);self.assertEqual(self.state()['room']['wall_color'],'#fff0dd')
  self.assertEqual(self.command('update_room',{'wall_color':'oops'},'bad').status_code,400)
  self.assertTrue(any(e['kind']=='action_rejected' for e in self.c.get('/api/observe').json['events']))
 def test_read_needs_a_desk_in_front_and_preserves_relation(self):
  layout=[{'id':'chair','kind':'chair','asset_id':'whale-chair-v1','x':0,'z':0,'yaw':3.141592653589793},{'id':'desk','kind':'desk','asset_id':'whale-desk-v1','x':0,'z':-.95,'yaw':0}]
  self.assertEqual(self.command('apply_layout',{'objects':layout},'layout').status_code,200)
  self.assertTrue(self.c.get('/api/objects?capability=read').json['objects']);result=self.command('interact',{'target_id':'chair','action':'read'},'read');self.assertEqual(result.status_code,200);self.assertEqual(result.json['state']['interaction']['related_id'],'desk')
  for phase in ['approaching','entering','active']:self.assertEqual(self.c.post('/api/interactions/read/progress',json={'phase':phase,'approach_index':0}).status_code,200)
  self.assertEqual(self.state()['character']['activity'],'read')
 def test_sleep_has_no_omniscient_vision_or_fake_touch(self):
  state={'revision':1,'light':'day','objects':[{'id':'bed','kind':'bed','asset_id':'whale-bed-v1','x':0,'z':0,'yaw':0}], 'interaction':{'id':'nap','target_id':'bed','phase':'active','pose':'sleep'}}
  snap={'received_at':10,'visible':True,'job_id':'nap','body':{'x':0,'z':0,'y':.64,'yaw':0,'pose':'sleep','moving':False}}
  result=observe(state,ASSETS,CATALOG,snap,11,[]);self.assertEqual(result['sight']['status'],'eyes_closed');self.assertEqual(result['sight']['objects'],[]);self.assertEqual(len(result['touch']),1)
  self.assertFalse(observe(state,ASSETS,CATALOG,snap,17,[])['fresh'])
 def test_reject_bad_body_and_cursor(self):
  self.assertEqual(self.pulse(body={'x':float('nan')}).status_code,400);self.assertEqual(self.c.get('/api/observe?since=-1').status_code,400)
 def test_paused_feedback_keeps_the_body_owner_without_inventing_progress(self):
  self.assertTrue(self.pulse(paused=True).json['controller']);self.assertFalse(self.pulse('two').json['controller']);result=self.c.get('/api/observe').json;self.assertTrue(result['fresh']);self.assertTrue(result['execution']['paused']);self.assertIn('暂停',result['summary'])
 def test_cancel_walking_saves_actual_stop_position(self):
  self.command('apply_layout',{'objects':[]},'empty');self.command('walk_to',{'x':1,'z':0},'trip');self.c.post('/api/interactions/trip/progress',json={'phase':'approaching'});self.command('cancel_action',{'job_id':'trip'},'stop')
  r=self.c.post('/api/interactions/stop/progress',json={'phase':'completed','position':{'x':.4,'z':.2,'yaw':.5}});self.assertEqual(r.status_code,200);self.assertEqual(self.state()['character']['x'],.4)
 def test_invalid_stop_position_never_emits_completed_event(self):
  self.command('apply_layout',{'objects':[]},'empty');self.command('walk_to',{'x':1,'z':0},'trip');self.command('cancel_action',{'job_id':'trip'},'stop');r=self.c.post('/api/interactions/stop/progress',json={'phase':'completed','position':{'x':99,'z':0,'yaw':0}});self.assertEqual(r.status_code,400);self.assertFalse(any(e.get('phase')=='completed' for e in self.c.get('/api/observe').json['events']));self.assertEqual(self.state()['interaction']['phase'],'requested')
 def test_body_sight_does_not_include_objects_behind_or_behind_shelf(self):
  state={'revision':1,'light':'day','objects':[{'id':'front','kind':'plant','x':0,'z':2,'yaw':0},{'id':'block','kind':'shelf','x':0,'z':1,'yaw':0},{'id':'behind','kind':'lamp','x':0,'z':-.8,'yaw':0}]}
  snap={'received_at':10,'visible':True,'body':{'x':0,'z':0,'y':.006,'yaw':0,'pose':'stand','moving':False}}
  result=observe(state,ASSETS,CATALOG,snap,11,[]);ids=[o['id'] for o in result['sight']['objects']];self.assertNotIn('front',ids);self.assertNotIn('behind',ids);self.assertIn('block',ids);self.assertNotIn('behind',[o['id'] for o in result['nearby']])
 def test_screenshot_view_is_validated_and_survives_queue(self):
  self.assertEqual(self.c.post('/api/screenshots',json={'view':'bad'}).status_code,400);shot=self.c.post('/api/screenshots',json={'view':'character'});self.assertEqual(shot.status_code,202);pending=self.c.get('/api/screenshots/pending?viewer=life-v2').json;self.assertEqual(pending['view'],'character');self.assertEqual(pending['id'],shot.json['id'])
 def test_event_receipts_are_idempotent(self):
  r=self.command('update_room',{'wall_color':'#eeeeee'},'same');rev=r.json['state']['revision']-1;cursor=self.c.get('/api/observe').json['cursor'];self.cmd('update_room',{'wall_color':'#eeeeee'},rev,'same');self.assertEqual(self.c.get('/api/observe').json['cursor'],cursor)
