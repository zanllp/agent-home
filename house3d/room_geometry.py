"""Metre-based room bounds shared by placement, navigation and body feedback."""
import math
DEFAULT_SIZE={'width':6.,'depth':5.,'height':2.4}
LIMITS={'width':(4.,12.),'depth':(4.,10.),'height':(2.4,4.)}
def dimensions(room=None):return {k:(room or {}).get(k,v) for k,v in DEFAULT_SIZE.items()}
def boundaries(room=None):
 d=dimensions(room);return {'furniture_x':d['width']/2-.05,'furniture_z':d['depth']/2-.05,'body_x':d['width']/2-.72,'body_z':d['depth']/2-.72,'height':d['height']}
def walls_for(room=None):
 b=boundaries(room)
 return [{'id':ident,'name':ident,axis:pos,'yaw':yaw,'label':label,'axis':axis,'position':pos,'inward':inward} for ident,axis,pos,yaw,label,inward in [('back','z',-b['furniture_z'],0,'后墙',1),('front','z',b['furniture_z'],math.pi,'前墙',-1),('left','x',-b['furniture_x'],math.pi/2,'左墙',1),('right','x',b['furniture_x'],-math.pi/2,'右墙',-1)]]
