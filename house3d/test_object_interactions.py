import unittest
from test_server import HouseCase
from server import ASSETS
from object_interactions import object_list

class ObjectInteractionTests(HouseCase):
 def setup_real(self):
  return self.cmd('apply_layout',{'objects':[{'id':'seat','kind':'chair','asset_id':'whale-chair-v1','x':0,'z':0},{'id':'lamp','kind':'lamp','asset_id':'whale-lamp-v1','x':2,'z':1.5}]},0,'layout')
 def test_list_is_typed_and_filterable(self):
  self.setup_real();s=self.c.get('/api/objects?category=seating&capability=sit').json
  self.assertEqual([o['id'] for o in s['objects']],['seat']);self.assertTrue(s['objects'][0]['actions'][0]['available'])
 def test_no_unimplemented_actions_advertised(self):
  self.assertFalse(self.c.get('/api/objects?capability=sleep').json['objects'])
  self.assertEqual(self.cmd('interact',{'target_id':'desk','action':'sleep'}).status_code,400)
 def test_requested_is_not_active_and_progress_order_is_enforced(self):
  self.setup_real();r=self.cmd('interact',{'target_id':'seat','action':'sit'},1,'sit');self.assertEqual(r.status_code,200);j=r.json['state']['interaction'];self.assertEqual(j['phase'],'requested')
  path='/api/interactions/'+j['id']+'/progress'
  self.assertEqual(self.c.post(path,json={'phase':'active','approach_index':0}).status_code,400)
  self.assertEqual(self.c.post(path,json={'phase':'approaching','approach_index':0}).status_code,200)
  self.assertEqual(self.c.post(path,json={'phase':'approaching','approach_index':0}).status_code,200)
  self.assertEqual(self.c.post(path,json={'phase':'entering','approach_index':1}).status_code,400)
  self.assertEqual(self.c.post(path,json={'phase':'entering','approach_index':0}).status_code,200)
  self.assertEqual(self.c.post(path,json={'phase':'active','approach_index':0}).status_code,200)
  state=self.c.get('/api/state').json
  self.assertEqual(self.cmd('remove_furniture',{'id':'seat'},state['revision'],'delete').status_code,400)
  self.assertEqual(self.cmd('set_activity',{'activity':'walk'},state['revision'],'walk').status_code,400)
  self.assertEqual(self.cmd('interact',{'target_id':'seat','action':'leave'},state['revision'],'leave').status_code,200)
  self.assertEqual(self.c.post(path,json={'phase':'failed','approach_index':0,'error':'old viewer'}).status_code,409)
  leave='/api/interactions/leave/progress'
  self.assertEqual(self.c.post(leave,json={'phase':'leaving','approach_index':0}).status_code,200)
  self.assertEqual(self.c.post(leave,json={'phase':'completed','approach_index':0}).status_code,200)
  state=self.c.get('/api/state').json;self.assertEqual(state['character']['z'],1.05)
 def test_failure_requires_reason(self):
  self.setup_real();self.cmd('interact',{'target_id':'seat','action':'sit'},1,'sit');path='/api/interactions/sit/progress'
  self.assertEqual(self.c.post(path,json={'phase':'failed','approach_index':0}).status_code,400)
  self.assertEqual(self.c.post(path,json={'phase':'failed','approach_index':0,'error':'Blocked approach'}).status_code,200)
  self.assertEqual(self.c.get('/api/objects?capability=sit').json['objects'][0]['actions'][0]['available'],True)
 def test_object_properties_reject_unknown_fields(self):
  self.setup_real()
  for props in [{'on':'yes'},{'brightness':2},{'script':'alert(1)'}]:self.assertEqual(self.cmd('update_object',{'id':'lamp','properties':props},1,'invalid').status_code,400)
  r=self.cmd('update_object',{'id':'lamp','label':'床边小灯','properties':{'on':False,'brightness':.3}},1,'lamp-state');self.assertEqual(r.status_code,200)
  item=next(o for o in self.c.get('/api/objects').json['objects'] if o['id']=='lamp');self.assertEqual(item['label'],'床边小灯');self.assertFalse(item['properties']['on'])
 def test_lamp_does_not_interrupt_active_pose(self):
  self.setup_real();self.cmd('interact',{'target_id':'seat','action':'sit'},1,'sit')
  self.assertEqual(self.cmd('interact',{'target_id':'lamp','action':'turn_off'},2,'off').status_code,200)
  self.assertEqual(self.c.get('/api/state').json['interaction']['id'],'sit')

 def test_saved_object_properties_round_trip_through_atomic_layout(self):
  self.setup_real();r=self.cmd('update_object',{'id':'lamp','label':'My lamp','properties':{'on':False}},1,'update')
  r=self.cmd('apply_layout',{'objects':r.json['state']['objects']},2,'again');self.assertEqual(r.status_code,200)
  lamp=next(o for o in r.json['state']['objects'] if o['id']=='lamp');self.assertFalse(lamp['properties']['on']);self.assertEqual(lamp['label'],'My lamp')
 def test_old_viewers_cannot_fulfil_current_interaction_screenshots(self):
  shot=self.c.post('/api/screenshots').json['id']
  self.assertIsNone(self.c.get('/api/screenshots/pending').json['id'])
  self.assertEqual(self.c.get('/api/screenshots/pending?viewer=life-v2').json['id'],shot)
  png=b'\x89PNG\r\n\x1a\nfixture'
  self.assertEqual(self.c.post('/api/screenshots/'+shot,data=png,content_type='image/png').status_code,409)
  self.assertEqual(self.c.post('/api/screenshots/'+shot,data=png,content_type='image/png',headers={'X-House-Viewer':'life-v2'}).status_code,200)

 def test_sleep_cover_state_and_activity_are_explicit(self):
  self.cmd('apply_layout',{'objects':[{'id':'bed','kind':'bed','asset_id':'whale-bed-v1','x':0,'z':0}]},0,'layout')
  self.cmd('interact',{'target_id':'bed','action':'sleep'},1,'nap')
  for phase in ['approaching','entering','active']:self.assertEqual(self.c.post('/api/interactions/nap/progress',json={'phase':phase,'approach_index':0}).status_code,200)
  state=self.c.get('/api/state').json;self.assertEqual(state['character']['activity'],'sleep')
  r=self.cmd('interact',{'target_id':'bed','action':'uncover'},state['revision'],'uncover');self.assertEqual(r.status_code,200);self.assertFalse(r.json['state']['objects'][0]['properties']['covered']);self.assertEqual(r.json['state']['interaction']['id'],'nap')
  self.assertTrue(any(a['id']=='cover' for a in self.c.get('/api/objects').json['objects'][0]['actions']))
 def test_invalid_progress_type_is_a_clean_400(self):
  self.setup_real();self.cmd('interact',{'target_id':'seat','action':'sit'},1,'sit')
  self.assertEqual(self.c.post('/api/interactions/sit/progress',json={'phase':{},'approach_index':0}).status_code,400)

if __name__=='__main__':unittest.main()
