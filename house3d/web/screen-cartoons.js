// A small original TV channel, drawn in a 640 x 360 frame. No video decoder or network.
const TAU=Math.PI*2;
function dot(c,x,y,rx,ry,color,angle=0){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,TAU);c.fill()}
function stroke(c,points,color,width){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke()}
function sky(c,a,b){const g=c.createLinearGradient(0,0,0,360);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(0,0,640,360)}
function cloud(c,x,y,s){
 for(const [u,v,r] of [[-26,5,18],[-9,-4,22],[13,-2,18],[29,7,15]])dot(c,x+u*s,y+v*s,r*s,r*.63*s,'#fff2d6');
}
function hills(c,t,y,color){c.fillStyle=color;c.beginPath();c.moveTo(0,360);
 for(let x=0;x<=640;x+=8)c.lineTo(x,y+24*Math.sin(x*.013+t*.15)+10*Math.sin(x*.024+t*.2));c.lineTo(640,360);c.fill()}
function cat(c,t){
 const cream='#ffe5b1',outline='#725148';// A calico with a patched ear and a blinking face.
 for(const s of [-1,1]){c.fillStyle=s<0?'#d28a5c':cream;c.beginPath();c.moveTo(s*29,-7);c.lineTo(s*26,-46);c.lineTo(s*5,-27);c.closePath();c.fill()}
 dot(c,0,-5,33,25,cream);dot(c,-14,-18,12,8,'#dc9c65',-.4);
 const blink=t%3.6>3.4;for(const s of [-1,1]){dot(c,s*12,-6,2.4,blink?.9:3.6,outline);dot(c,s*21,1,5,2.8,'#efa78a')}
 dot(c,0,-1,3,2,outline);stroke(c,[[-5,4],[0,6],[5,4]],outline,1.8);
}
function bike(c,t){
 sky(c,'#9fd6da','#fff1c7');dot(c,508,73,36,36,'#ffe6a0');
 for(let i=0;i<4;i++)cloud(c,((i*200+760-t*8)%800)-70,58+23*(i%2),.7+i%2*.2);
 hills(c,t,174,'#a7c7af');hills(c,t*2,215,'#7aa995');
 c.fillStyle='#f5d8a5';c.fillRect(0,263,640,97);
 for(let i=0;i<20;i++){const x=((i*59+1220-t*49)%1180)-20;stroke(c,[[x,297+i%4*12],[x+11,297+i%4*12]],'#d6bb8c',2)}
 c.save();c.translate(236+45*Math.sin(t*.53),242+2*Math.sin(t*5));
 for(const x of [-41,43]){dot(c,x,26,23,23,'#4e6766');dot(c,x,26,18,18,'#f0dcac');for(let i=0;i<4;i++){const a=t*2+i*Math.PI/2;stroke(c,[[x,26],[x+17*Math.cos(a),26+17*Math.sin(a)]],'#acb6a1',2)}}
 stroke(c,[[-41,26],[-15,-5],[4,24],[-41,26]],'#d06852',6);stroke(c,[[4,24],[30,-8],[43,26]],'#d06852',6);
 dot(c,-14,-24,18,27,'#7293a1');c.save();c.translate(-13,-51);cat(c,t);c.restore();
 stroke(c,[[-4,-32],[12,-20],[30,-19]],'#ffdda8',7);stroke(c,[[30,-19],[35,-18],[43,26]],'#56716c',4);
 const a=t*4;stroke(c,[[-12,-4],[1,-1],[5+9*Math.cos(a),17+6*Math.sin(a)]],'#725f56',6);c.restore();
}
function sea(c,t){
 sky(c,'#a3d4e4','#f9efcc');cloud(c,100+18*Math.sin(t*.25),64,.92);cloud(c,486,93,.65);dot(c,550,55,29,29,'#ffebaa');
 c.fillStyle='#7bb9c8';c.fillRect(0,168,640,192);
 for(let row=0;row<4;row++)for(let x=-1;x<9;x++){const u=x*90+(t*(8+row*3))%90;stroke(c,[[u,188+row*42],[u+8,191+row*42],[u+22,189+row*42]],'#cae4db',2)}
 c.save();c.translate(285+65*Math.sin(t*.33),207+6*Math.sin(t*1.5));c.rotate(.055*Math.sin(t*1.5));
 stroke(c,[[10,-120],[10,14]],'#745f53',5);c.fillStyle='#fff1c6';c.beginPath();c.moveTo(15,-116);c.quadraticCurveTo(48,-84,88,-28);c.lineTo(15,-25);c.closePath();c.fill();
 c.save();c.translate(-30,-20);cat(c,t);c.restore();c.fillStyle='#bd6651';c.beginPath();c.moveTo(-84,-6);c.lineTo(92,-6);c.quadraticCurveTo(61,41,-50,29);c.closePath();c.fill();stroke(c,[[-75,0],[84,0]],'#ffcf82',5);c.restore();
}
function night(c,t){
 sky(c,'#283758','#b9a4b1');dot(c,508,81,35,35,'#ffedb0');
 for(let i=0;i<31;i++){const x=i*161%637,y=18+i*43%148,r=1.8+.9*Math.sin(t*2+i);dot(c,x,y,r,r,'#ffe6ae')}
 hills(c,t,229,'#677b87');hills(c,t*2,276,'#45646a');
 c.save();c.translate(271+92*Math.sin(t*.30),152+13*Math.sin(t*1.1));c.rotate(.055*Math.sin(t));
 stroke(c,[[-43,-21],[-24,58]],'#beae8f',3);stroke(c,[[43,-21],[24,58]],'#beae8f',3);
 dot(c,0,-58,64,69,'#e5a578');dot(c,0,-58,34,69,'#ffc885');dot(c,0,-58,12,69,'#eaa374');
 c.save();c.translate(0,52);c.scale(.8,.8);cat(c,t);c.restore();
 c.fillStyle='#a66e55';c.fillRect(-29,53,58,24);stroke(c,[[-30,53],[30,53]],'#ffd09b',5);c.restore();
}
export const cartoons={bike,sea,night};
