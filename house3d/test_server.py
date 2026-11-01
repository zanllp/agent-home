import tempfile, unittest
from pathlib import Path
from server import create_app, DEFAULT, validate_layout
class HouseCase(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=Path(self.tmp.name)/'state.db';self.app=create_app(self.db);self.c=self.app.test_client()
 def tearDown(self):self.tmp.cleanup()
 def cmd(self,tool,args=None,rev=0,ident='test'):
  return self.c.post('/api/commands',json={'id':ident,'expected_revision':rev,'tool':tool,'arguments':args or {}})

class HouseTests(HouseCase):
 def test_camera_presets(self):
  for i,preset in enumerate(['home','front','face','portrait','side','back','top']):
   r=self.cmd('set_camera',{'preset':preset},i,'camera-'+preset)
   self.assertEqual(r.status_code,200);self.assertEqual(r.json['state']['camera'],preset)
  self.assertEqual(create_app(self.db).test_client().get('/api/state').json['camera'],'top')
 def test_invalid_camera(self):self.assertEqual(self.cmd('set_camera',{'preset':'oops'}).status_code,400)
 def test_defaults(self):validate_layout(DEFAULT)
 def test_persistence(self):
  self.assertEqual(self.cmd('set_light',{'preset':'night'}).status_code,200)
  self.assertEqual(create_app(self.db).test_client().get('/api/state').json['light'],'night')
 def test_revision(self):
  self.cmd('set_light',{'preset':'night'});self.assertEqual(self.cmd('set_light',{'preset':'day'},ident='b').status_code,409)
 def test_idempotency(self):
  self.assertEqual(self.cmd('set_light',{'preset':'night'}).json,self.cmd('set_light',{'preset':'night'}).json)
  self.assertEqual(self.c.get('/api/state').json['revision'],1)
 def test_id_reuse(self):
  self.cmd('set_light',{'preset':'night'});self.assertEqual(self.cmd('set_light',{'preset':'day'}).status_code,409)
 def test_bounds(self):self.assertEqual(self.cmd('move_character',{'x':999,'z':0}).status_code,400)
 def test_occupied(self):self.assertEqual(self.cmd('move_character',{'x':1.9,'z':-1.3}).status_code,400)
 def test_activity(self):self.assertEqual(self.cmd('set_activity',{'activity':'reading'}).status_code,400)
 def test_place_remove(self):
  self.assertEqual(self.cmd('place_furniture',{'id':'plant2','kind':'plant','x':.8,'z':1.4}).status_code,200)
  self.assertEqual(self.cmd('remove_furniture',{'id':'plant2'},1,'remove').status_code,200)
 def test_collision_rollback(self):
  self.assertEqual(self.cmd('update_furniture',{'id':'plant','x':1.9,'z':-1.3}).status_code,400)
  self.assertEqual(self.c.get('/api/state').json['revision'],0)
 def test_unknown_tool(self):self.assertEqual(self.cmd('shell',{'command':'echo x'}).status_code,400)
 def test_cross_origin(self):self.assertEqual(self.c.post('/api/commands',headers={'Origin':'https://evil.example'},json={}).status_code,403)
 def test_host(self):self.assertEqual(self.c.get('/api/state',headers={'Host':'evil.example'}).status_code,403)
 def test_screenshot(self):
  r=self.c.post('/api/screenshots');self.assertEqual(r.status_code,202);ident=r.json['id']
  self.assertEqual(self.c.get('/api/screenshots/pending?viewer=life-v2').json['id'],ident)
  self.assertEqual(self.c.get('/api/screenshots/'+ident).status_code,202)
  self.assertEqual(self.c.post('/api/screenshots/'+ident,data=b'no',content_type='image/png',headers={'X-House-Viewer':'life-v2'}).status_code,400)

class ModularFurnitureTests(HouseCase):
 def test_catalog_has_local_models(self):
  catalog=self.c.get('/api/catalog').json
  for asset in catalog['assets'].values():
   self.assertTrue(asset['model'].startswith('/models/furniture/'))
   self.assertGreater(asset['size'][0],0)
 def test_switch_to_real_asset_and_persist(self):
  r=self.cmd('update_furniture',{'id':'bed','asset_id':'whale-bed-v1'})
  self.assertEqual(r.status_code,200)
  saved=create_app(self.db).test_client().get('/api/state').json
  self.assertEqual(next(o for o in saved['objects'] if o['id']=='bed')['asset_id'],'whale-bed-v1')
 def test_bad_asset_or_kind_does_not_save(self):
  for asset in ['https://evil.invalid/model.glb','unknown','whale-bed-v1']:
   self.assertEqual(self.cmd('update_furniture',{'id':'chair','asset_id':asset}).status_code,400)
  self.assertEqual(self.c.get('/api/state').json['revision'],0)
 def test_painted_asset_recolor_rejected(self):
  self.assertEqual(self.cmd('update_furniture',{'id':'bed','asset_id':'whale-bed-v1','color':'#ffffff'}).status_code,400)
 def test_asset_dimensions_reject_wall_overlap(self):
  # The primitive bed fits here, but the wider real model does not.
  self.assertEqual(self.cmd('update_furniture',{'id':'bed','asset_id':'whale-bed-v1','x':2.2}).status_code,400)
 def test_atomic_layout(self):
  layout=[{'id':'new-bed','kind':'bed','asset_id':'whale-bed-v1','x':-1.8,'z':-1.2,'yaw':0}]
  r=self.cmd('apply_layout',{'objects':layout})
  self.assertEqual(r.status_code,200);self.assertEqual(r.json['state']['revision'],1)
  self.assertEqual(len(r.json['state']['objects']),1)
  self.assertEqual(create_app(self.db).test_client().get('/api/state').json['objects'][0]['id'],'new-bed')
  self.assertEqual(self.cmd('apply_layout',{'objects':layout}).json,r.json)
 def test_layout_can_round_trip_saved_asset_objects(self):
  r=self.cmd('update_furniture',{'id':'bed','asset_id':'whale-bed-v1'})
  self.assertEqual(r.status_code,200)
  r=self.cmd('apply_layout',{'objects':r.json['state']['objects']},1,'round-trip-layout')
  self.assertEqual(r.status_code,200)
 def test_content_pack_kind_does_not_require_renderer_enum(self):
  from unittest.mock import patch
  from server import ASSETS
  with patch.dict(ASSETS,{'custom-stool':{'kind':'stool','size':[.3,.3],'height':.4,'model':'/models/furniture/custom-stool.glb'}}):
   self.assertEqual(self.cmd('place_furniture',{'id':'stool','kind':'stool','asset_id':'custom-stool','x':.8,'z':1.4}).status_code,200)
 def test_wall_fixture_stays_on_wall_and_can_share_floor_space_below(self):
  from unittest.mock import patch
  from server import ASSETS
  window={'kind':'window','size':[1.4,.25],'height':1.2,'elevation':1.0,'placement':'wall'}
  pot={'kind':'pot','size':[.2,.2],'height':.5}
  with patch.dict(ASSETS,{'window-test':window,'pot-test':pot}):
   self.assertEqual(self.cmd('place_furniture',{'id':'window','kind':'window','asset_id':'window-test','x':0,'z':0}).status_code,400)
   self.assertEqual(self.cmd('place_furniture',{'id':'window','kind':'window','asset_id':'window-test','x':0,'z':-2.325,'yaw':3.141592653589793}).status_code,400)
   self.assertEqual(self.cmd('place_furniture',{'id':'window-left','kind':'window','asset_id':'window-test','x':-2.825,'z':0,'yaw':1.5707963267948966}).status_code,200)
   layout=[{'id':'window','kind':'window','asset_id':'window-test','x':0,'z':-2.325}, {'id':'pot','kind':'pot','asset_id':'pot-test','x':0,'z':-2.325}]
   self.assertEqual(self.cmd('apply_layout',{'objects':layout},1,'wall-layout').status_code,200)
 def test_wall_fixture_rejects_outward_facing_or_ceiling_crossing(self):
  from unittest.mock import patch
  from server import ASSETS
  with patch.dict(ASSETS,{'window-test':{'kind':'window','size':[1.4,.25],'height':1.7,'elevation':1.0,'placement':'wall'}}):
   self.assertEqual(self.cmd('place_furniture',{'id':'window','kind':'window','asset_id':'window-test','x':0,'z':-2.325}).status_code,400)
 def test_same_value_controls_have_distinct_revisions_but_cached_posts_do_not_replay(self):
  a=self.cmd('set_light',{'preset':'day'});self.assertEqual(a.json['state']['control_revisions']['light'],1)
  b=self.cmd('set_light',{'preset':'day'},1,'second');self.assertEqual(b.json['state']['control_revisions']['light'],2)
  self.assertEqual(self.cmd('set_light',{'preset':'day'}).json,a.json)
  self.assertEqual(self.c.get('/api/state').json['revision'],2)
 def test_movement_uses_character_clearance_not_just_a_point(self):
  self.assertEqual(self.cmd('move_character',{'x':2.5,'z':0}).status_code,400)
  self.assertEqual(self.cmd('move_character',{'x':0,'z':1.1}).status_code,200)
  self.assertEqual(self.c.get('/api/state').json['control_revisions']['position'],1)
 def test_bad_layout_rolls_back_all(self):
  before=self.c.get('/api/state').json
  for items in [[],[{'id':'a','kind':'chair','x':0,'z':0},{'id':'a','kind':'chair','x':1,'z':0}],
                [{'id':'a','kind':'chair','x':0,'z':0},{'id':'b','kind':'bed','x':0,'z':0}]]:
   if not items:continue
   self.assertEqual(self.cmd('apply_layout',{'objects':items}).status_code,400)
   self.assertEqual(self.c.get('/api/state').json,before)

if __name__=='__main__':unittest.main()
