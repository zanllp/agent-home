import json,copy
from pathlib import Path
from test_server import HouseCase
from server import ASSETS,CATALOG,transition,validate_layout
from layout_update import navigation_report
from furniture_support import height_of
LAYOUT=json.loads((Path(__file__).resolve().parents[1]/'modeling/furniture/urban-v4/layout.json').read_text())
class UrbanLayoutTests(HouseCase):
 def test_real_layout_valid_and_reachable(self):
  self.assertEqual(self.cmd('move_character',{'x':.7,'z':.4}).status_code,200)
  r=self.cmd('apply_layout',LAYOUT,1,'urban');self.assertEqual(r.status_code,200,r.json)
  state=r.json['state'];validate_layout(state);report=navigation_report(state['objects'],ASSETS,CATALOG,state['character']);self.assertTrue(report['body_clear']);self.assertGreater(report['reachable_cells'],200);self.assertTrue(all(a['reachable'] for a in report['interactions']))
  self.assertEqual(self.cmd('apply_layout',{'objects':state['objects']},2,'urban-roundtrip').status_code,200)
 def test_shelf_children_live_at_declared_real_height(self):
  state=self.cmd('apply_layout',LAYOUT).json['state'];item=next(o for o in state['objects'] if o['id']=='shelf-item-2-0');self.assertAlmostEqual(height_of(item,state['objects'],ASSETS,CATALOG),.84)
