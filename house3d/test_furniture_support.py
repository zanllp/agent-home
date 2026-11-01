import copy
import math
from unittest.mock import patch
from test_server import HouseCase
from server import ASSETS, CATALOG, DEFAULT, transition, validate_layout
from furniture_support import height_of, parse_support, resolve_supports
from home_observation import occludes

PARENT={'kind':'desk','size':[1.1,.7],'height':.7,'surfaces':{'top':{'size':[1,.6],'height':.7}}}
PROP={'kind':'desktop','size':[.25,.2],'height':.15,'placement':'surface','surfaces':{'top':{'size':[.2,.15],'height':.15}}}
class SupportTests(HouseCase):
 def setUp(self):
  super().setUp();self.assets=patch.dict(ASSETS,{'test-table':PARENT,'test-prop':PROP});self.assets.start();self.addCleanup(self.assets.stop)
 def on(self,ident='table',x=0,z=0,yaw=0):return {'id':ident,'surface':'top','x':x,'z':z,'yaw':yaw}
 def operations(self):
  return [{'op':'remove','id':o['id']} for o in DEFAULT['objects']]+[{'op':'add','id':'prop','asset_id':'test-prop','on':self.on(x=.2)},{'op':'add','id':'table','asset_id':'test-table','x':1.8,'z':-1.2}]
 def command(self,ops=None,apply=False,rev=0,ident='support'):
  return self.cmd('update_layout',{'operations':ops or self.operations(),'dry_run':not apply},rev,ident)
 def test_forward_reference_and_readonly_preview(self):
  r=self.command();self.assertEqual(r.status_code,200,r.json);self.assertFalse(r.json['layout']['errors']);self.assertFalse(r.json['applied']);self.assertEqual(self.c.get('/api/state').json['revision'],0)
  prop=r.json['layout']['objects'][0];self.assertAlmostEqual(prop['x'],2);self.assertAlmostEqual(height_of(prop,r.json['layout']['objects'],ASSETS,CATALOG),.7)
 def test_parent_movement_and_rotation_follow(self):
  a=self.command(apply=True);self.assertTrue(a.json['applied']);r=self.command([{'op':'update','id':'table','yaw':math.pi/2}],True,1,'rotate');self.assertEqual(r.status_code,200,r.json)
  prop=next(o for o in r.json['state']['objects'] if o['id']=='prop');self.assertAlmostEqual(prop['x'],1.8);self.assertAlmostEqual(prop['z'],-1.4);self.assertAlmostEqual(prop['yaw'],math.pi/2)
 def test_supported_layout_roundtrip_and_idempotency(self):
  r=self.command(apply=True);state=r.json['state'];result=self.cmd('apply_layout',{'objects':state['objects']},1,'roundtrip');self.assertEqual(result.status_code,200,result.json);self.assertEqual(result.json,self.cmd('apply_layout',{'objects':state['objects']},1,'roundtrip').json)
 def test_remove_parent_requires_resolving_children(self):
  self.command(apply=True);r=self.command([{'op':'remove','id':'table'}],True,1,'remove');self.assertEqual(r.status_code,422);self.assertIn('support_missing',{e['code'] for e in r.json['layout']['errors']});self.assertEqual(self.c.get('/api/state').json['revision'],1)
 def test_remove_both_in_any_order(self):
  self.command(apply=True);r=self.command([{'op':'remove','id':'table'},{'op':'remove','id':'prop'}],True,1,'both');self.assertEqual(r.status_code,200,r.json)
 def test_overhang_and_unknown_surface_are_blocked(self):
  for on,code in [(self.on(x=.49),'support_overhang'),({**self.on(),'surface':'missing'},'surface_unknown')]:
   ops=self.operations();ops[-2]['on']=on;r=self.command(ops);self.assertIn(code,{e['code'] for e in r.json['layout']['errors']})
 def test_cycle_is_blocked_without_recursion_failure(self):
  ops=[{'op':'add','id':'a','asset_id':'test-prop','on':self.on('b')},{'op':'add','id':'b','asset_id':'test-prop','on':self.on('a')}];r=self.command(ops);self.assertIn('support_cycle',{e['code'] for e in r.json['layout']['errors']})
 def test_no_arbitrary_elevation_or_malformed_support(self):
  for value in [None,{},self.on(x=True),self.on(x=float('inf')),dict(self.on(),height=3)]:
   with self.assertRaises(ValueError):parse_support(value)
  self.assertEqual(self.cmd('place_furniture',{'id':'p','kind':'desktop','asset_id':'test-prop','on':self.on(),'elevation':1}).status_code,400)
 def test_floor_coordinates_still_required(self):
  self.assertEqual(self.cmd('place_furniture',{'id':'d','kind':'desk'}).status_code,400)
 def test_new_props_do_not_gain_life_actions(self):
  self.command(apply=True);obj=next(o for o in self.c.get('/api/objects').json['objects'] if o['id']=='prop');self.assertEqual(obj['actions'],[]);self.assertAlmostEqual(obj['support']['base_height'],.7)
 def test_parent_surface_shrink_is_checked(self):
  self.command(apply=True)
  with patch.dict(ASSETS,{'test-table':{**PARENT,'surfaces':{'top':{'size':[.2,.2],'height':.7}}}}):
   r=self.command([{'op':'update','id':'table','x':1.8}],rev=1,ident='shrink');self.assertIn('support_overhang',{e['code'] for e in r.json['layout']['errors']})
 def test_supported_prop_occlusion_uses_real_height(self):
  obj={'id':'p','x':0,'z':0,'yaw':0,'kind':'desktop'};a={'x':0,'z':-1,'y':.1};b={'x':0,'z':1,'y':.1};self.assertFalse(occludes(a,b,obj,PROP,.7));self.assertTrue(occludes({**a,'y':.75},{**b,'y':.75},obj,PROP,.7))
 def test_modern_wall_style_preserves_furniture(self):
  r=self.cmd('update_room',{'style':'urban','wall_color':'#eceef1'});self.assertEqual(r.status_code,200,r.json);self.assertEqual(r.json['state']['objects'],DEFAULT['objects']);self.assertEqual(r.json['state']['room']['style'],'urban')
 def test_interior_shelf_is_not_a_full_solid_box_for_supported_props(self):
  shelf={**PARENT,'height':1.4,'surfaces':{'top':{'size':[1,.6],'height':.7}}}
  with patch.dict(ASSETS,{'test-table':shelf}):
   r=self.command();self.assertEqual(r.status_code,200,r.json);self.assertEqual(r.json['layout']['errors'],[])
 def test_supported_siblings_still_collide(self):
  ops=self.operations()+[{'op':'add','id':'second','asset_id':'test-prop','on':self.on(x=.2)}];r=self.command(ops);self.assertIn('overlap',{e['code'] for e in r.json['layout']['errors']})
 def test_catalog_pot_support_offset_accounts_for_a_dangling_vine(self):
  with patch.dict(ASSETS,{'test-prop':{**PROP,'support_offset':-.05}}):
   r=self.command();self.assertEqual(r.json['layout']['errors'],[]);prop=r.json['layout']['objects'][0];self.assertAlmostEqual(height_of(prop,r.json['layout']['objects'],ASSETS,CATALOG),.65)
