import copy
import json
import sqlite3
import time
from unittest.mock import patch
from contextlib import closing
from test_server import HouseCase
from server import ASSETS, CATALOG, DEFAULT, transition, validate_layout
from layout_update import plan_layout, geometry_issues


class LayoutUpdateTests(HouseCase):
 def test_new_catalog_categories_do_not_promise_unimplemented_actions(self):
  catalog=self.c.get('/api/catalog').json
  self.assertIn('sage-fridge-v1',catalog['categories']['appliances']['asset_ids'])
  self.assertIn('linen-armchair-v1',catalog['categories']['seating']['asset_ids'])
  self.assertNotIn('interactions',catalog['assets']['linen-armchair-v1'])
  self.assertTrue(catalog['assets']['sage-fridge-v1']['limitations'])
 def test_family_furniture_pack_has_honest_categories_and_local_models(self):
  from pathlib import Path
  catalog=self.c.get('/api/catalog').json
  groups={'family-sofa-stylized-v2':'seating','ergonomic-chair-stylized-v2':'seating','oak-coffee-table-stylized-v2':'tables','walnut-media-console-stylized-v2':'storage','floor-tv-stylized-v2':'appliances','oak-dining-table-stylized-v2':'tables','oak-dining-chair-stylized-v2':'seating','graphite-bookcase-stylized-v2':'storage','washer-stylized-v2':'appliances','workstation-tower-stylized-v2':'study'}
  for ident,category in groups.items():
   with self.subTest(asset=ident):
    asset=catalog['assets'][ident]
    self.assertIn(ident,catalog['categories'][category]['asset_ids'])
    self.assertNotIn('interactions',asset)
    self.assertTrue(asset['limitations']);self.assertTrue(asset['painted'])
    model=Path(__file__).parent/'assets'/'furniture'/(ident+'.glb')
    self.assertEqual(model.read_bytes()[:4],b'glTF')
 def test_family_pack_dry_run_derives_kinds_without_writing(self):
  before=self.snapshot_db()
  for ident in [k for k in ASSETS if k.endswith('stylized-v2')]:
   with self.subTest(asset=ident):
    operations=[{'op':'remove','id':o['id']} for o in DEFAULT['objects']]
    operations.append({'op':'add','id':'sample','asset_id':ident,'x':1.8,'z':0})
    r=self.edit(operations)
    self.assertEqual(r.status_code,200,r.json)
    self.assertFalse(r.json['applied'])
    self.assertFalse(r.json['layout']['errors'],r.json)
  self.assertEqual(before,self.snapshot_db())
 def test_batch_geometry_agrees_with_existing_single_item_rules(self):
  import random
  rng=random.Random(31)
  for _ in range(150):
   state=copy.deepcopy(DEFAULT)
   for o in state['objects']:o.update(x=rng.uniform(-3,3),z=rng.uniform(-3,3),yaw=rng.uniform(-6,6))
   try:validate_layout(state);valid=True
   except ValueError:valid=False
   self.assertEqual(not geometry_issues(state['objects'],ASSETS,CATALOG),valid)
 def snapshot_db(self):
  with closing(sqlite3.connect(self.db)) as con:
   return {t:con.execute('SELECT * FROM '+t).fetchall() for t in ['state','commands','home_events','home_viewer']}
 def edit(self,operations,**more):return self.cmd('update_layout',{'operations':operations,**more})
 def test_default_dry_run_is_read_only_including_events_and_cache(self):
  before=self.snapshot_db()
  r=self.edit([{'op':'update','id':'plant','x':2.3}])
  self.assertEqual(r.status_code,200);self.assertFalse(r.json['applied']);self.assertTrue(r.json['layout']['dry_run'])
  self.assertEqual(self.snapshot_db(),before)
  self.assertEqual(r.json['layout']['changes']['updated'],['plant'])
 def test_malformed_dry_run_is_also_read_only(self):
  before=self.snapshot_db()
  for args in [None,{'operations':[]},{'operations':{},'dry_run':'false'},{'operations':[],'evil':True}]:
   r=self.c.post('/api/commands',json={'id':'bad','expected_revision':0,'tool':'update_layout','arguments':args})
   self.assertEqual(r.status_code,400)
  self.assertEqual(before,self.snapshot_db())
 def test_all_geometry_errors_and_no_partial_apply(self):
  ops=[{'op':'update','id':'plant','x':1.95,'z':-1.3},{'op':'update','id':'lamp','x':3,'z':3}]
  r=self.edit(ops);codes={e['code'] for e in r.json['layout']['errors']}
  self.assertIn('overlap',codes);self.assertIn('outside_room',codes)
  before=self.snapshot_db();r=self.edit(ops,dry_run=False)
  self.assertEqual(r.status_code,422);self.assertFalse(r.json['applied']);self.assertEqual(before,self.snapshot_db())
 def test_position_swap_validated_as_final_batch(self):
  r=self.edit([{'op':'update','id':'plant','x':.8,'z':-2},{'op':'update','id':'lamp','x':2.45,'z':1.75}],dry_run=False)
  self.assertEqual(r.status_code,200,r.json);self.assertTrue(r.json['applied'])
  self.assertEqual(r.json['state']['revision'],1)
  self.assertEqual(r.json,self.edit([{'op':'update','id':'plant','x':.8,'z':-2},{'op':'update','id':'lamp','x':2.45,'z':1.75}],dry_run=False).json)
 def test_add_derives_kind_and_keeps_other_world_state(self):
  r=self.edit([{'op':'add','id':'p2','asset_id':'whale-plant-v1','x':-2.4,'z':1.3}],dry_run=False)
  self.assertEqual(r.status_code,200,r.json);state=r.json['state']
  self.assertEqual(next(o for o in state['objects'] if o['id']=='p2')['kind'],'plant')
  for key in ['character','light','note','camera']:self.assertEqual(state[key],DEFAULT[key])
 def test_remove_and_bad_operation_are_atomic(self):
  r=self.edit([{'op':'remove','id':'plant'},{'op':'add','id':'oops','asset_id':'remote://x','x':0,'z':0}],dry_run=False)
  self.assertEqual(r.status_code,422);self.assertIn('plant',[o['id'] for o in self.c.get('/api/state').json['objects']])
 def test_body_footprint_blocked(self):
  r=self.edit([{'op':'add','id':'p2','asset_id':'whale-plant-v1','x':0,'z':.5}])
  self.assertIn('body_blocked',[e['code'] for e in r.json['layout']['errors']])
 def test_busy_can_preview_but_not_apply(self):
  state=copy.deepcopy(DEFAULT);state['interaction']={'id':'job','target_id':'bed','phase':'active'}
  with closing(sqlite3.connect(self.db)) as con:
   con.execute('UPDATE state SET body=?',(json.dumps(state),));con.commit()
  r=self.edit([{'op':'remove','id':'bed'}]);self.assertEqual(r.status_code,200)
  self.assertIn('interaction_busy',[e['code'] for e in r.json['layout']['errors']])
  self.assertEqual(self.edit([{'op':'remove','id':'bed'}],dry_run=False).status_code,422)
 def test_fresh_body_used_instead_of_saved_position(self):
  now=time.time();snap={'visible':True,'received_at':now,'body':{'x':0,'z':1.5,'moving':False}}
  _,r=plan_layout(DEFAULT,{'operations':[{'op':'add','id':'p2','asset_id':'whale-plant-v1','x':0,'z':1.5}]},ASSETS,CATALOG,transition,snap,now)
  self.assertEqual(r['body_source'],'fresh_viewer');self.assertIn('body_blocked',[e['code'] for e in r['errors']])
 def test_moving_body_blocks_apply(self):
  now=time.time();snap={'visible':True,'received_at':now,'body':{'x':0,'z':.5,'moving':True}}
  _,r=plan_layout(DEFAULT,{'operations':[{'op':'remove','id':'plant'}]},ASSETS,CATALOG,transition,snap,now)
  self.assertIn('body_moving',[e['code'] for e in r['errors']])
 def test_revision_still_checked_for_preview(self):
  self.cmd('set_light',{'preset':'night'})
  self.assertEqual(self.edit([{'op':'remove','id':'plant'}]).status_code,409)
 def test_rugs_do_not_collide_and_wall_errors_are_reported(self):
  r=self.edit([{'op':'add','id':'rug2','asset_id':'whale-rug-v1','x':0,'z':.5},{'op':'add','id':'window','asset_id':'whale-window-v1','x':0,'z':0}])
  self.assertIn('wall_mount',[e['code'] for e in r.json['layout']['errors']])
  self.assertFalse(any('rug2' in e.get('ids',[]) for e in r.json['layout']['errors']))
 def test_blocked_interaction_reports_approaches(self):
  state=copy.deepcopy(DEFAULT);state['objects']=[{'id':'seat','kind':'chair','asset_id':'test-seat','x':0,'z':-1,'yaw':0}]
  asset={'kind':'chair','size':[.6,.6],'height':.7,'interactions':{'sit':{'root':[0,0,0],'approaches':[[0,0,-3]]}}}
  with patch.dict(ASSETS,{'test-seat':asset}):
   _,r=plan_layout(state,{'operations':[{'op':'update','id':'seat','label':'Test'}]},ASSETS,CATALOG,transition)
   self.assertIn('interaction_unreachable',[w['code'] for w in r['warnings']]);self.assertFalse(r['navigation']['interactions'][0]['approaches'][0]['clear'])
