import sys, random, numpy as np
from PIL import Image, ImageOps
D=sys.argv[1]; ACROSS=float(sys.argv[2]); OUT=sys.argv[3]; TS='art/tileset-grok/'
SW,SH=1080,1830
W=1080/ACROSS; RATIO=1.55; H=W/RATIO
cache={}
def tile(n):
    if n in cache: return cache[n]
    im=Image.open(TS+n+'.png').convert('RGBA'); a=np.array(im)[:,:,3]>128
    ys,xs=np.nonzero(a); minx,maxx=xs.min(),xs.max(); L=np.nonzero(a[:,minx+2])[0]
    s=W/(maxx-minx); im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    cache[n]=(im,minx*s,L.min()*s); return cache[n]
def road(mask):
    k=('road',mask)
    if k in cache: return cache[k]
    r=Image.open(f'art/road-iso/road-{mask:02d}.png').convert('RGBA')
    a=r.split()[3]; g=ImageOps.colorize(r.convert('L'),(110,78,48),(222,186,132)).convert('RGBA'); g.putalpha(a)
    g=g.resize((round(W),round(H)),Image.LANCZOS); cache[k]=g; return g
random.seed(7)
N=18
lay={(c,r):random.choice(['grass','grass','grass-tufty','grass-flowers']) for c in range(N) for r in range(N)}
def put(cells,n):
    for c in cells: lay[c]=n
put([(c,r) for c in (3,4,5) for r in (3,4,5)],'wheat-a')
put([(10,2),(11,2),(11,3),(12,3),(12,4),(10,1),(11,1),(12,2)],'mountain-a'); lay[(11,4)]='mountain-b'; lay[(12,5)]='mountain-c'; lay[(10,3)]='mountain-b'
lay[(9,4)]='castle'; lay[(10,5)]='rocks'; lay[(8,3)]='bushes'; lay[(9,3)]='bushes'
put([(3,9),(4,9),(3,10),(4,10),(5,10)],'tilled')
put([(4,12),(5,12),(4,13)],'pasture-cows')
lay[(9,9)]='house-thatch'; lay[(10,9)]='house-blue'; lay[(9,10)]='barn'; lay[(10,10)]='house-thatch'
put([(12,11),(13,11),(13,12),(12,12),(13,10)],'water'); lay[(11,12)]='shore'
roads={(7,r) for r in range(2,15)}|{(c,8) for c in range(2,12)}|{(8,4)}
def mask(c,r): return (1 if (c,r-1) in roads else 0)|(2 if (c+1,r) in roads else 0)|(4 if (c,r+1) in roads else 0)|(8 if (c-1,r) in roads else 0)
cx,cy=8.0,8.0
ox=SW/2-(cx-cy)*W/2; oy=SH/2-(cx+cy)*H/2-H*0.5
img=Image.new('RGBA',(SW,SH),(20,24,33,255))
for c,r in sorted(lay,key=lambda t:(t[0]+t[1],t[0])):
    n=lay[(c,r)]
    if (c,r) in roads: n='grass'
    im,lx,ly=tile(n); gx=ox+(c-r)*W/2-W/2; gy=oy+(c+r)*H/2+H/2
    img.alpha_composite(im,(round(gx-lx),round(gy-ly)))
    if (c,r) in roads: img.alpha_composite(road(mask(c,r)),(round(gx),round(gy-H/2)))
def sprite(path,c,r,h,dx=0,dy=0,mirror=False):
    im=Image.open(path).convert('RGBA'); im=im.crop(im.getbbox())
    if mirror: im=im.transpose(Image.FLIP_LEFT_RIGHT)
    h=round(h*W/154); w=round(im.width*h/im.height); im=im.resize((w,h),Image.LANCZOS)
    x=ox+(c-r)*W/2; y=oy+(c+r)*H/2+H/2
    img.alpha_composite(im,(round(x-w/2+dx*W/154),round(y-h+dy*W/154)))
sprite('art/wagon/wagon-toward.png',7,11,62,0,10)
sprite('art/army/bearer-crimson-toward.png',4,8,72,-6,8); sprite('art/army/soldier-toward.png',4,8,58,24,14); sprite('art/army/soldier-toward.png',4,8,58,-34,18)
sprite('art/props/prop-logs.png',8,10,30,30,0); sprite('art/props/prop-sawhorse.png',8,10,26,-20,4)
sprite('art/props/prop-cow.png',6,13,28,10,0); sprite('art/props/prop-cow.png',6,12,28,-10,6,True)
hud=Image.open(D+'/hud_alpha.png')
screen=Image.new('RGBA',(1080,2280),(13,11,9,255)); screen.alpha_composite(img,(0,0)); screen.alpha_composite(hud)
screen.convert('RGB').save(OUT)
