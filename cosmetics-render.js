/* All animations are driven by race time, never by the simulation RNG. */
(() => {
  const C=LastStickCosmeticsCore;
  const stroke=(ctx,points)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
  function decorate(ctx,id,t=0,joints=[[-2,-18],[0,-11],[-8,-13],[6,-13],[-6,-5],[6,-5]]){
    ctx.save();ctx.lineWidth=1;
    if(id==='forest-moss'){ctx.fillStyle='#bddb8a';for(const [x,y] of [[-6,-25],[3,-21],[2,-15]]){ctx.beginPath();ctx.ellipse(x,y,3,1.5,-.6,0,Math.PI*2);ctx.fill();}}
    if(id==='rave-pulse'){ctx.strokeStyle='#9dd4d0';ctx.globalAlpha=.5;for(const radius of [10,14]){ctx.beginPath();ctx.arc(-2,-18,radius+Math.sin(t*5),-.65,.65);ctx.stroke();}}
    if(id==='forest-survivor'){ctx.strokeStyle='#dd5454';ctx.lineWidth=2;stroke(ctx,[[-6,-24],[2,-24],[6,-20]]);ctx.strokeStyle='#c4c7b8';stroke(ctx,[[3,-12],[6,-6]]);ctx.strokeStyle='#584c38';stroke(ctx,[[2,-14],[3,-12]]);}
    if(id==='technofather'){
      // Six-sided nuts with a dark bore, attached to the animated joint positions.
      for(const [x,y] of joints){ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;const px=x+2.15*Math.cos(a),py=y+2.15*Math.sin(a);i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fillStyle='#d5d9d5';ctx.strokeStyle='#65736c';ctx.lineWidth=.65;ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(x,y,.85,0,Math.PI*2);ctx.fillStyle='#26322d';ctx.fill();}
      ctx.fillStyle='#bce88b';ctx.beginPath();ctx.arc(-3,-23,.75,0,Math.PI*2);ctx.fill();
    }
    if(id==='bidouille-tribute'){
      // A rounded duck bill and eye replace the old rectangular robot chest.
      ctx.fillStyle='#efbe58';ctx.beginPath();ctx.ellipse(-6,-22.2,3,1.35,-.12,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#203b45';ctx.beginPath();ctx.arc(-3.4,-24,.7,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#e5f7fa';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(-1.2,-23.2,2.5,-1.3,.6);ctx.stroke();
      for(const [x,y] of [joints[0],joints[1]]){ctx.fillStyle='#d7eff4';ctx.beginPath();ctx.arc(x,y,1.35,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6299aa';ctx.beginPath();ctx.arc(x,y,.45,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }
  function preview(ctx,item,t=0){ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.save();if(item.category==='skins'){ctx.translate(62,54);ctx.scale(1.7,1.7);ctx.strokeStyle=item.color;ctx.fillStyle=item.color;ctx.lineWidth=item.id==='forest-moss'?3.6:2.6;ctx.lineCap='round';ctx.beginPath();ctx.arc(-2,-23,3.7,0,Math.PI*2);ctx.fill();stroke(ctx,[[-2,-19],[0,-11]]);stroke(ctx,[[-2,-18],[-8,-13],[-10,-17]]);stroke(ctx,[[-2,-18],[6,-13],[8,-17]]);stroke(ctx,[[0,-11],[-6,-5],[-8,0]]);stroke(ctx,[[0,-11],[6,-5],[8,0]]);decorate(ctx,item.id,t);}else if(item.category==='arenas'){if(item.id==='classic-arena'){ctx.fillStyle='#141c15';ctx.fillRect(0,0,120,130);}else arena(ctx,item.id,120,130);ctx.fillStyle='#788176';for(const [x,y] of [[4,105],[18,105],[32,91],[46,91],[60,105],[74,77],[88,91],[102,105]]){ctx.fillRect(x,y,14,14);ctx.strokeStyle='#424d44';ctx.lineWidth=.7;ctx.strokeRect(x,y,14,14);}ctx.fillStyle='#83b99c';for(const x of [25,53,81]){ctx.beginPath();ctx.arc(x,82,1.7,0,Math.PI*2);ctx.fill();stroke(ctx,[[x,84],[x,89]]);} }else death(ctx,item.id,60,40,.45);ctx.restore();}
  function arena(ctx,id,w,h){
    const item=C.find(id);if(!item||id==='classic-arena')return;
    ctx.save();ctx.scale(w/420,h/460);
    const rect=(x,y,width,height,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,width,height);};
    const path=(points,color,width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;stroke(ctx,points);};
    const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
    const gradient=ctx.createLinearGradient(0,0,0,460);gradient.addColorStop(0,'#090f12');gradient.addColorStop(1,item.color);ctx.fillStyle=gradient;ctx.fillRect(0,0,420,460);
    // Decorations sit behind the unchanged collision geometry and warnings.
    if(id==='forest-floor'||id==='rave-clearing'){
      for(let layer=0;layer<2;layer++)for(let i=0;i<7;i++){const x=i*74-35+layer*22,y=135+(i%3)*28+layer*70;rect(x+20,y,8,460-y,layer?'#26372c':'#182b23');ctx.fillStyle=layer?'#24362b':'#17271f';ctx.beginPath();ctx.moveTo(x+24,y-58);ctx.lineTo(x-6,y+60);ctx.lineTo(x+9,y+60);ctx.lineTo(x-16,y+125);ctx.lineTo(x+63,y+125);ctx.lineTo(x+38,y+60);ctx.lineTo(x+54,y+60);ctx.closePath();ctx.fill();}
      rect(0,425,420,35,'#19291f');path([[0,426],[420,426]],'#3e5940',2);
      if(id==='forest-floor'){for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#5b7645':'#405c39';ctx.beginPath();ctx.ellipse(23+i*41,437+(i%3)*5,4,1.5,i,0,Math.PI*2);ctx.fill();}for(const [x,y] of [[26,352],[387,307],[62,233]]){circle(x,y,1.3,'#93af65');}}
      else{
        for(const x of [23,361]){rect(x,295,35,113,'#10171c');path([[x,295],[x+35,295],[x+35,408],[x,408],[x,295]],'#455057');for(const y of [321,369]){circle(x+17.5,y,12,'#26323c');circle(x+17.5,y,7,'#10171c');circle(x+17.5,y,2,'#687c85');}}
        path([[32,118],[388,118]],'#42554c');for(let i=0;i<9;i++)circle(34+i*44,118,2,i%2?'#ae769e':'#64a8a5');
        ctx.globalAlpha=.09;ctx.fillStyle='#9b72b3';ctx.beginPath();ctx.moveTo(32,129);ctx.lineTo(133,392);ctx.lineTo(54,392);ctx.fill();ctx.fillStyle='#6db7ba';ctx.beginPath();ctx.moveTo(388,129);ctx.lineTo(287,392);ctx.lineTo(366,392);ctx.fill();ctx.globalAlpha=1;
      }
    }
    if(id==='construction-zone'){
      for(const x of [26,342]){path([[x,96],[x,420],[x+45,420],[x+45,96]],'#4d5147',3);for(let y=120;y<410;y+=54){path([[x,y],[x+45,y],[x,y+54]],'#353f36',2);}}
      path([[52,96],[364,96]],'#69705b',4);path([[320,97],[320,179],[328,188],[320,194]],'#777867',2);
      for(const x of [17,353]){rect(x,382,49,22,'#3b4035');for(let i=0;i<4;i++)path([[x+i*12,404],[x+i*12+12,382]],'#af984e',4);rect(x+5,405,4,20,'#6d705a');rect(x+40,405,4,20,'#6d705a');}
      rect(0,429,420,31,'#292c25');for(let x=20;x<420;x+=64)path([[x,443],[x+22,443]],'#494b3c');
    }
    if(id==='technofather-lab'){
      ctx.globalAlpha=.2;for(let x=18;x<420;x+=32)path([[x,95],[x,425]],'#547079');for(let y=105;y<420;y+=32)path([[15,y],[405,y]],'#547079');ctx.globalAlpha=1;
      for(const x of [20,337]){rect(x,185,63,58,'#101d23');path([[x,185],[x+63,185],[x+63,243],[x,243],[x,185]],'#456473',2);path([[x+7,220],[x+15,220],[x+21,205],[x+29,229],[x+37,215],[x+55,215]],'#6da49c');rect(x+25,245,12,10,'#34484e');}
      for(const x of [19,365]){rect(x,294,35,124,'#182830');for(let y=310;y<410;y+=22){path([[x+5,y],[x+24,y]],'#4b6370');circle(x+28,y,1.5,'#76ada1');}}
      path([[45,90],[45,130],[106,130],[106,158]],'#45575f',3);path([[370,255],[393,255],[393,424]],'#42636c',3);rect(0,430,420,30,'#142229');
    }
    if(id==='golden-temple'){
      path([[48,144],[210,75],[372,144]],'#7b683d',3);path([[73,145],[210,89],[347,145]],'#423e2c');
      for(const x of [33,354]){rect(x,164,33,254,'#34372c');rect(x-5,151,43,12,'#686040');rect(x-5,419,43,10,'#686040');path([[x+8,169],[x+8,410]],'#8d7a47');path([[x+23,169],[x+23,410]],'#494a34');}
      ctx.strokeStyle='#5e5837';ctx.lineWidth=1;ctx.beginPath();ctx.arc(210,184,43,0,Math.PI*2);ctx.stroke();path([[210,157],[224,184],[210,211],[196,184],[210,157]],'#8d7844');
      rect(0,432,420,28,'#2a2b22');path([[0,437],[420,437]],'#7e6c40',2);for(const x of [27,387]){rect(x,325,6,33,'#60573a');circle(x+3,319,4,'#c1a365');}
    }
    if(id==='bidouille-workshop'){
      rect(21,126,378,133,'#182b30');path([[21,126],[399,126],[399,259],[21,259],[21,126]],'#3c5961');
      for(let x=32;x<399;x+=18)for(let y=138;y<254;y+=18)circle(x,y,.8,'#36515a');
      for(const x of [47,364]){path([[x,149],[x,176]],'#82a4ab',3);path([[x-5,145],[x-5,150],[x,155],[x+5,150],[x+5,145]],'#82a4ab',2);}
      rect(16,344,388,12,'#657068');rect(23,357,12,68,'#3e514d');rect(385,357,12,68,'#3e514d');
      rect(29,301,58,41,'#28434c');path([[33,306],[83,306],[83,334],[33,334],[33,306]],'#6897a6');path([[49,319],[59,314],[67,322]],'#aac7ca');
      rect(343,316,42,27,'#3f5757');path([[348,324],[380,324]],'#8ba7a0',2);
      circle(369,305,6,'#92c9d4');ctx.fillStyle='#92c9d4';ctx.beginPath();ctx.ellipse(362,314,11,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#cba756';ctx.beginPath();ctx.ellipse(377,306,4,1.7,0,0,Math.PI*2);ctx.fill();circle(371,303,1,'#24363b');
      rect(0,431,420,29,'#203437');path([[20,102],[400,102]],'#3b5559');rect(165,101,90,4,'#91a59c');
    }
    ctx.restore();
  }

  function death(ctx,id,x,y,age){if(age>1||age<0)return;ctx.save();ctx.translate(x,y);ctx.globalAlpha=1-age;ctx.strokeStyle=id==='golden-burst'?'#d7b85b':'#92d8de';ctx.fillStyle=id==='pouf'?'#c5d0bf':ctx.strokeStyle;ctx.lineWidth=1.5;
    if(id==='rave-collapse'||id==='electric-zap'){if(id==='rave-collapse'){for(const radius of [8,15,22]){ctx.beginPath();ctx.arc(0,0,radius*age,0,Math.PI*2);ctx.stroke();}}else stroke(ctx,[[-12,-18],[-3,-6],[-8,0],[9,15],[3,2],[12,-2]]);}
    else if(id==='duck-escape'){ctx.translate(age*30,-age*22);ctx.fillStyle='#9bdded';ctx.beginPath();ctx.ellipse(0,0,6,4,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(4,-4,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e5b95f';ctx.fillRect(6,-4,4,2);}
    else for(let i=0;i<12;i++){const a=i*Math.PI/6,spread=age*25,px=Math.cos(a)*spread,py=Math.sin(a)*spread-age*8;if(id==='confetti')ctx.fillStyle=['#b882d2','#8bca97','#e0c06b'][i%3];if(id==='pixel-break'||id==='confetti')ctx.fillRect(px,py,3,3);else{ctx.beginPath();ctx.arc(px,py,id==='pouf'?3:1.5,0,Math.PI*2);ctx.fill();}}
    ctx.restore();
  }
  globalThis.LastStickCosmeticsRender={decorate,preview,arena,death};
})();
