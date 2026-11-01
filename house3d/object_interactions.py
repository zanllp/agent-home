"""Declarative local object capabilities; no scripts or remote asset URLs."""
import math
from furniture_support import height_of
CATEGORIES={'wall_shelf':'storage','wall_art':'decoration','storage_box':'storage','desktop':'study','books':'study','air_conditioner':'appliances','appliance':'appliances','chair':'seating','sofa':'seating','armchair':'seating','bed':'sleeping','desk':'study','shelf':'storage','sideboard':'storage','nightstand':'storage','fridge':'appliances','office_chair':'seating','dining_chair':'seating','coffee_table':'tables','dining_table':'tables','media_console':'storage','tv':'appliances','washer':'appliances','computer':'study','lamp':'lighting','plant':'decoration','rug':'decoration','window':'environment'}
CATEGORY_LABELS={'seating':'坐具','sleeping':'寝具','study':'学习创作','tables':'桌几','storage':'收纳','appliances':'家电','lighting':'灯光','decoration':'装饰植物','environment':'环境'}
BUSY_PHASES={'requested','approaching','entering','active','leaving'}
def busy(state):return state.get('interaction',{}).get('phase') in BUSY_PHASES

def world_point(obj,point):
 x,y,z=point;c=math.cos(obj['yaw']);s=math.sin(obj['yaw'])
 return {'x':obj['x']+x*c+z*s,'y':y,'z':obj['z']-x*s+z*c,'yaw':obj['yaw']}

def reading_desk(obj,state):
 if obj['kind']!='chair':return None
 candidates=[]
 for desk in state['objects']:
  if desk['kind']!='desk':continue
  dx,dz=desk['x']-obj['x'],desk['z']-obj['z'];c,s=math.cos(obj['yaw']),math.sin(obj['yaw']);forward=dx*s+dz*c;side=dx*c-dz*s
  if .4<forward<1.35 and abs(side)<.45:candidates.append((math.hypot(dx,dz),desk))
 return min(candidates,key=lambda v:v[0])[1] if candidates else None

def actions_for(obj,assets,state):
 definition=assets.get(obj.get('asset_id'),{});result=[];job=state.get('interaction',{})
 for name,config in definition.get('interactions',{}).items():
  result.append({'id':name,'label':{'sit':'坐一会儿','sleep':'躺下睡觉'}[name],'available':not busy(state),'reason':'先结束当前互动' if busy(state) else None,'reachability':'not_checked'})
 if definition.get('interactions',{}).get('sit') and reading_desk(obj,state):result.append({'id':'read','label':'坐下看书','available':not busy(state),'reason':'先结束当前互动' if busy(state) else None,'reachability':'not_checked'})
 if busy(state) and job.get('target_id')==obj['id']:
  result.append({'id':'leave','label':'起床' if job.get('pose')=='sleep' else '起身','available':job.get('action')!='leave','reason':None})
 if definition.get('interactions',{}).get('sleep') and job.get('target_id')==obj['id'] and job.get('phase')=='active':result.append({'id':'uncover' if obj.get('properties',{}).get('covered',True) else 'cover','label':'掀开被子' if obj.get('properties',{}).get('covered',True) else '盖好被子','available':True})
 if obj['kind']=='lamp':result.extend([{'id':'turn_on','label':'开灯','available':True},{'id':'turn_off','label':'关灯','available':True}])
 return result

def object_list(state,assets,category=None,capability=None):
 items=[]
 for obj in state['objects']:
  definition=assets.get(obj.get('asset_id'),{});kind=obj['kind'];cat=CATEGORIES.get(kind,'decoration');actions=actions_for(obj,assets,state)
  if category and category!=cat:continue
  if capability and not any(a['id']==capability for a in actions):continue
  items.append({**obj,'label':obj.get('label',definition.get('label',kind)),'category':cat,'category_label':CATEGORY_LABELS[cat],'support':({**obj['on'],'base_height':height_of(obj,state['objects'],assets,{})} if obj.get('on') else None),'writable_properties':({'on':{'type':'boolean'},'brightness':{'type':'number','minimum':0,'maximum':1}} if kind=='lamp' else {'covered':{'type':'boolean'}} if definition.get('interactions',{}).get('sleep') else {}),'actions':actions,'properties':obj.get('properties',{'on':True,'brightness':.7} if kind=='lamp' else {'covered':True} if kind=='bed' else {}),'interaction':state.get('interaction') if state.get('interaction',{}).get('target_id')==obj['id'] else None})
 return {'revision':state['revision'],'categories':CATEGORY_LABELS,'objects':items,'interaction':state.get('interaction')}
