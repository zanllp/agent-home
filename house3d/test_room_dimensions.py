import copy,math,sqlite3
from test_server import HouseCase
from server import transition,DEFAULT,ASSETS,CATALOG
from room_geometry import boundaries
from home_runtime import heartbeat
class RoomDimensionsTests(HouseCase):
 def test_presets_are_explicit_and_dryrun_is_readonly(self):
  self.assertEqual(set(self.c.get('/api/presets').json['presets']),{'childroom','family-home'})
  r=self.cmd('apply_preset',{'preset_id':'family-home'});self.assertEqual(r.status_code,200,r.json);self.assertFalse(r.json['applied']);self.assertEqual(r.json['preview']['room']['width'],8);self.assertEqual(self.c.get('/api/state').json['revision'],0)
  with sqlite3.connect(self.db) as c:self.assertEqual(c.execute('select count(*) from commands').fetchone()[0],0);self.assertEqual(c.execute('select count(*) from home_events').fetchone()[0],0)
 def test_both_presets_switch_atomically_and_preserve_character(self):
  r=self.cmd('apply_preset',{'preset_id':'family-home','dry_run':False});self.assertEqual(r.status_code,200,r.json);self.assertEqual(r.json['state']['revision'],1);self.assertEqual(r.json['state']['character']['outfit'],DEFAULT['character']['outfit']);self.assertEqual(r.json['state']['control_revisions']['position'],1)
  self.assertEqual(r.json,self.cmd('apply_preset',{'preset_id':'family-home','dry_run':False}).json)
  r=self.cmd('apply_preset',{'preset_id':'childroom','dry_run':False},1,'child');self.assertEqual(r.status_code,200,r.json);self.assertEqual(r.json['state']['room']['width'],6);self.assertTrue(any(o['kind']=='bed' for o in r.json['state']['objects']))
 def test_resize_preview_and_wall_anchors(self):
  self.cmd('apply_preset',{'preset_id':'childroom','dry_run':False});s=self.c.get('/api/state').json
  r=self.cmd('update_room',{'width':8,'depth':6.5,'height':2.8,'dry_run':True},1,'size');self.assertEqual(r.status_code,200,r.json);self.assertFalse(r.json['applied']);self.assertEqual(self.c.get('/api/state').json,s)
  window=next(o for o in r.json['preview']['objects'] if o['kind']=='window');self.assertAlmostEqual(window['z'],-3.20+ASSETS[window['asset_id']]['size'][1]/2)
  r=self.cmd('update_room',{'width':8,'depth':6.5,'height':2.8},1,'resize');self.assertEqual(r.status_code,200,r.json);cat=self.c.get('/api/catalog').json['room'];self.assertEqual(cat['size'],[8,6.5]);self.assertAlmostEqual(cat['character_bounds'][0],3.28);self.assertAlmostEqual(cat['character_bounds'][1],2.53)
 def test_shrink_and_invalid_dimensions_leave_state_intact(self):
  for args in [{'width':True},{'width':float('nan')},{'depth':20},{'height':2},{'width':4,'depth':4}]:
   self.assertEqual(self.cmd('update_room',args).status_code,400,args);self.assertEqual(self.c.get('/api/state').json['revision'],0)
 def test_large_room_positions_and_feedback_are_validated_consistently(self):
  s=copy.deepcopy(DEFAULT);s['objects']=[];s=transition(s,{'tool':'update_room','arguments':{'width':10,'depth':8}});s=transition(s,{'tool':'move_character','arguments':{'x':4.1,'z':0}})
  body={'x':4.1,'y':0,'z':0,'yaw':0,'pose':'stand','moving':False}
  with sqlite3.connect(self.db) as c:
   self.assertTrue(heartbeat(c,{'session_id':'test','visible':True,'body':body},s,1)['controller'])
   with self.assertRaises(ValueError):heartbeat(c,{'session_id':'test','visible':True,'body':{**body,'x':6}},s,2)
  r=transition(s,{'tool':'apply_preset','arguments':{'preset_id':'childroom','dry_run':False}});self.assertEqual(r['character']['x'],-.15)
 def test_unknown_preset_or_busy_state_is_rejected(self):
  self.assertEqual(self.cmd('apply_preset',{'preset_id':'unknown','dry_run':False}).status_code,400)
  s=copy.deepcopy(DEFAULT);s['interaction']={'phase':'active','target_id':'chair'}
  for tool,args in [('apply_preset',{'preset_id':'family-home'}),('update_room',{'width':8})]:
   with self.assertRaises(ValueError):transition(s,{'tool':tool,'arguments':args})

 def test_rejected_resize_preview_does_not_write_events(self):
  with sqlite3.connect(self.db) as c:before=c.execute('select count(*) from home_events').fetchone()[0]
  self.assertEqual(self.cmd('update_room',{'width':4,'depth':4,'dry_run':True}).status_code,400)
  self.assertEqual(self.c.get('/api/state').json['revision'],0)
  with sqlite3.connect(self.db) as c:
   self.assertEqual(c.execute('select count(*) from home_events').fetchone()[0],before)
   self.assertEqual(c.execute('select count(*) from commands').fetchone()[0],0)
