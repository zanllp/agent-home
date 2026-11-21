"""Fit Snow Letter's actual Tripo mesh; all coordinates are measured on its three-view export."""
import sys
import numpy as np
from fit import fit,smooth
from cuffs import clip_cuffs

def normalized(pos,lo,hi):
    q=(pos-(lo+hi)/2)/(hi[1]-lo[1]);q[:,1]+=.5
    return q.T

# Oblique section across the lace opening, in the source sleeve's frame.
RIM=-.282
def open_lace(arrays,indices,lo,hi):
    x,h,z=normalized(arrays['POSITION'],lo,hi);ax=abs(x)
    s=.64*ax-.768*h
    region=(h>.56)&(h<.70)&(ax>.21)&(abs(z)<.083)
    return clip_cuffs(arrays,indices,np.where(region,s-RIM,-1))

def snow_letter(pos,lo,hi,names):
    x,h,z=normalized(pos,lo,hi);ax=abs(x);left=x>0;sign=np.where(left,1.,-1.)
    # Below the cape's fur edge the sleeves clear the skirt and bodice.
    # Above it the cape belongs to the shoulders, not the rotating wrists.
    edge=np.interp(h,[.56,.59,.62,.66,.70,.74,.78],[.228,.222,.198,.155,.137,.111,.103])
    arm=smooth(edge-.004,edge+.006,ax)*smooth(.555,.568,h)*(1-smooth(.747,.824,h))
    # The scan joins its stocking tops to the underside of the petticoat.
    # Leave the outer lace on the pelvis and blend only the two inner joins.
    radial=np.hypot(x,z)
    leg=(1-smooth(.108,.173,radial))*(1-smooth(.285,.355,h))
    y=np.interp(h,[0,.12,.30,.58,.75,.94,1],[.002,.086,.225,.367,.463,.579,.605])
    xyz=np.stack([x*.63-.006,y,z*.57+.071],axis=1)
    # Centre each sleeve mouth on the corresponding original painted hand.
    station=.64*ax-.768*h;across=.768*ax+.64*h
    end=arm*smooth(-.455,-.347,station)
    axis=np.column_stack((.76*sign,np.full_like(h,-.62),np.full_like(h,.18)))
    axis/=np.linalg.norm(axis,axis=1)[:,None]
    lat=np.column_stack((.62*sign,np.full_like(h,.76),np.zeros_like(h)))
    lat/=np.linalg.norm(lat,axis=1)[:,None];depth=np.cross(axis,lat)*sign[:,None]
    center=np.column_stack((np.where(left,.190,-.207),np.full_like(h,.376),np.full_like(h,.093)))
    ring=center+axis*((station-RIM)*.66)[:,None]+lat*((across-.606)*.55)[:,None]+depth*((z-.014)*.57)[:,None]
    xyz=xyz*(1-end[:,None])+ring*end[:,None]
    w=np.zeros((len(x),len(names)))
    def add(n,v):w[:,names.index(n)]+=v
    body=1-arm-leg;spine=smooth(.405,.457,y);chest=smooth(.462,.524,y)
    add('Hips',body*(1-spine));add('Spine1',body*(spine-chest));add('Spine2',body*chest)
    for label,part in [('Left',left),('Right',~left)]:
        thigh=smooth(.163,.235,y);shin=(1-thigh)*smooth(.058,.102,y)
        add(label+'UpLeg',leg*thigh*part);add(label+'Leg',leg*shin*part);add(label+'Foot',leg*(1-thigh-shin)*part)
        fore=1-smooth(.415,.465,y);hand=end*np.where(left,.46,.65)
        add(label+'Arm',arm*(1-fore)*part);add(label+'ForeArm',arm*fore*(1-hand)*part);add(label+'Hand',arm*fore*hand*part)
    # The full skirt rotates up over the lap, while the seated rear falls
    # toward the chair. Keep its snow-scene print on the source triangles.
    skirt=(1-arm)*(1-leg)*(1-smooth(.40,.69,h))
    front=smooth(-.135,.15,z)
    seat=np.zeros_like(xyz);seat[:,1]=skirt*(.031+.068*front);seat[:,2]=skirt*(.009+.092*front)
    lying=np.zeros_like(xyz)
    lying[:,0]=-skirt*x*.27
    lying[:,2]=-skirt*z*.30
    return xyz,w,seat,lying

if __name__=='__main__':
    if len(sys.argv)!=5:
        sys.exit('usage: winter.py prepared.glb character.glb outfit.glb original-tripo.glb')
    fit(*sys.argv[1:4],snow_letter,cutter=open_lace,name='Snow-letter-Tripo',targets=('SeatedFit','LyingFit'),original_color=sys.argv[4])
