"""Grounded body-level feedback, distinct from the owner's layout editor view."""
import math
from room_geometry import walls_for,DEFAULT_SIZE
from object_interactions import object_list
from furniture_support import height_of
ROOM_DEFAULT={**DEFAULT_SIZE,'wall_color':'#f3eee5','trim_color':'#d9c4a3','wallpapers':{name:'plain' for name in ['back','front','left','right']}}
WALLS=walls_for()

def occludes(a,b,obj,definition,base_y=None):
 if obj['kind']=='rug':return False
 c,s=math.cos(obj['yaw']),math.sin(obj['yaw']);w,d=definition['size'];lo,hi=0,1
 points=[]
 for p in [a,b]:
  dx,dz=p['x']-obj['x'],p['z']-obj['z'];points.append((dx*c-dz*s,dx*s+dz*c))
 for i,extent in [(0,w/2),(1,d/2)]:
  origin=points[0][i];delta=points[1][i]-origin
  if abs(delta)<1e-9:
   if abs(origin)>extent:return False
  else:
   t1,t2=sorted(((-extent-origin)/delta,(extent-origin)/delta));lo=max(lo,t1);hi=min(hi,t2)
   if lo>hi:return False
 if hi<=0 or lo>=.99:return False
 height=a['y']+(b['y']-a['y'])*max(0,lo)
 base_y=definition.get('elevation',0) if base_y is None else base_y
 return base_y<=height<=definition['height']+base_y

def observe(state,assets,catalog,snapshot,now,events):
 age=None if not snapshot else max(0,now-snapshot['received_at']);fresh=age is not None and age<6 and snapshot.get('visible')
 body=snapshot.get('body') if snapshot else None
 result={'revision':state['revision'],'source':'character perspective, not spectator camera','fresh':bool(fresh),'age_seconds':None if age is None else round(age,2),'execution':{'paused':snapshot.get('paused',False) if snapshot else None,'requires_visible_viewer':True},'job':state.get('interaction'),'events':events,'cursor':events[-1]['seq'] if events else None,'room':{**ROOM_DEFAULT,**state.get('room',{})},'limitations':['Visibility uses approximate furniture bounds, not a pixel-perfect image or physical sensation sensor.','No hunger, tiredness or emotions are inferred.']}
 if not fresh:
  result.update(summary='还没有新鲜的身体视角反馈；页面未打开或暂时断开。动作是否完成请看 job，不能把已受理当完成。',body=body,sight={'status':'unavailable','objects':[]},touch=[]);return result
 job=state.get('interaction',{});pose=body['pose'];support=next((o for o in state['objects'] if o['id']==job.get('target_id')),None)
 active=job.get('phase')=='active' and snapshot.get('job_id')==job.get('id')
 eyes_closed=pose=='sleep'
 eye={**body,'y':body['y']+(0.22 if eyes_closed else .78 if pose in ['sit','read'] else .9)}
 visible=[];near=[]
 for obj in object_list(state,assets)['objects']:
  definition=assets.get(obj.get('asset_id'),catalog.get(obj['kind'],{}));dx,dz=obj['x']-body['x'],obj['z']-body['z'];distance=math.hypot(dx,dz);angle=math.atan2(math.sin(math.atan2(dx,dz)-body['yaw']),math.cos(math.atan2(dx,dz)-body['yaw']))
  direction='前面' if abs(angle)<math.pi/6 else '后面' if abs(angle)>math.pi*5/6 else '左边' if angle<0 else '右边'
  item={'id':obj['id'],'label':obj['label'],'category':obj['category'],'distance_m':round(distance,2),'direction':direction,'actions':obj['actions'],'support':obj.get('support')}
  point={'x':obj['x'],'z':obj['z'],'y':min(1.25,definition.get('height',.5)*.7+height_of(obj,state['objects'],assets,catalog))}
  if not eyes_closed and distance<5.5 and abs(angle)<math.radians(70) and not any(occludes(eye,point,other,assets.get(other.get('asset_id'),catalog.get(other['kind'],{})),height_of(other,state['objects'],assets,catalog)) for other in state['objects'] if other['id']!=obj['id']):visible.append(item)
 touch=[]
 if active and support:touch=[{'object_id':support['id'],'kind':'lying_support' if pose=='sleep' else 'seated_support','description':'身体躺在床面上' if pose=='sleep' else '坐在座面上','basis':'confirmed active contact pose'}]
 nearest_walls=sorted([{'id':w['id'],'label':w['label'],'wallpaper_id':state.get('room',{}).get('wallpapers',{}).get(w['id'],'plain'),'distance_m':round(abs(body[w['axis']]-w['position']),2)} for w in walls_for(state.get('room'))],key=lambda w:w['distance_m'])
 status='闭着眼睛，躺在床上。' if eyes_closed else '坐好，正在看书。' if pose=='read' else '坐在座位上。' if pose=='sit' else '正在走动。' if body['moving'] else '正在调整姿势。' if pose=='transition' else '站在房间里。'
 if snapshot.get('paused'):status='动作已暂停。'+status
 if visible:status+='眼前有'+ '、'.join(o['label'] for o in visible[:4])+'。'
 result.update(summary=status,body=body,sight={'status':'eyes_closed' if eyes_closed else 'open','fov_degrees':140,'objects':visible},nearby=sorted([o for o in visible if o['distance_m']<1.2],key=lambda o:o['distance_m']),touch=touch,hands={'holding':'storybook' if pose=='read' and active else None,'basis':'active reading prop' if pose=='read' and active else 'no held prop'},walls=nearest_walls,light=state['light'])
 return result
