"""Read-only batch planning; the command transaction owns persistence."""
import copy
import math
from collections import deque
from room_geometry import boundaries
from object_interactions import busy, world_point
from furniture_support import height_of, supports_pair, resolve_supports


def geometry_issues(objects, assets, catalog, room=None):
    bounds_room=boundaries(room)
    issues = []
    boxes = []
    for obj in objects:
        definition = assets[obj['asset_id']] if obj.get('asset_id') else catalog[obj['kind']]
        w, d = definition['size']; c, s = abs(math.cos(obj['yaw'])), abs(math.sin(obj['yaw']))
        w, d = c*w+s*d, s*w+c*d
        y = height_of(obj, objects, assets, catalog); h = definition['height']
        bounds = {'x': [obj['x']-w/2, obj['x']+w/2], 'z': [obj['z']-d/2, obj['z']+d/2], 'y': [y, y+h]}
        overflow = {axis: round(max(0, -limit-values[0], values[1]-limit), 4) for axis, values, limit in [('x', bounds['x'], bounds_room['furniture_x']), ('z', bounds['z'], bounds_room['furniture_z'])]}
        if any(overflow.values()) or y<-.001 or y+h > bounds_room['height']:
            issues.append({'code': 'outside_room', 'ids': [obj['id']], 'bounds': bounds, 'overflow_m': overflow, 'message': '家具超出墙面或天花板。', 'suggestion': '向室内移动，或从目录选择更小的款式。'})
        if definition.get('placement') == 'wall':
            angle = math.atan2(math.sin(obj['yaw']), math.cos(obj['yaw']))
            if not (abs(angle)<.001 and abs(obj['z']-(-bounds_room['furniture_z']+d/2))<.025 or abs(angle-math.pi/2)<.001 and abs(obj['x']-(-bounds_room['furniture_x']+w/2))<.025):
                issues.append({'code': 'wall_mount', 'ids': [obj['id']], 'message': '此挂件需朝内贴在后墙或左墙。', 'suggestion': '按 get_catalog.room 当前内边界贴墙；后墙 yaw=0，左墙 yaw=π/2。'})
        if obj['kind'] == 'rug': continue
        for other, ow, od, oy, oh in boxes:
            if supports_pair(obj,other,objects): continue
            if y+h <= oy+.01 or oy+oh <= y+.01: continue
            dx = (w+ow)/2-abs(obj['x']-other['x']); dz = (d+od)/2-abs(obj['z']-other['z'])
            if dx > .015 and dz > .015:
                issues.append({'code': 'overlap', 'ids': [other['id'], obj['id']], 'overlap_m': {'x': round(dx, 4), 'z': round(dz, 4)}, 'message': '两件家具的保守包围盒重叠。', 'suggestion': '拉开间距或旋转后重新 dry-run；这不是逐三角形碰撞检测。'})
        boxes.append((obj, w, d, y, h))
    return issues


def navigation_report(objects, assets, catalog, body, room=None):
    bounds_room=boundaries(room)
    solids = []
    for obj in objects:
        if obj['kind'] == 'rug' or obj.get('on'): continue
        definition = assets[obj['asset_id']] if obj.get('asset_id') else catalog[obj['kind']]
        solids.append((obj, *definition['size'], math.cos(obj['yaw']), math.sin(obj['yaw'])))

    def free(p, radius=.57, ignore=None):
        x, z = p['x'], p['z']
        if abs(x)>bounds_room['furniture_x']-.1-radius or abs(z)>bounds_room['furniture_z']-.1-radius: return False
        for obj, w, d, c, s in solids:
            if obj['id'] == ignore: continue
            dx, dz = x-obj['x'], z-obj['z']
            if math.hypot(max(0, abs(dx*c-dz*s)-w/2), max(0, abs(dx*s+dz*c)-d/2)) < radius: return False
        return True

    def line(a, b, radius=.57, ignore=None):
        steps = max(1, math.ceil(math.hypot(a['x']-b['x'], a['z']-b['z'])/.025))
        return all(free({'x': a['x']+(b['x']-a['x'])*i/steps, 'z': a['z']+(b['z']-a['z'])*i/steps}, radius, ignore) for i in range(steps+1))

    points = {(i, j): {'x': -bounds_room['body_x']+i*.1, 'z': -bounds_room['body_z']+j*.1} for i in range(math.floor(bounds_room['body_x']*20)+1) for j in range(math.floor(bounds_room['body_z']*20)+1)}
    points = {k:p for k,p in points.items() if free(p)}
    reached = set()
    if free(body) and points:
        # Seed only cells with a verified connection to the real/persisted body.
        reached = {k for k,p in points.items() if math.hypot(p['x']-body['x'], p['z']-body['z'])<.2 and line(body,p)}
        queue = deque(reached)
        while queue:
            key = queue.popleft()
            for dx,dz in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
                nxt = (key[0]+dx,key[1]+dz)
                if nxt in points and nxt not in reached and line(points[key],points[nxt]):
                    reached.add(nxt); queue.append(nxt)
    interactions = []
    for obj in objects:
        for action, config in assets.get(obj.get('asset_id'),{}).get('interactions',{}).items():
            root = world_point(obj,config['root']); approaches = []
            for i,local in enumerate(config['approaches']):
                point = world_point(obj,local)
                standing = free(point)
                entry = standing and line(point,root,.32,obj['id'])
                reachable = entry and any(math.hypot(points[k]['x']-point['x'],points[k]['z']-point['z'])<.2 and line(points[k],point) for k in reached)
                approaches.append({'index':i,'position':point,'clear':standing,'entry_clear':entry,'reachable':reachable})
            interactions.append({'id':obj['id'],'action':action,'reachable':any(a['reachable'] for a in approaches),'approaches':approaches})
    return {'body_clear':free(body), 'free_cells':len(points), 'reachable_cells':len(reached), 'interactions':interactions, 'grid_step_m':.1, 'radius_m':.57, 'basis':'Approximate 2D catalog rectangles, same radii as viewer; not mesh/cloth collision or a guarantee of pose quality.'}


def plan_layout(state, args, assets, catalog, mutate, snapshot=None, now=0):
    if not isinstance(args,dict) or set(args)-{'operations','dry_run'}: raise ValueError('Unknown layout argument')
    if not isinstance(args.get('dry_run',True),bool): raise ValueError('dry_run must be boolean')
    operations = args.get('operations')
    if not isinstance(operations,list) or not 1<=len(operations)<=80: raise ValueError('Expected 1..80 layout operations')
    trial = copy.deepcopy(state); errors=[]; warnings=[]
    for index, operation in enumerate(operations):
        try:
            if not isinstance(operation,dict) or operation.get('op') not in ['add','update','remove']: raise ValueError('op must be add, update or remove')
            op = operation['op']; item = {k:v for k,v in operation.items() if k!='op'}
            if op=='add':
                asset = item.get('asset_id')
                if not isinstance(asset,str) or asset not in assets: raise ValueError('Choose asset_id from get_catalog.assets')
                if 'kind' in item: raise ValueError('kind is derived from the selected asset')
                item['kind']=assets[asset]['kind']
            trial = mutate(trial,{'tool':{'add':'place_furniture','update':'update_furniture','remove':'remove_furniture'}[op],'arguments':item},check_geometry=False,check_busy=False)
        except (ValueError,TypeError) as exc:
            errors.append({'code':'invalid_operation','operation_index':index,'message':str(exc),'suggestion':'按工具定义和目录修正这条操作，再重试整批。'})
    errors.extend(resolve_supports(trial['objects'],assets,catalog))
    errors.extend(geometry_issues(trial['objects'],assets,catalog,trial.get('room')))
    if busy(state): errors.append({'code':'interaction_busy','ids':[state.get('interaction',{}).get('target_id')], 'message':'正在与物品互动；可以预演，但现在不能挪动家具。','suggestion':'结束当前互动后重新预演并应用。'})
    fresh = bool(snapshot and snapshot.get('visible') and 0<=now-snapshot['received_at']<6)
    body = snapshot['body'] if fresh else state['character']
    if not fresh: warnings.append({'code':'body_not_fresh','message':'没有新鲜的角色位置，暂按最后保存的位置检查。','suggestion':'打开小家页面，等待身体反馈后重新 dry-run。'})
    elif body.get('moving'): errors.append({'code':'body_moving','message':'角色正在走动；预演可继续，正式应用需先停稳。','suggestion':'先休息一下，再重新 dry-run。'})
    navigation = navigation_report(trial['objects'],assets,catalog,body,trial.get('room'))
    if not navigation['body_clear']: errors.append({'code':'body_blocked','message':'新布置占据角色脚下位置或所需站立空间。','suggestion':'先让她走到空地，或调整家具位置；不会自动瞬移角色。'})
    for interaction in navigation['interactions']:
        if not interaction['reachable']: warnings.append({'code':'interaction_unreachable','ids':[interaction['id']],'action':interaction['action'],'message':'当前起点未找到可走到且可进入的互动接近点。','suggestion':'给座位或床边留出通道，调整朝向；在实际页面再次检查。'})
    old={o['id']:o for o in state['objects']}; new={o['id']:o for o in trial['objects']}
    changes={'added':[k for k in new if k not in old], 'removed':[k for k in old if k not in new], 'updated':[k for k in new if k in old and new[k]!=old[k]]}
    trial['revision']=state['revision']+1
    report={'dry_run':args.get('dry_run',True),'base_revision':state['revision'],'can_apply':not errors,'changes':changes,'errors':errors,'warnings':warnings,'objects':trial['objects'],'navigation':navigation,'body_source':'fresh_viewer' if fresh else 'persisted_state','collision_basis':'Conservative rotated AABB with height ranges; rugs excluded.'}
    return trial,report
