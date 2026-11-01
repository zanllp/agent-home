import copy,json
from test_server import HouseCase
from server import create_app,WALLPAPERS
class WallpaperTests(HouseCase):
 def change(self,args,ident):return self.cmd('set_wallpaper',args,self.c.get('/api/state').json['revision'],ident)
 def test_catalog_is_discoverable(self):
  self.assertEqual(self.c.get('/api/catalog').json['wallpapers'],WALLPAPERS);self.assertEqual(len(WALLPAPERS),4)
  for v in WALLPAPERS.values():self.assertTrue(v['source']);self.assertGreater(v['tile_m'],0)
 def test_per_wall_changes_persist_and_do_not_move_anything(self):
  old=self.c.get('/api/state').json;r=self.change({'wall_id':'back','wallpaper_id':'whale-breeze'},'back');self.assertEqual(r.status_code,200);state=r.json['state'];self.assertEqual(state['objects'],old['objects']);self.assertEqual(state['character'],old['character']);self.assertEqual(state['room']['wallpapers']['back'],'whale-breeze');self.assertEqual(state['room']['wallpapers']['left'],'plain')
  saved=create_app(self.db).test_client().get('/api/state').json;self.assertEqual(saved['room'],state['room'])
 def test_all_walls_and_plain_restore_preserve_paint_and_each_other(self):
  self.cmd('update_room',{'wall_color':'#fff0dd','trim_color':'#aabbcc'},0,'paint');self.change({'wall_id':'all','wallpaper_id':'blue-linen'},'all');r=self.change({'wall_id':'left','wallpaper_id':'plain'},'clear');room=r.json['state']['room'];self.assertEqual(room['wallpapers']['back'],'blue-linen');self.assertEqual(room['wallpapers']['left'],'plain');self.assertEqual(room['wall_color'],'#fff0dd');self.assertEqual(room['trim_color'],'#aabbcc')
 def test_reject_unknown_wall_paper_and_urls_atomically(self):
  old=self.c.get('/api/state').json
  for i,args in enumerate([{'wall_id':'ceiling','wallpaper_id':'plain'},{'wall_id':'back','wallpaper_id':'https://example.com/paper'},{'wall_id':'back','wallpaper_id':[]}]):self.assertEqual(self.change(args,str(i)).status_code,400);self.assertEqual(self.c.get('/api/state').json,old)
 def test_idempotency_and_revision_are_retained(self):
  args={'wall_id':'back','wallpaper_id':'daisy-meadow'};a=self.cmd('set_wallpaper',args,0,'one');self.assertEqual(a.json,self.cmd('set_wallpaper',args,0,'one').json);self.assertEqual(self.cmd('set_wallpaper',args,0,'two').status_code,409)
 def test_body_feedback_includes_current_wallpaper(self):
  self.change({'wall_id':'left','wallpaper_id':'daisy-meadow'},'wall');result=self.c.get('/api/observe').json;self.assertEqual(result['room']['wallpapers']['left'],'daisy-meadow')
