// Stable IDs and authored framing: no per-outfit bounding-box fitting.
const view=(id,part,label,pose,time,at,height,yaw=0,pitch=0)=>({id,part,label,pose,time,at,height,yaw,pitch});
export const studio=[
 view('front','全身','正面','rest',.5,[0,.48,0],1.10),
 view('side','全身','侧面','rest',.5,[0,.48,0],1.10,90),
 view('back','全身','背面','rest',.5,[0,.48,0],1.10,180),
 view('face','脸与下巴','眼睛与眉毛','rest',.5,[0,.70,.12],.30),
 view('chin','脸与下巴','好奇抬头 · 仰拍接缝','curious',1.5,[-.006,.631,.119],.23,0,-36),
 view('collar','肩颈与衣领','转头 · 披肩与领口','look-around',1.5,[0,.55,.08],.27,32,5),
 view('wave','袖口与手','招手 · 左手腕','wave',1.6,'LeftHand',.21,32,10),
 view('elbow','肩颈与衣领','抬臂 · 上袖与腋下','wave',1.6,'LeftForeArm',.30,48,4),
 view('book','袖口与手','抱书 · 两手与袖口','hold-book',.5,'hands',.37,15,15),
 view('left-hand','袖口与手','垂手 · 左手指尖','rest',.5,'LeftHand',.15,65,10),
 view('right-hand','袖口与手','垂手 · 右手指尖','rest',.5,'RightHand',.15,-65,10),
 view('hem','腰与下摆','坐下 · 裙摆与椅面','sit-pose',.5,'Hips',.49,38,12),
 view('knees','双腿与脚','迈步 · 膝盖与裤腿','little-run',.35,'knees',.45,70,7),
 view('socks','双腿与脚','站立 · 袜头与鞋面','rest',.5,[0,.051,.085],.22,32,30),
 view('stride','双腿与脚','小跑 · 双脚分开','little-run',.35,'feet',.29,38,9),
];
export const bed=['仰睡','侧睡'].map((label,i)=>({id:i?'bed-side':'bed-back',part:'在家盖被',label,pose:'sleep',side:i,camera:'side',target:'childroom-bed'}));
