"""Catalog-declared supporting surfaces. No arbitrary client-controlled height."""
import math


def definition(obj, assets, catalog):
    return assets[obj['asset_id']] if obj.get('asset_id') else catalog[obj['kind']]


def height_of(obj, objects, assets, catalog, seen=None):
    seen = set() if seen is None else seen
    if obj['id'] in seen:
        return 0
    seen.add(obj['id'])
    on = obj.get('on')
    if not on:
        return definition(obj, assets, catalog).get('elevation', 0)
    parent = next((p for p in objects if p['id'] == on['id']), None)
    if not parent:
        return 0
    surface = definition(parent, assets, catalog).get('surfaces', {}).get(on['surface'])
    return height_of(parent, objects, assets, catalog, seen) + surface['height'] + definition(obj,assets,catalog).get('support_offset',0) if surface else 0


def parse_support(value):
    if not isinstance(value, dict) or set(value) != {'id','surface','x','z','yaw'}:
        raise ValueError('on requires id, surface, x, z and yaw; offsets are relative to the supporting surface')
    if not isinstance(value['id'], str) or not 1 <= len(value['id']) <= 64:
        raise ValueError('Invalid support id')
    if not isinstance(value['surface'], str) or not 1 <= len(value['surface']) <= 64:
        raise ValueError('Choose a surface id from the supporting asset catalog')
    for key in ['x','z','yaw']:
        n = value[key]
        if isinstance(n, bool) or not isinstance(n, (int,float)) or not math.isfinite(n) or abs(n) > (math.tau if key == 'yaw' else 3):
            raise ValueError('Support offsets and yaw must be bounded finite numbers')
    return dict(value)


def resolve_supports(objects, assets, catalog):
    """Update derived world poses on a transaction copy, collecting all errors."""
    by_id = {o['id']:o for o in objects}
    resolved, visiting, invalid, errors = set(), set(), set(), []

    def error(code, obj, message):
        invalid.add(obj['id'])
        errors.append({'code':code,'ids':[obj['id']],'message':message,'suggestion':'检查 get_catalog 中的承载面和物品尺寸；先调整摆放，再预演。'})

    def visit(obj):
        ident = obj['id']
        if ident in resolved:
            return ident not in invalid
        if ident in visiting:
            error('support_cycle',obj,'物品之间不能循环承载。')
            return False
        visiting.add(ident)
        own = definition(obj, assets, catalog)
        on = obj.get('on')
        if own.get('placement') == 'surface' and not on:
            error('surface_required',obj,'这个物品需要放在目录声明的承载面上。')
        if on:
            if own.get('placement') != 'surface':
                error('support_not_allowed',obj,'此家具不是桌面或层板摆件。')
            parent = by_id.get(on['id'])
            if not parent:
                error('support_missing',obj,'承载家具不存在；移除家具时也需处理上面的物品。')
            elif visit(parent):
                surface = definition(parent, assets, catalog).get('surfaces',{}).get(on['surface'])
                if not surface:
                    error('surface_unknown',obj,'承载家具没有这个承载面。')
                else:
                    cx,cz = surface.get('center',[0,0]);x,z = cx+on['x'],cz+on['z']
                    c,s = math.cos(parent['yaw']),math.sin(parent['yaw'])
                    obj.update(x=parent['x']+x*c+z*s,z=parent['z']-x*s+z*c,yaw=parent['yaw']+on['yaw'])
                    w,d = own['size'];c,s = abs(math.cos(on['yaw'])),abs(math.sin(on['yaw']))
                    if abs(on['x'])+(w*c+d*s)/2 > surface['size'][0]/2+.002 or abs(on['z'])+(w*s+d*c)/2 > surface['size'][1]/2+.002:
                        error('support_overhang',obj,'物品超出承载面的安全边缘。')
            else:
                error('support_invalid',obj,'承载关系未通过检查。')
        visiting.remove(ident)
        resolved.add(ident)
        return ident not in invalid

    for obj in objects:
        visit(obj)
    return errors


def supports_pair(a, b, objects):
    """A validated interior shelf surface replaces its parent's coarse solid box."""
    by_id = {o['id']:o for o in objects}
    def ancestor(child, parent):
        seen = set()
        while child.get('on') and child['id'] not in seen:
            seen.add(child['id'])
            ident = child['on']['id']
            if ident == parent['id']:
                return True
            child = by_id.get(ident, {})
        return False
    return ancestor(a,b) or ancestor(b,a)
