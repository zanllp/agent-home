// Original screen art; painted once per display, never copied from the host desktop.
export function drawHarborPaper(c,w,h){
 const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#5795bc');sky.addColorStop(.53,'#aecfd7');sky.addColorStop(1,'#efe1bd');
 c.fillStyle=sky;c.fillRect(0,0,w,h);
 c.fillStyle='#f6dfae';c.beginPath();c.arc(w*.83,h*.24,Math.min(w,h)*.071,0,Math.PI*2);c.fill();
 const ridge=(points,color)=>{
  c.beginPath();c.moveTo(0,h);for(const [x,y] of points)c.lineTo(x*w,y*h);c.lineTo(w,h);c.closePath();c.fillStyle=color;c.fill();
 };
 ridge([[0,.61],[.12,.50],[.22,.54],[.37,.31],[.58,.57],[.72,.43],[.90,.25],[1,.40]],'#8faebd');
 ridge([[0,.71],[.22,.55],[.35,.63],[.50,.44],[.65,.60],[.79,.48],[.92,.54],[1,.45]],'#678da1');
 ridge([[0,.73],[.26,.64],[.45,.68],[.60,.60],[.82,.59],[1,.55]],'#587b8b');
 c.fillStyle='#89b6c2';c.fillRect(0,h*.73,w,h*.27);
 for(let i=0;i<22;i++){const x=(i*.113)%1,y=.74+(i*.037)%.24;c.fillStyle=i%2?'#a3c7cb':'#bfd4cf';c.fillRect(x*w,y*h,(.015+.019*(i%3))*w,1.2)}
 ridge([[0,.82],[.16,.80],[.28,.85],[.45,.87],[.60,.94],[.77,.96],[1,1]],'#79988b');
 c.fillStyle='#faf0d5';c.beginPath();c.moveTo(.84*w,.756*h);c.lineTo(.84*w,.68*h);c.lineTo(.818*w,.756*h);c.fill();
 c.fillStyle='#937a63';c.fillRect(.813*w,.76*h,.043*w,h*.006);
}
