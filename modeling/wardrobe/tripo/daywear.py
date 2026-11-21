"""Fit the three independent school/daywear Tripo exports to the contact rig."""
import sys
from pathlib import Path

import numpy as np
from cuffs import clip_cuffs
from feet import repair
from fit import fit, smooth

# Source measurements: oblique wrist end, band centre across/depth, arm/torso join.
PROFILES = {
    'sailor-day': (-.383, .598, -.008, .785),
    'school-track': (-.353, .567, -.029, .690),
    'lilac-reader': (-.379, .598, .004, .767),
}


def normalized(pos, lo, hi):
    q = (pos - (lo+hi)/2) / (hi[1]-lo[1])
    q[:, 1] += .5
    return q


def fit_daywear(outfit, raw, prepared, base, output):
    rim, band, depth, join = PROFILES[outfit]
    pants = outfit == 'school-track'

    def cut(arr, indices, lo, hi):
        x, h, z = normalized(arr['POSITION'], lo, hi).T
        s = .55*abs(x)-.835*h
        region = (abs(x)>.19) & (h>.56) & (h<.78) & (.835*abs(x)+.55*h>.515)
        arr, indices = clip_cuffs(arr, indices, np.where(region, s-rim, -1))
        # Follow the surface below the armpit, not proximity: a hanging cuff
        # is often closer to a skirt fold than to the shoulder that drives it.
        q = normalized(arr['POSITION'], lo, hi)
        tri = indices.reshape(-1, 3)
        _, weld = np.unique(q.round(5), axis=0, return_inverse=True)
        parent = np.arange(weld.max()+1)
        def root(a):
            while parent[a]!=a:
                parent[a]=parent[parent[a]]
                a=parent[a]
            return a
        for a,b,c in weld[tri[q[tri,1].max(1)<join]]:
            parent[root(b)] = root(a)
            parent[root(c)] = root(a)
        islands = np.array([root(i) for i in weld])
        x,h,z=q.T
        seed=(abs(x)>.205)&(h>.56)&(h<join-.025)&(.835*abs(x)+.55*h>band-.055)
        labels=np.unique(islands[seed])
        # A sewn join may start below the measured cut; never classify
        # the whole jacket/skirt as sleeve on account of that single seam.
        labels=np.setdiff1d(labels,np.unique(islands[h<.50]))
        nonlocal sleeves, adjacency
        if pants:
            a,b,c=weld[tri].T
            edges=np.unique(np.sort(np.vstack((np.column_stack((a,b)),np.column_stack((b,c)),np.column_stack((c,a)))),axis=1),axis=0)
            a,b=np.vstack((edges,edges[:,::-1])).T
            adjacency=(weld,a,b)
        sleeves=np.isin(islands,labels).astype(float)
        return arr, indices

    sleeves=adjacency=None
    def bind(pos, lo, hi, names):
        x,h,z=normalized(pos,lo,hi).T
        ax=abs(x);left=x>0;sg=np.where(left,1,-1)
        s=.55*ax-.835*h;k=.835*ax+.55*h
        shoulder=np.interp(h,[join-.04,join+.04,.89,.98],[.145,.113,.093,.068])
        if pants:
            # The boxy track jacket is considerably wider than the two bodices;
            # keep its side panels on the ribs as the forearms lift the book.
            shoulder=np.interp(h,[.65,.70,.76,.85,.98],[.191,.165,.143,.11,.068])
        analytic=smooth(shoulder-.024,shoulder+.024,ax)*(1-smooth(.90,.995,h))
        mix=smooth(join-.047,join,h)
        arm=(1-mix)*sleeves+mix*analytic
        # Preserve any very small separated pieces of the distal sleeves.
        end=smooth(rim-.12,rim-.025,s)*smooth(band-.082,band-.052,k)*smooth(.56,.60,h)*(1-smooth(.79,.85,h))
        if pants:
            # The inner lip of the right cuff falls below the left cuff.
            # Even where the scan is sewn to the hem, it belongs to the wrist.
            end=np.maximum(end,smooth(.205,.230,ax)*smooth(.50,.55,h)*(1-smooth(.69,.76,h))*smooth(rim-.12,rim-.025,s))
        arm=np.maximum(arm,end)
        y=np.interp(h,[0,.15,.34,.57,.78,1],[.002,.094,.218,.357,.477,.603])
        xyz=np.column_stack((x*.65-.006,y,z*.57+.071-(depth*.57 if pants else 0)))
        # Source tube aligned to the actual (asymmetric) bind wrists.
        axis=np.column_stack((.76*sg,np.full_like(x,-.62),np.full_like(x,.18)))
        axis/=np.linalg.norm(axis,axis=1)[:,None]
        lat=np.column_stack((.62*sg,np.full_like(x,.76),np.zeros_like(x)))
        lat/=np.linalg.norm(lat,axis=1)[:,None]
        dep=np.cross(axis,lat)*sg[:,None]
        ctr=np.column_stack((np.where(left,.190,-.207),np.full_like(x,.376),np.full_like(x,.093)))
        tube=ctr+axis*((s-rim)*.64)[:,None]+lat*((k-band)*.55)[:,None]+dep*((z-depth)*.57)[:,None]
        xyz=xyz*(1-end[:,None])+tube*end[:,None]
        if pants:
            leg=1-smooth(.44,.58,h)
        else:
            radial=np.hypot(x,z)
            leg=(1-smooth(.14,.19,radial))*(1-smooth(.318,.399,h))
            leg=np.maximum(leg,1-smooth(.31,.346,h))
        body=1-leg-arm
        w=np.zeros((len(x),len(names)))
        def add(b,v):w[:,names.index(b)]+=v
        spine=smooth(.405,.457,y);chest=smooth(.462,.525,y)
        add('Hips',body*(1-spine));add('Spine1',body*(spine-chest));add('Spine2',body*chest)
        for side,part in [('Left',left),('Right',~left)]:
            thigh=smooth(.161,.239,y);shin=(1-thigh)*smooth(.058,.103,y)
            add(side+'UpLeg',leg*thigh*part);add(side+'Leg',leg*shin*part);add(side+'Foot',leg*(1-thigh-shin)*part)
            fore=1-smooth(.419,.474,xyz[:,1])
            if pants:
                fore*=smooth(.13,.24,ax)
            hand=end*(1-smooth(.387,.419,xyz[:,1]))*np.where(left,.46,.65)
            add(side+'Arm',arm*(1-fore)*part);add(side+'ForeArm',arm*fore*(1-hand)*part);add(side+'Hand',arm*fore*hand*part)
        if pants:
            # Diffuse weights across the stitched underarm on the welded surface
            # (including UV seams), never across empty space to adjacent fabric.
            weld,a,b=adjacency
            blend=(smooth(.62,.68,h)*(1-smooth(.83,.90,h)))[:,None]
            count=np.bincount(weld)
            degree=np.bincount(a)
            for j in np.flatnonzero(np.any(w>0,axis=0)):
                v=np.bincount(weld,weights=w[:,j])/count
                for _ in range(10):
                    v=.3*v+.7*np.bincount(a,weights=v[b],minlength=len(v))/np.maximum(degree,1)
                w[:,j]+=(v[weld]-w[:,j])*blend[:,0]
        skirt=(1-arm)*(1-leg)*(1-smooth(.40,.68,h)) if not pants else np.zeros_like(h)
        front=smooth(-.13,.14,z)
        seat=np.zeros_like(xyz);seat[:,1]=skirt*(.033+.073*front);seat[:,2]=skirt*(.016+.099*front)
        lying=np.zeros_like(xyz);lying[:,0]=-skirt*x*.25;lying[:,2]=-skirt*z*.31
        return xyz,w,seat,lying

    tmp=Path(prepared).with_name('bound.glb')
    fit(prepared,base,tmp,bind,cutter=cut,name=outfit+'-Tripo',targets=('SeatedFit','LyingFit'),original_color=raw)
    repair(tmp,output)


if __name__=='__main__':
    fit_daywear(*sys.argv[1:])
