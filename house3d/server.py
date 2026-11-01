"""Local, isolated house service. No DSH, cloud or model calls."""
import copy
import json
import math
import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from tool_schemas import DEFS, schemas
from object_interactions import busy, world_point, object_list, actions_for, BUSY_PHASES, reading_desk, CATEGORIES, CATEGORY_LABELS
from home_observation import ROOM_DEFAULT, WALLS
from room_geometry import boundaries, dimensions, walls_for, LIMITS
from home_runtime import init_runtime, event, feedback, heartbeat, viewer_allowed
from layout_update import plan_layout
from furniture_support import height_of, supports_pair, resolve_supports, parse_support
from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
CATALOG = {
    'desk': {'label':'书桌','size':[1.25,.65],'height':.70},
    'chair': {'label':'小椅子','size':[.55,.55],'height':.38},
    'shelf': {'label':'书架','size':[.9,.35],'height':1.65},
    'bed': {'label':'小床','size':[1.2,1.9],'height':.4},
    'plant': {'label':'绿植','size':[.4,.4],'height':.85},
    'lamp': {'label':'落地灯','size':[.3,.3],'height':1.6},
    'rug': {'label':'地毯','size':[1.8,1.3],'height':.015},
    'sofa': {'label':'沙发','size':[1.6,.7],'height':.4},
}
ASSETS = json.loads((ROOT/'furniture-assets.json').read_text())
WALLPAPERS=json.loads((ROOT/'wallpapers.json').read_text())
PRESETS=json.loads((ROOT/'room-presets.json').read_text())

DEFAULT = {'revision':0,'light':'day','note':'欢迎回家，大肥鱼。','camera':'home',
    'character':{'x':0,'z':.5,'yaw':0,'activity':'idle','outfit':'reference','hair':'reference'},
    'objects':[
        {'id':'desk','kind':'desk','x':-1.5,'z':-1.4,'yaw':0,'color':'#bd8d62'},
        {'id':'chair','kind':'chair','x':-1.5,'z':-.55,'yaw':math.pi,'color':'#8faeb0'},
        {'id':'shelf','kind':'shelf','x':-2.4,'z':-1.9,'yaw':0,'color':'#c49c75'},
        {'id':'bed','kind':'bed','x':1.95,'z':-1.3,'yaw':0,'color':'#a8bed0'},
        {'id':'plant','kind':'plant','x':2.45,'z':1.75,'yaw':0,'color':'#819c75'},
        {'id':'rug','kind':'rug','x':0,'z':.6,'yaw':0,'color':'#e2cdb9'},
        {'id':'lamp','kind':'lamp','x':.8,'z':-2,'yaw':0,'color':'#dfbc83'}]}

def number(v, low, high):
    if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not low <= v <= high:
        raise ValueError(f'Expected finite number in [{low}, {high}]')
    return v

def footprint(obj):
    w,d=(ASSETS[obj['asset_id']] if obj.get('asset_id') else CATALOG[obj['kind']])['size']; a=obj['yaw']
    return abs(math.cos(a))*w+abs(math.sin(a))*d,abs(math.sin(a))*w+abs(math.cos(a))*d

def validate_layout(state):
    limits=boundaries(state.get('room'))
    errors=resolve_supports(state['objects'],ASSETS,CATALOG)
    if errors:raise ValueError(errors[0]['message'])
    solids=[]
    seen=set()
    for obj in state['objects']:
        if obj['id'] in seen:raise ValueError('Duplicate furniture id')
        seen.add(obj['id'])
        if obj.get('asset_id') and (obj['asset_id'] not in ASSETS or ASSETS[obj['asset_id']]['kind']!=obj['kind']):raise ValueError('Asset does not match furniture kind')
        definition=ASSETS[obj['asset_id']] if obj.get('asset_id') else CATALOG[obj['kind']]
        y=height_of(obj,state['objects'],ASSETS,CATALOG);height=definition['height']
        w,d=footprint(obj)
        if abs(obj['x'])+w/2 > limits['furniture_x']+1e-8 or abs(obj['z'])+d/2 > limits['furniture_z']+1e-8 or y<-.001 or y+height>limits['height']:
            raise ValueError('Furniture extends outside room: '+obj['id'])
        if definition.get('placement')=='wall':
            angle=math.atan2(math.sin(obj['yaw']),math.cos(obj['yaw']))
            back=abs(angle)<.001 and abs(obj['z']-(-limits['furniture_z']+d/2))<.025
            left=abs(angle-math.pi/2)<.001 and abs(obj['x']-(-limits['furniture_x']+w/2))<.025
            if not (back or left):raise ValueError('Wall fixture must face into the room on the back or left wall')
        if obj['kind']=='rug':continue
        for other,ow,od,oy,oh in solids:
            if supports_pair(obj,other,state['objects']):continue
            if y+height<=oy+.01 or oy+oh<=y+.01:continue
            if abs(obj['x']-other['x']) < (w+ow)/2-.015 and abs(obj['z']-other['z']) < (d+od)/2-.015:
                raise ValueError('Furniture overlaps another item: '+other['id']+' / '+obj['id'])
        solids.append((obj,w,d,y,height))

def transition(state, command, *, check_geometry=True, check_busy=True):
    state=copy.deepcopy(state); op=command.get('tool'); args=command.get('arguments',{})
    if not isinstance(args,dict):raise ValueError('arguments must be an object')
    if op not in DEFS:raise ValueError('Unknown or unavailable tool')
    _,props,required=DEFS[op]
    if set(args)-set(props):raise ValueError('Unknown argument')
    if set(required)-set(args):raise ValueError('Required argument missing')
    if check_busy and busy(state) and op in ['apply_layout','place_furniture','update_furniture','remove_furniture','move_character','set_activity','apply_preset']:
        raise ValueError('Finish the current object interaction with interact/leave before moving furniture or the character')
    if op=='set_wallpaper':
        side=args.get('wall_id');paper=args.get('wallpaper_id')
        if side not in ['all','back','front','left','right'] or paper not in WALLPAPERS:raise ValueError('Unknown wall or wallpaper; choose from get_catalog')
        room={**ROOM_DEFAULT,**state.get('room',{})};papers={**ROOM_DEFAULT['wallpapers'],**room.get('wallpapers',{})}
        for name in (list(papers) if side=='all' else [side]):papers[name]=paper
        room['wallpapers']=papers;state['room']=room
    elif op=='update_room':
        import re
        resizing=any(k in args for k in LIMITS)
        if resizing and check_busy and busy(state):raise ValueError('Finish the interaction before resizing the room')
        if not isinstance(args.get('dry_run',False),bool):raise ValueError('dry_run must be boolean')
        for key,value in args.items():
            if key=='dry_run':continue
            if key in LIMITS:
                number(value,*LIMITS[key]);continue
            if key=='style':
                if value not in ['classic','urban']:raise ValueError('Unknown room style')
                continue
            if not isinstance(value,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',value):raise ValueError('Expected #RRGGBB room paint')
        state['room']={**ROOM_DEFAULT,**state.get('room',{}),**{k:v for k,v in args.items() if k!='dry_run'}}
        if resizing:
            limits=boundaries(state['room'])
            for obj in state['objects']:
                if ASSETS.get(obj.get('asset_id'),{}).get('placement')!='wall':continue
                w,d=footprint(obj)
                if abs(obj['yaw'])<.001:obj['z']=-limits['furniture_z']+d/2
                else:obj['x']=-limits['furniture_x']+w/2
            if check_geometry:
                validate_layout(state)
                transition(state,{'tool':'move_character','arguments':{k:state['character'][k] for k in ['x','z']}},check_busy=False)
    elif op=='walk_to':
        if busy(state):raise ValueError('Finish the current action first')
        limits=boundaries(state.get('room'));point={k:number(args.get(k),-limits['body_'+k],limits['body_'+k]) for k in ['x','z']}
        # Reuse the exact occupied-position validation, without moving the body.
        transition(state,{'tool':'move_character','arguments':point})
        state['interaction']={'id':command.get('id') or 'walk-'+str(state['revision']+1),'target_id':None,'target':point,'action':'walk_to','pose':'walk','phase':'requested','error':None,'approach_index':None}
    elif op=='cancel_action':
        old=state.get('interaction',{})
        if not busy(state) or old.get('id')!=args['job_id']:raise ValueError('No matching active job')
        state['interaction']={**old,'id':command.get('id') or 'cancel-'+str(state['revision']+1),'action':'leave','phase':'requested','from_active':old.get('phase') in ['active','entering'],'error':None}
    elif op=='interact':
        obj=next((o for o in state['objects'] if o['id']==args['target_id']),None)
        if not obj:raise ValueError('Target object not found')
        action=args['action'];available=actions_for(obj,ASSETS,state)
        if not any(a['id']==action and a['available'] for a in available):raise ValueError('Action unavailable for this object/state')
        if action in ['turn_on','turn_off']:
            obj.setdefault('properties',{'on':True,'brightness':.7})['on']=action=='turn_on'
        elif action in ['cover','uncover']:
            obj.setdefault('properties',{'covered':True})['covered']=action=='cover'
        else:
            old=state.get('interaction',{})
            state['interaction']={'id':command.get('id') or 'interaction-'+str(state['revision']+1),'target_id':obj['id'],'action':action,'pose':old['pose'] if action=='leave' else action,'related_id':reading_desk(obj,state)['id'] if action=='read' else old.get('related_id') if action=='leave' else None,'phase':'requested','approach_index':old.get('approach_index') if action=='leave' else None,'from_active':action=='leave' and old.get('phase') in ['active','entering'],'error':None}
    elif op=='update_object':
        obj=next((o for o in state['objects'] if o['id']==args['id']),None)
        if not obj:raise ValueError('Target object not found')
        if 'label' in args:
            if not isinstance(args['label'],str) or not 1<=len(args['label'])<=40:raise ValueError('Label must be 1..40 characters')
            obj['label']=args['label']
        if 'properties' in args:
            properties=args['properties']
            allowed={'on','brightness'} if obj['kind']=='lamp' else {'covered'} if ASSETS.get(obj.get('asset_id'),{}).get('interactions',{}).get('sleep') else set()
            if not isinstance(properties,dict) or not allowed or set(properties)-allowed:raise ValueError('Unsupported object properties')
            if 'covered' in properties and not isinstance(properties['covered'],bool):raise ValueError('covered must be boolean')
            if 'on' in properties and not isinstance(properties['on'],bool):raise ValueError('on must be boolean')
            if 'brightness' in properties:number(properties['brightness'],0,1)
            obj.setdefault('properties',{'on':True,'brightness':.7} if obj['kind']=='lamp' else {'covered':True}).update(properties)
    elif op=='apply_layout':
        objects=args.get('objects')
        if not isinstance(objects,list) or len(objects)>80:raise ValueError('Expected at most 80 furniture items')
        trial=copy.deepcopy(state);trial['objects']=[]
        for item in objects:
            if not isinstance(item,dict):raise ValueError('Invalid furniture item')
            trial=transition(trial,{'tool':'place_furniture','arguments':item},check_geometry=False,check_busy=False)
        validate_layout(trial)
        state['objects']=trial['objects']
    elif op=='set_camera':
        if args.get('preset') not in ['home','portrait','front','face','side','back','top']:raise ValueError('Unknown camera preset')
        state['camera']=args['preset']
    elif op=='set_light':
        if args.get('preset') not in ['day','evening','night']:raise ValueError('Unknown light preset')
        state['light']=args['preset']
    elif op=='set_note':
        text=args.get('text');
        if not isinstance(text,str) or len(text)>240:raise ValueError('Note must be at most 240 characters')
        state['note']=text
    elif op in ['place_furniture','update_furniture','remove_furniture']:
        ident=args.get('id')
        if not isinstance(ident,str) or not ident or len(ident)>64:raise ValueError('Invalid furniture id')
        existing=next((o for o in state['objects'] if o['id']==ident),None)
        if op=='place_furniture':
            if existing:raise ValueError('Furniture id already exists')
            if len(state['objects'])>=80:raise ValueError('Room item limit reached')
            if args.get('kind') not in CATALOG and not (isinstance(args.get('asset_id'),str) and args['asset_id'] in ASSETS and ASSETS[args['asset_id']]['kind']==args.get('kind')):raise ValueError('Unknown furniture kind')
            if 'on' not in args and not {'x','z'}<=set(args):raise ValueError('Floor placement requires x and z')
            existing={'id':ident,'kind':args['kind'],'x':0,'z':0,'yaw':0,'color':'#c39a78'}
            state['objects'].append(existing)
        elif not existing:raise ValueError('Furniture not found')
        if op=='remove_furniture':state['objects'].remove(existing)
        else:
            if 'asset_id' in args:
                asset_id=args['asset_id']
                if not isinstance(asset_id,str) or asset_id not in ASSETS or ASSETS[asset_id]['kind']!=existing['kind']:raise ValueError('Unknown or mismatched asset')
                existing['asset_id']=asset_id
                existing.pop('color',None)
            if 'color' in args and existing.get('asset_id') and not ASSETS[existing['asset_id']].get('recolorable',False):raise ValueError('Painted asset is not recolorable; choose another asset variant')
            if 'on' in args:existing['on']=parse_support(args['on'])
            elif existing.get('on') and any(k in args for k in ['x','z','yaw']):raise ValueError('Move supported props with on local offsets')
            for key in ['x','z','yaw']:
                if key in args:existing[key]=number(args[key],-math.tau if key=='yaw' else -6,math.tau if key=='yaw' else 6)
            if 'color' in args:
                import re
                if not isinstance(args['color'],str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',args['color']):raise ValueError('Expected #RRGGBB')
                existing['color']=args['color']
        if op!='remove_furniture' and ('label' in args or 'properties' in args):
            changes={k:v for k,v in args.items() if k in ['id','label','properties']}
            edited=transition(state,{'tool':'update_object','arguments':changes});state['objects']=edited['objects']
        if check_geometry:validate_layout(state)
    elif op=='apply_preset':
        if not isinstance(args.get('dry_run',True),bool):raise ValueError('dry_run must be boolean')
        preset_id=args.get('preset_id')
        if preset_id not in PRESETS:raise ValueError('Choose a preset_id from get_presets')
        preset=PRESETS[preset_id];revision=state['revision'];trial=copy.deepcopy(state);trial['objects']=[]
        trial=transition(trial,{'tool':'update_room','arguments':{k:v for k,v in preset['room'].items() if k!='wallpapers'}},check_busy=False,check_geometry=False)
        for wall,paper in preset['room'].get('wallpapers',{}).items():trial=transition(trial,{'tool':'set_wallpaper','arguments':{'wall_id':wall,'wallpaper_id':paper}},check_busy=False)
        trial=transition(trial,{'tool':'apply_layout','arguments':{'objects':preset['objects']}},check_busy=False)
        trial=transition(trial,{'tool':'move_character','arguments':preset['spawn']},check_busy=False)
        trial.pop('interaction',None);trial.update(revision=revision,camera='home',light='day',preset_id=preset_id)
        trial['control_revisions']={**trial.get('control_revisions',{}),**{k:revision+1 for k in ['position','activity','camera','light']}};state=trial
    elif op=='set_activity':
        activity=args.get('activity')
        if activity not in ['idle','walk','sit']:raise ValueError('Only idle, walk and sit are currently available')
        state['character']['activity']=activity
    elif op=='move_character':
        limits=boundaries(state.get('room'));x=number(args.get('x'),-limits['body_x'],limits['body_x']);z=number(args.get('z'),-limits['body_z'],limits['body_z'])
        for obj in state['objects']:
            if obj['kind']=='rug' or obj.get('on'):continue
            definition=ASSETS[obj['asset_id']] if obj.get('asset_id') else CATALOG[obj['kind']]
            w,d=definition['size'];a=obj['yaw'];dx=x-obj['x'];dz=z-obj['z']
            u=abs(dx*math.cos(a)-dz*math.sin(a));v=abs(dx*math.sin(a)+dz*math.cos(a))
            if math.hypot(max(0,u-w/2),max(0,v-d/2))<.57:raise ValueError('Target is occupied')
        state['character'].update(x=x,z=z,activity='idle')
        if 'yaw' in args:state['character']['yaw']=number(args['yaw'],-math.tau,math.tau)
    else:raise ValueError('Unknown or unavailable tool')
    control={'set_camera':'camera','set_light':'light','set_note':'note','set_activity':'activity','move_character':'position'}.get(op)
    if control:state.setdefault('control_revisions',{})[control]=state['revision']+1
    state['revision']+=1
    return state

def create_app(db_path=None):
    app=Flask(__name__,static_folder=None);app.config['MAX_CONTENT_LENGTH']=5*1024*1024
    db_path=Path(db_path or ROOT/'data'/'house.sqlite');db_path.parent.mkdir(parents=True,exist_ok=True)
    @contextmanager
    def connect():
        con=sqlite3.connect(db_path,timeout=10);con.row_factory=sqlite3.Row
        try:
            with con:yield con
        finally:con.close()
    with connect() as con:
        init_runtime(con)
        con.executescript('CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY,body TEXT); CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,request TEXT,body TEXT); CREATE TABLE IF NOT EXISTS shots(id TEXT PRIMARY KEY,status TEXT,png BLOB,created REAL);')
        if 'view' not in [r[1] for r in con.execute('PRAGMA table_info(shots)')]:con.execute("ALTER TABLE shots ADD COLUMN view TEXT NOT NULL DEFAULT 'spectator'")
        con.execute('INSERT OR IGNORE INTO state VALUES(1,?)',(json.dumps(DEFAULT),))
    @app.before_request
    def local_only():
        if request.host.split(':')[0] not in ['127.0.0.1','localhost']:return jsonify(error='Local host only'),403
        if request.method=='POST' and request.headers.get('Origin') and request.headers['Origin']!=request.host_url.rstrip('/'):
            return jsonify(error='Cross-origin writes are not allowed'),403
    @app.get('/api/state')
    def state():
        with connect() as con:return jsonify(json.loads(con.execute('SELECT body FROM state WHERE id=1').fetchone()[0]))
    @app.get('/api/catalog')
    def catalog():
        with connect() as con:current=json.loads(con.execute('SELECT body FROM state WHERE id=1').fetchone()[0])
        size=dimensions(current.get('room'));limits=boundaries(size)
        return jsonify(furniture=CATALOG,assets=ASSETS,categories={key:{'label':label,'asset_ids':[ident for ident,asset in ASSETS.items() if CATEGORIES.get(asset['kind'],'decoration')==key]} for key,label in CATEGORY_LABELS.items()},wallpapers=WALLPAPERS,room={'styles':['classic','urban'],'size':[size['width'],size['depth']],'height':size['height'],'dimension_limits':LIMITS,'furniture_bounds':[limits['furniture_x'],limits['furniture_z']],'character_radius':.57,'character_bounds':[limits['body_x'],limits['body_z']],'walls':walls_for(size)},activities=['idle','walk','sit'],outfits=['reference'],hairstyles=['reference'],viewer={'path':'/wander.html','activities':['idle','walk'],'sit':True,'object_actions':['sit','sleep','read','leave'],'interaction_requires_target':True,'adapter':'Local HTTP only; no DSH connection'},limitations=['No independent wardrobe yet','move_character relocates rather than animating a route','Screenshot requires an open visible house page'])
    @app.get('/api/presets')
    def presets():return jsonify(presets={k:{'label':v['label'],'room':v['room'],'objects':len(v['objects']),'spawn':v['spawn']} for k,v in PRESETS.items()},applying='Explicit template reset: dry-run first; places the character at the declared spawn, preserves appearance')
    @app.get('/api/objects')
    def objects():
        with connect() as con:body=json.loads(con.execute('SELECT body FROM state WHERE id=1').fetchone()[0])
        return jsonify(object_list(body,ASSETS,request.args.get('category'),request.args.get('capability')))
    @app.get('/api/observe')
    def observe_home():
        try:since=int(request.args.get('since','0'));assert since>=0
        except (ValueError,AssertionError):return jsonify(error='Invalid event cursor'),400
        with connect() as con:
            state=json.loads(con.execute('SELECT body FROM state WHERE id=1').fetchone()[0]);result=feedback(con,state,ASSETS,CATALOG,time.time(),since)
        return jsonify(result)
    @app.post('/api/viewer')
    def viewer():
        with connect() as con:
            con.execute('BEGIN IMMEDIATE');state=json.loads(con.execute('SELECT body FROM state WHERE id=1').fetchone()[0])
            try:result=heartbeat(con,request.get_json(silent=True),state,time.time())
            except ValueError as error:return jsonify(error=str(error)),400
        return jsonify(result)
    @app.post('/api/interactions/<ident>/progress')
    def interaction_progress(ident):
        body=request.get_json(silent=True)
        if not isinstance(body,dict) or set(body)-{'phase','approach_index','error','viewer_session','position'}:return jsonify(error='Invalid progress'),400
        with connect() as con:
            con.execute('BEGIN IMMEDIATE');state=json.loads(con.execute('SELECT body FROM state WHERE id=1').fetchone()[0]);job=state.get('interaction',{})
            if job.get('id')!=ident or job.get('phase') not in BUSY_PHASES:return jsonify(error='Stale interaction'),409
            if not viewer_allowed(con,body.get('viewer_session'),time.time()):return jsonify(error='Another viewer owns this action'),409
            phase=body.get('phase');old=job['phase']
            if not isinstance(phase,str):return jsonify(error='Invalid phase'),400
            allowed={'requested':({'leaving','completed','failed'} if job['action']=='leave' else {'approaching','failed'}),'approaching':({'completed','failed'} if job['pose']=='walk' else {'entering','failed'}),'entering':{'active','failed'},'active':set(),'leaving':{'completed','failed'}}
            if phase==old and body.get('approach_index',job.get('approach_index'))==job.get('approach_index'):return jsonify(ok=True,interaction=job)
            if phase not in allowed[old]:return jsonify(error='Invalid phase transition'),400
            config=None;obj=None;index=None
            if job['pose']!='walk':
                obj=next(o for o in state['objects'] if o['id']==job['target_id']);config=ASSETS[obj['asset_id']]['interactions']['sit' if job['pose']=='read' else job['pose']]
                index=body.get('approach_index',job.get('approach_index'))
                if isinstance(index,bool) or not isinstance(index,int) or not 0<=index<len(config['approaches']):return jsonify(error='Invalid approach index'),400
                if job.get('approach_index') is not None and index!=job['approach_index']:return jsonify(error='Approach cannot change mid-interaction'),400
            error=body.get('error')
            if phase=='failed' and (not isinstance(error,str) or not 1<=len(error)<=200):return jsonify(error='Failure reason required'),400
            job.update(phase=phase,approach_index=index,error=error if phase=='failed' else None)
            if phase=='active':
                contact=world_point(obj,config['root']);state['character'].update(x=contact['x'],z=contact['z'],yaw=contact['yaw']+config.get('yaw',0),activity='sleep' if job['pose']=='sleep' else 'read' if job['pose']=='read' else 'sit')
            if phase=='completed' and job['action']=='leave':state['character']['activity']='idle'
            if phase=='completed' and job['action']=='leave' and job.get('from_active') and config:
                point=world_point(obj,config['approaches'][index]);state['character'].update(x=point['x'],z=point['z'],yaw=point['yaw'],activity='idle')
            if phase=='completed' and job['action']=='walk_to':state['character'].update(**job['target'],activity='idle')
            if 'position' in body:
                if phase!='completed' or job['action']!='leave' or not isinstance(body['position'],dict) or set(body['position'])!={'x','z','yaw'}:return jsonify(error='Unexpected position feedback'),400
                try:state['character']=transition(state,{'tool':'move_character','arguments':body['position']})['character']
                except (ValueError,TypeError) as error:return jsonify(error=str(error)),400
            event(con,time.time(),'action_progress',{'job_id':ident,'action':job['action'],'pose':job['pose'],'target_id':job.get('target_id'),'phase':phase,'error':job.get('error')})
            state['revision']+=1;con.execute('UPDATE state SET body=? WHERE id=1',(json.dumps(state),))
        return jsonify(ok=True,interaction=job)
    @app.get('/api/tool-schemas')
    def tool_schemas():return jsonify(schemas())
    @app.get('/api/tools')
    def tools():return jsonify(tools={
        'observe_home':{'method':'GET','path':'/api/observe'},'walk_to':['x','z'],'cancel_action':['job_id'],'update_room':['wall_color','trim_color','style','width','depth','height','dry_run'],'get_presets':{'method':'GET','path':'/api/presets'},'apply_preset':['preset_id','dry_run'],'set_wallpaper':['wall_id','wallpaper_id'],
        'list_objects':{'method':'GET','path':'/api/objects'},'interact':['target_id','action'],'update_object':['id','label','properties'],'get_state':{'method':'GET','path':'/api/state'},'get_catalog':{'method':'GET','path':'/api/catalog'},
        'update_layout':['operations','dry_run'],'place_furniture':['id','kind','asset_id','x','z','yaw','color','on'], 'update_furniture':['id','asset_id','x','z','yaw','color','on'], 'apply_layout':['objects'],
        'remove_furniture':['id'],'move_character':['x','z','yaw'],'set_activity':['activity'],
        'set_camera':['preset'],'set_light':['preset'],'set_note':['text'],'screenshot':{'method':'POST','path':'/api/screenshots'}},
        command_endpoint='/api/commands',command_shape={'id':'unique idempotency key','expected_revision':0,'tool':'set_light','arguments':{'preset':'day'}})
    @app.post('/api/commands')
    def command():
        body=request.get_json(silent=True)
        if not isinstance(body,dict) or not isinstance(body.get('id'),str) or not 1<=len(body['id'])<=100:return jsonify(error='Unique command id is required'),400
        encoded=json.dumps(body,sort_keys=True)
        with connect() as con:
            con.execute('BEGIN IMMEDIATE')
            cached=con.execute('SELECT * FROM commands WHERE id=?',(body['id'],)).fetchone()
            if cached:
                if cached['request']!=encoded:return jsonify(error='Command id reused with different payload'),409
                return jsonify(json.loads(cached['body']))
            old=json.loads(con.execute('SELECT body FROM state WHERE id=1').fetchone()[0])
            if body.get('expected_revision')!=old['revision']:return jsonify(error='Revision conflict',revision=old['revision']),409
            layout_report=None
            try:
                if body.get('tool')=='update_layout':
                    row=con.execute('SELECT body FROM home_viewer WHERE id=1').fetchone()
                    snapshot=json.loads(row[0]) if row else None
                    new,layout_report=plan_layout(old,body.get('arguments',{}),ASSETS,CATALOG,transition,snapshot,time.time())
                    if layout_report['dry_run']:return jsonify(ok=True,applied=False,layout=layout_report)
                    if not layout_report['can_apply']:return jsonify(ok=False,applied=False,error='Layout blocked; inspect layout.errors',layout=layout_report),422
                else:
                    new=transition(old,body)
                    if body.get('tool') in ['apply_preset','update_room']:
                        if body['tool']=='update_room' and any(k in body.get('arguments',{}) for k in LIMITS):
                            row=con.execute('SELECT body FROM home_viewer WHERE id=1').fetchone();snapshot=json.loads(row[0]) if row else None
                            if snapshot and snapshot.get('visible') and time.time()-snapshot['received_at']<6:
                                if snapshot['body'].get('moving'):raise ValueError('Stop walking before resizing the room')
                                transition(new,{'tool':'move_character','arguments':{k:snapshot['body'][k] for k in ['x','z']}},check_busy=False)
                        if body.get('arguments',{}).get('dry_run',body['tool']=='apply_preset'):
                            return jsonify(ok=True,applied=False,preview=new)
            except (ValueError,TypeError) as exc:
                preview_args=body.get('arguments');preview_default=body.get('tool') in ['update_layout','apply_preset']
                is_preview=body.get('tool') in ['update_layout','apply_preset','update_room'] and (preview_args.get('dry_run',preview_default) is not False if isinstance(preview_args,dict) else preview_default)
                if not is_preview:
                    event(con,time.time(),'action_rejected',{'command_id':body['id'],'action':body.get('tool'),'error':str(exc)})
                return jsonify(error=str(exc)),400
            event(con,time.time(),'command_accepted',{'command_id':body['id'],'action':body['tool'],'arguments':body.get('arguments',{}),'status':'requested' if new.get('interaction',{}).get('id')==body['id'] else 'applied'})
            result={'ok':True,'state':new}
            if body.get('tool') in ['apply_preset','update_room']:result['applied']=True
            if layout_report is not None:result.update(applied=True,layout=layout_report)
            con.execute('UPDATE state SET body=? WHERE id=1',(json.dumps(new),))
            con.execute('INSERT INTO commands VALUES(?,?,?)',(body['id'],encoded,json.dumps(result)))
            return jsonify(result)
    @app.post('/api/screenshots')
    def request_shot():
        body=request.get_json(silent=True) or {}
        if not isinstance(body,dict) or set(body)-{'view'} or body.get('view','spectator') not in ['spectator','character']:return jsonify(error='Unknown screenshot view'),400
        ident=uuid.uuid4().hex
        with connect() as con:con.execute('INSERT INTO shots(id,status,png,created,view) VALUES(?,?,NULL,?,?)',(ident,'pending',time.time(),body.get('view','spectator')))
        return jsonify(id=ident,status='pending',url=f'/api/screenshots/{ident}'),202
    @app.get('/api/screenshots/pending')
    def pending():
        if request.args.get('viewer')!='life-v2':return jsonify(id=None,viewer_required='life-v2')
        with connect() as con:
            con.execute("UPDATE shots SET status='expired' WHERE status='pending' AND created<?",(time.time()-30,))
            row=con.execute("SELECT id,view FROM shots WHERE status='pending' ORDER BY created LIMIT 1").fetchone()
        return jsonify(id=row['id'] if row else None,view=row['view'] if row else None)
    @app.post('/api/screenshots/<ident>')
    def save_shot(ident):
        if request.headers.get('X-House-Viewer')!='life-v2':return jsonify(error='Reload the current Canvas viewer'),409
        data=request.get_data()
        if request.mimetype!='image/png' or not data.startswith(b'\x89PNG\r\n\x1a\n'):return jsonify(error='Expected PNG'),400
        with connect() as con:
            n=con.execute("UPDATE shots SET png=?,status='ready' WHERE id=? AND status='pending'",(data,ident)).rowcount
        return (jsonify(ok=True),200) if n else (jsonify(error='Request unavailable'),409)
    @app.get('/api/screenshots/<ident>')
    def shot(ident):
        with connect() as con:row=con.execute('SELECT * FROM shots WHERE id=?',(ident,)).fetchone()
        if not row:return jsonify(error='Not found'),404
        if row['status']!='ready':return jsonify(status=row['status']),202 if row['status']=='pending' else 410
        return app.response_class(row['png'],mimetype='image/png')
    @app.get('/models/<path:name>')
    def asset(name):return send_from_directory(ROOT/'assets',name)
    @app.get('/')
    def index():return send_from_directory(ROOT/'dist','wander.html')
    @app.get('/<path:name>')
    def static(name):return send_from_directory(ROOT/'dist',name)
    return app

if __name__=='__main__':create_app().run(host='127.0.0.1',port=int(os.getenv('HOUSE_PORT','19130')),threaded=True)
