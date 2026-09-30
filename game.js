(() => {
  const root=document.getElementById('stick-tetris'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
  const status=root.querySelector('#st-status'),button=root.querySelector('#st-pause'),legend=root.querySelector('#st-legend'),result=root.querySelector('#st-result');
  const W=420,H=460,S=40,LEFT=10,COLS=10,BASE=420,RADIUS=6,BODY=27,VISUAL_SCALE=1.08;
  const RESULT_SHOW=7.5,PLAY_LIMIT=40,FINAL_DUEL_AT=43,LOBBY_END=3,RACE_START=9;
  const ARENA_W=COLS*S,ZONE_W=ARENA_W*.25;
  let stones=[],pieces=[],men=[],specks=[],stains=[],bursts=[],dust=[],deathLog=[],time=0,next=3,camera=0,over=0,round=0,second=-1,palette,seed=1,turn=0,portals=[],teleports=0,impact=0,winnerId=-1,tieBreak=null,paceStart=28,paceSpan=70,networked=false,waitingForNetwork=false,networkRaceAt=0;
  let paused=window.openai?.widgetState?.privateContent?.paused??matchMedia('(prefers-reduced-motion: reduce)').matches;
  function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
  function shuffled(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function colors(){const c=getComputedStyle(root),v=n=>c.getPropertyValue(n).trim();palette={bg:v('--background'),fg:v('--foreground'),stone:v('--muted-foreground'),edge:v('--border'),blood:v('--red'),series:Array.from({length:6},(_,i)=>v('--viz-series-'+(i+1)))};}
  function clearBody(x,y){return x>=LEFT+RADIUS&&x<=W-LEFT-RADIUS&&!stones.some(c=>x+RADIUS>c.x+.2&&x-RADIUS<c.x+S-.2&&y>c.y+.3&&y-BODY<c.y+S-.3);}
  function wrapX(x){const lo=LEFT+RADIUS,hi=W-LEFT-RADIUS,span=hi-lo;return x<lo?hi-((lo-x)%span):x>hi?lo+((x-hi)%span):x;}
  function exitClear(r,x,y){return clearBody(x,y)&&peerClear(r,x,y)&&!pieces.some(p=>p.cells.some(([dx,dy])=>{const cx=LEFT+(p.col+dx)*S,cy=p.y+dy*S;return x+RADIUS>cx&&x-RADIUS<cx+S&&y>cy&&y-BODY<cy+S;}));}
  function peerClear(r,x,y){return !men.some(o=>o!==r&&o.alive&&Math.abs(o.x-x)<17&&Math.abs(o.y-y)<BODY-3);}
  function peerAhead(r,d,range=30){return men.find(o=>o!==r&&o.alive&&!o.climb&&Math.abs(o.y-r.y)<BODY-4&&(o.x-r.x)*d>0&&(o.x-r.x)*d<range);}
  function groundAt(x,y){let ground=BASE;for(const c of stones)if(x+RADIUS>c.x+.2&&x-RADIUS<c.x+S-.2&&c.y>=y-.6)ground=Math.min(ground,c.y);return ground;}
  function reset(config={}){
    const forced=Number(config.seed),bytes=new Uint32Array(1);if(Number.isInteger(forced)&&forced>0&&forced<=4294967295)bytes[0]=forced;else if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(bytes);else bytes[0]=Math.floor(Math.random()*4294967296);seed=bytes[0]||1;networkRaceAt=Number(config.raceAt)||0;root.dataset.roundSeed=String(seed>>>0);root.dataset.roundId=String(config.roundId||'');root.dataset.raceAt=String(networkRaceAt||'');turn=(seed>>>8)%6;
    stones=[];pieces=[];portals=[];teleports=0;specks=[];stains=[];bursts=[];dust=[];deathLog=[];time=0;next=3;camera=0;over=0;second=-1;impact=0;winnerId=-1;tieBreak=null;round++;
    // Every arena gets its own rhythm. There is no hidden target duration:
    // some rounds become hostile early, while others build more slowly.
    paceStart=14+random()*12;paceSpan=30+random()*20;
    let heights;
    do{heights=Array.from({length:COLS},()=>Math.floor(random()*3));}while(heights.every(h=>h===heights[0])||heights.some((h,i)=>Math.abs(h-heights[(i+1)%COLS])>1));
    for(let col=0;col<COLS;col++)for(let h=0;h<heights[col];h++)stones.push({x:LEFT+col*S,y:BASE-(h+1)*S});
    const starts=shuffled(Array.from({length:COLS},(_,i)=>i)).slice(0,6).sort((a,b)=>a-b);
    const ids=shuffled([0,1,2,3,4,5]);men=ids.map((id,i)=>({id,x:LEFT+(starts[i]+.5)*S,y:BASE-heights[starts[i]]*S,vy:0,dir:-1,alive:true,ground:true,phase:i,climb:null,land:0,choice:0,vx:0,blocked:0,moving:0,pushCooldown:0,pushPose:0,recoil:0,shove:0,idle:0}));
    root.dataset.roundStarts=JSON.stringify(Object.fromEntries(men.map(r=>[String.fromCharCode(65+r.id),Math.round((r.x-LEFT)/S-.5)])));root.dataset.roundDeaths='[]';
    if(Number.isFinite(Number(config.raceAt)))time=Math.max(0,Math.min(RACE_START-.05,RACE_START-(Number(config.raceAt)-Date.now())/1000));
    legend.innerHTML=Array.from({length:6},(_,i)=>'<span data-man="'+i+'"><span style="color:var(--viz-series-'+(i+1)+')">●</span> '+String.fromCharCode(65+i)+'</span>').join('');result.textContent='';
  }
  function terrainPlayable(profile){
    const slopes=profile.every((value,i)=>i===0||Math.abs(value-profile[i-1])<=S*2+.1);
    const noPocket=profile.every((value,i)=>!(value-profile[(i+COLS-1)%COLS]>S+.1&&value-profile[(i+1)%COLS]>S+.1));
    return slopes&&noPocket;
  }
  function spawnWave(count=1,intensity=0){
    const tops=Array.from({length:COLS},(_,i)=>{let y=BASE;for(const c of stones)if(c.x===LEFT+i*S)y=Math.min(y,c.y);return y;});
    const planned=tops.slice(),reserved=new Set();let zoneStart=0,zoneColumns=[];
    for(let attempt=0;attempt<16&&!zoneColumns.length;attempt++){
      zoneStart=random()*ARENA_W;
      zoneColumns=Array.from({length:COLS},(_,col)=>col).filter(col=>{
        const center=(col+.5)*S,offset=(center-zoneStart+ARENA_W)%ARENA_W;
        if(offset>=ZONE_W)return false;
        const profile=planned.slice();profile[col]-=S;
        return terrainPlayable(profile);
      });
    }
    if(!zoneColumns.length)return;
    const wave=round+'-'+Math.floor(time*60)+'-'+Math.floor(random()*10000);
    for(let index=0;index<count;index++){
      const options=zoneColumns.filter(col=>!reserved.has(col)).map(col=>{
        const profile=planned.slice();profile[col]-=S;
        if(!terrainPlayable(profile))return null;
        const roughness=profile.slice(1).reduce((sum,value,i)=>sum+Math.abs(value-profile[i])/S,0);
        const heightRange=(Math.max(...profile)-Math.min(...profile))/S;
        return {col,target:profile[col],score:random()*34-roughness*5-heightRange*4};
      }).filter(Boolean).sort((a,b)=>a.score-b.score);
      if(!options.length)break;
      const {col,target}=options[0];planned[col]=target;reserved.add(col);
      const warning=(.65+random()*.35)*(1-intensity*.48);
      const gap=(.28+random()*.22)*(1-intensity*.55);
      const wait=warning+index*gap;
      pieces.push({cells:[[0,0]],col,y:Math.min(-camera-S-15,target-190-random()*55),target,vy:55+random()*45+intensity*55,wait,zoneStart,zoneWidth:ZONE_W,wave});
    }
  }
  function threat(x,y){let risk=0;for(const p of pieces)for(const [dx,dy] of p.cells){const cx=LEFT+(p.col+dx)*S,cy=p.target+dy*S;if(x+RADIUS>cx&&x-RADIUS<cx+S&&y>cy&&y-BODY<cy+S)risk+=1;}return risk;}
  function routeScore(r,d){
    let score=d===r.dir?10:0,previous=r.y;
    // The pathfinder reads only pieces already visible on screen; generated
    // future pieces never enter this score.
    for(let step=1;step<=7;step++){
      const raw=r.x+d*step*12,x=wrapX(raw);if(raw!==x&&!exitClear(r,x,previous)&&!(step===1&&climbTarget(r,d))){score-=80;break;}
      const y=groundAt(x,-100000);const rise=previous-y;if(rise>S+.5){score-=80;break;}
      score-=Math.max(0,rise)*.13;
      // Runners only react to the nearby warning zone. They no longer inspect
      // the complete landing profile and plan an exterior/interior route.
      if(step<=2)score-=threat(x,y)*Math.max(14,46-step*8);
      for(const o of men)if(o!==r&&o.alive&&Math.abs(o.x-x)<22&&Math.abs(o.y-y)<BODY)score-=Math.max(4,25-step*3);
      previous=y;
    }
    return score;
  }
  function directionOpen(r,d){
    const raw=r.x+d*18,x=wrapX(raw);if(raw!==x&&!exitClear(r,x,r.y))return !!climbTarget(r,d);
    const gy=groundAt(x,r.y),rise=r.y-gy;if(rise>S+.5)return false;
    if(rise>4)return !!climbTarget(r,d);
    return clearBody(r,x,gy)||!!climbTarget(r,d);
  }
  function tryPush(r){
    if(!r.ground||r.pushCooldown>0||r.recoil>0||!threat(r.x,r.y))return false;
    const other=men.find(o=>o!==r&&o.alive&&!o.climb&&o.ground&&(o.x-r.x)*r.dir>0&&Math.abs(o.x-r.x)<19&&Math.abs(o.y-r.y)<8);
    if(!other)return false;
    const tx=other.x+r.dir*3;
    if(!clearBody(tx,other.y)||!peerClear(other,tx,other.y))return false;
    r.pushCooldown=3;r.pushPose=.24;r.vx=0;other.shove=r.dir*160;other.recoil=.32;other.choice=.32;
    return true;
  }
  function kill(r,cause='impact'){
    if(!r.alive)return;
    r.alive=false;root.querySelector('[data-man="'+r.id+'"]').style.opacity='.3';
    deathLog.push({runner:String.fromCharCode(65+r.id),cause,at:Math.max(0,Math.round((time-RACE_START)*10)/10)});root.dataset.roundDeaths=JSON.stringify(deathLog);
    bursts.push({x:r.x,y:r.y-12,life:.2});
    for(let i=0;i<28;i++){const life=.8+Math.random()*.7;specks.push({x:r.x,y:r.y-9-Math.random()*12,vx:(Math.random()-.5)*240,vy:-30-Math.random()*180,life,max:life,size:1.2+Math.random()*2.5});}
  }
  function blood(dt){
    for(const p of specks){p.life-=dt;p.x+=p.vx*dt;p.vy+=390*dt;p.y+=p.vy*dt;
      const hit=stones.some(c=>p.x>=c.x&&p.x<=c.x+S&&p.y>=c.y&&p.y<=c.y+S);
      if(hit||p.y>=BASE){stains.push({x:p.x,y:Math.min(BASE,p.y),size:p.size,drip:hit?3+Math.random()*6:0});p.life=0;}
    }
    specks=specks.filter(p=>p.life>0);stains=stains.slice(-250);for(const b of bursts)b.life-=dt;bursts=bursts.filter(b=>b.life>0);
    for(const p of dust){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-4*dt);p.vy-=7*dt;}dust=dust.filter(p=>p.life>0);
  }
  function finish(ids,tie){const id=ids[Math.floor(random()*ids.length)];winnerId=id;status.textContent=String.fromCharCode(65+id)+' gagne · '+Math.max(0,Math.floor(time-RACE_START))+' s'+(tie?' · combat final':'');result.textContent=status.textContent;over=RESULT_SHOW;}
  function serverResult(data){
    if(data.roundId!==root.dataset.roundId||!/^[A-F]$/.test(data.winner))return;const received=Number(data.durationMs),seconds=Number.isFinite(received)&&received>0?Math.round(received/1000):Math.max(0,Math.floor(time-RACE_START));
    winnerId=data.winner.charCodeAt(0)-65;tieBreak=null;waitingForNetwork=false;status.textContent=data.winner+' gagne · '+seconds+' s · résultat serveur';result.textContent=status.textContent;over=RESULT_SHOW;
  }
  function beginTieBreak(ids,duration=4.2,subtitle='LES DEUX DERNIERS RÈGLENT ÇA'){const finalists=[...new Set(ids)];if(finalists.length!==2)return false;const winner=finalists[Math.floor(random()*finalists.length)],loser=finalists.find(id=>id!==winner);if(men.find(r=>r.id===loser)?.alive){deathLog.push({runner:String.fromCharCode(65+loser),cause:'combat',at:Math.max(0,Math.round((time-RACE_START)*10)/10)});root.dataset.roundDeaths=JSON.stringify(deathLog);}tieBreak={ids:finalists,winner,left:duration,total:duration,subtitle};status.textContent='Combat final · '+finalists.map(id=>String.fromCharCode(65+id)).join(' vs ');result.textContent=status.textContent;return true;}
  function climbTarget(r,d){
    const raw=r.x+d*20,x=wrapX(raw),warped=x!==raw;const surfaces=stones.filter(c=>x+RADIUS>c.x&&x-RADIUS<c.x+S&&r.y-c.y>2&&r.y-c.y<=S+.5).sort((a,b)=>a.y-b.y);
    for(const c of surfaces){const tx=d>0?c.x+RADIUS+3:c.x+S-RADIUS-3,sx=warped?(d>0?LEFT-RADIUS:W-LEFT+RADIUS):r.x;if(Math.abs(tx-sx)>35||!clearBody(tx,c.y)||!peerClear(r,tx,c.y))continue;
      if(men.some(o=>o!==r&&o.alive&&o.climb&&Math.abs(o.climb.tx-tx)<20&&Math.abs(o.climb.ty-c.y)<8))continue;
      let clear=warped;for(let k=1;!warped&&k<=6;k++)if(!clearBody(sx,r.y+(c.y-r.y)*k/6))clear=false;
      if(clear)return {sx,sy:r.y,tx,ty:c.y,t:0,warped};
    }return null;
  }
  function update(dt){
    impact=Math.max(0,impact-dt);for(const p of portals)p.life-=dt;portals=portals.filter(p=>p.life>0);blood(dt);if(waitingForNetwork)return;if(over){over-=dt;if(over<=0){if(networked){waitingForNetwork=true;status.textContent='Synchronisation de la prochaine manche…';}else reset();}return;}if(tieBreak){time+=dt;tieBreak.left-=dt;if(tieBreak.left<=0){const winner=tieBreak.winner;tieBreak=null;finish([winner],true);}return;}time+=dt;
    if(time<LOBBY_END){const joined=Number(root.dataset?.lobbyCount||0),marker=-100-joined;if(second!==marker){second=marker;status.textContent='Salle d’attente · '+joined+'/5 adversaires';}return;}
    if(time<RACE_START){const count=Math.max(1,Math.ceil(RACE_START-time));if(second!==-count){second=-count;status.textContent='Choisis tes stickmen · départ dans '+count;}return;}
    const elapsed=time-RACE_START,aliveNow=men.filter(r=>r.alive),aliveCount=aliveNow.length;
    if(elapsed>=FINAL_DUEL_AT&&aliveCount===2){beginTieBreak(aliveNow.map(r=>r.id),4.2,'DUEL DES DEUX FINALISTES');return;}
    if(Math.floor(time)!==second){second=Math.floor(time);status.textContent=(elapsed>=30?'TEMPÊTE · ':'Dernier debout · ')+Math.floor(elapsed)+' s · '+aliveCount+' en vie'+(aliveCount<=3?' · double chute':'');}
    const pace=Math.min(1,Math.max(0,(time-paceStart)/paceSpan)),storm=Math.min(1,Math.max(0,(elapsed-22)/18));
    const pressure=Math.min(1,pace*.35+storm*.75+(6-aliveCount)*.035);next-=dt;
    if(next<=0&&pieces.length===0){let count=2;if(elapsed>24||random()<storm*.7)count++;spawnWave(count,storm);next=Math.max(.42,2.55-pressure*2.05+random()*.48);}
    const frameDeaths=[];
    for(const p of [...pieces]){
      if(p.wait>0){p.wait-=dt;continue;}const old=p.y;p.vy+=(185+pressure*420)*dt;p.y=Math.min(p.target,p.y+p.vy*dt);
      const hit=[];for(const r of men){if(!r.alive)continue;for(const [dx,dy] of p.cells){const x=LEFT+(p.col+dx)*S,top=old+dy*S,bottom=p.y+(dy+1)*S;
        if(r.x+RADIUS>x+1&&r.x-RADIUS<x+S-1&&r.y>top+1&&r.y-BODY<bottom-.1){hit.push(r.id);kill(r,'impact');break;}}
      }
      frameDeaths.push(...hit);
      if(p.y>=p.target){impact=.12;for(const [dx,dy] of p.cells)stones.push({x:LEFT+(p.col+dx)*S,y:p.target+dy*S});for(const dx of new Set(p.cells.map(cell=>cell[0])))for(let i=0;i<7;i++){const life=.32+Math.random()*.28;dust.push({x:LEFT+(p.col+dx+.5)*S+(Math.random()-.5)*24,y:p.target+S*(1+Math.max(...p.cells.filter(cell=>cell[0]===dx).map(cell=>cell[1]))),vx:(Math.random()-.5)*85,vy:-12-Math.random()*32,life,max:life,size:1+Math.random()*2.5});}pieces.splice(pieces.indexOf(p),1);const crushed=[];for(const r of men)if(r.alive&&!clearBody(r.x,r.y)){crushed.push(r.id);kill(r,'écrasement');}frameDeaths.push(...crushed);}
    }
    const remaining=men.filter(r=>r.alive);if(frameDeaths.length&&remaining.length<=1){if(remaining.length)finish([remaining[0].id],false);else{const finalists=[...new Set(frameDeaths)];if(finalists.length===2)beginTieBreak(finalists);else finish(finalists,false);}return;}
    const movers=men.slice(turn).concat(men.slice(0,turn));turn=(turn+1)%men.length;
    for(const r of movers){
      if(!r.alive)continue;const startX=r.x;r.land=Math.max(0,r.land-dt);r.choice-=dt;r.pushCooldown=Math.max(0,r.pushCooldown-dt);r.pushPose=Math.max(0,r.pushPose-dt);r.recoil=Math.max(0,r.recoil-dt);
      if(r.climb){const c=r.climb;const nextT=c.t+dt,u=Math.min(1,nextT/.68),lift=Math.min(1,u/.68),e=lift*lift*(3-2*lift),x=c.sx+(c.tx-c.sx)*Math.max(0,(u-.68)/.32),y=c.sy+(c.ty-c.sy)*e;
        if(clearBody(x,y)&&peerClear(r,x,y)){c.t=nextT;r.x=x;r.y=y;r.blocked=0;}else{r.blocked+=dt;if(r.blocked>.5){r.climb=null;r.vy=0;r.ground=false;r.choice=0;}}
        if(u===1&&r.climb){r.climb=null;r.ground=true;r.land=.12;r.vy=0;r.vx=r.dir*25;}continue;
      }
      if(Math.abs(r.shove)>1){
        const targetX=wrapX(r.x+r.shove*dt),warped=Math.abs(targetX-r.x)>W/2;
        if(warped?exitClear(r,targetX,r.y):clearBody(targetX,r.y)&&peerClear(r,targetX,r.y)){r.x=targetX;if(warped){teleports++;portals.push({x:targetX<W/2?LEFT:W-LEFT,y:r.y-13,life:.35,color:r.id});}}else r.shove=0;
        r.shove*=Math.exp(-6*dt);
      }
      const danger=threat(r.x,r.y);
      if(r.ground&&r.recoil<=0){
        const incoming=men.find(o=>o!==r&&o.alive&&o.climb&&Math.abs(o.climb.tx-r.x)<25&&Math.abs(o.climb.ty-r.y)<9);
        if(incoming){
          const away=Math.sign(r.x-incoming.climb.tx)||((r.id+round)&1?1:-1);
          r.dir=away;r.choice=.3+random()*.2;r.vx=away*28;
        }
        if(r.choice<=0){
          r.choice=.4+random()*.2;const l=routeScore(r,-1),rr=routeScore(r,1);
          if(Math.abs(l-rr)>4)r.dir=l>rr?-1:1;else if(danger)r.dir=random()<.5?-1:1;
        }
        if(!danger&&r.idle>.72){
          // A runner that is jammed outside an alert must leave its spot. The
          // choice only inspects the immediate step and never the next piece.
          const left=directionOpen(r,-1),right=directionOpen(r,1);
          if(left&&right)r.dir=-r.dir;
          else if(left)r.dir=-1;else if(right)r.dir=1;else r.dir=-r.dir;
          r.idle=0;
        }
        // Outside an alert, two runners approaching the same point give way
        // before touching. This keeps the arena circulating instead of making
        // a motionless pile that looks deliberately scheduled.
        if(!danger&&peerAhead(r,r.dir)){
          r.dir*=-1;r.choice=.25+random()*.25;r.vx=0;r.blocked=0;
        }
      }

      const speed=(danger?83:42)*(r.land>0?.5:1)*(r.recoil>0||r.pushPose>0?0:1),desired=r.dir*speed;
      const accel=r.ground?360:160;r.vx+=Math.max(-accel*dt,Math.min(accel*dt,desired-r.vx));
      const rawX=r.x+r.vx*dt,nx=wrapX(rawX),crossed=nx!==rawX;let didWarp=false;
      if(crossed?exitClear(r,nx,r.y):clearBody(nx,r.y)&&peerClear(r,nx,r.y)){if(crossed){portals.push({x:r.x< W/2?LEFT:W-LEFT,y:r.y-13,life:.35,color:r.id},{x:nx<W/2?LEFT:W-LEFT,y:r.y-13,life:.35,color:r.id});teleports++;didWarp=true;r.choice=0;}r.x=nx;r.blocked=0;}
      else if(r.ground){if(r.blocked>.12&&tryPush(r)){r.blocked=0;}const c=climbTarget(r,r.dir);if(c){if(c.warped){portals.push({x:r.x<W/2?LEFT:W-LEFT,y:r.y-13,life:.35,color:r.id},{x:c.sx<W/2?LEFT:W-LEFT,y:r.y-13,life:.35,color:r.id});teleports++;r.x=c.sx;}r.climb=c;r.ground=false;r.vx=0;r.vy=0;continue;}r.vx=0;r.blocked+=dt;if(r.blocked>.18){r.dir*=-1;r.choice=.35+random()*.25;r.blocked=0;}}
      else r.vx=0;
      const oldY=r.y;r.vy+=500*dt;let ny=r.y+r.vy*dt;const floor=groundAt(r.x,oldY);
      if(ny>=floor){ny=floor;if(!r.ground&&r.vy>80)r.land=.17;r.vy=0;r.ground=true;}else r.ground=false;
      if(clearBody(r.x,ny)&&peerClear(r,r.x,ny))r.y=ny;else{r.vy=0;r.vx=0;r.choice=0;}
      r.moving=Math.min(1,(didWarp?Math.abs(r.vx)*dt:Math.abs(r.x-startX))/(dt*35));r.phase+=(didWarp?Math.abs(r.vx)*dt:Math.abs(r.x-startX))*.25;
      if(r.ground&&!r.climb&&!danger&&Math.abs(r.x-startX)<.08)r.idle+=dt;else r.idle=Math.max(0,r.idle-dt*2.5);
    }

    // Keep every living runner on screen, including one hiding under an overhang.
    const live=men.filter(r=>r.alive),low=Math.max(...live.map(r=>r.y)),high=Math.min(...live.map(r=>r.y));const target=Math.max(0,Math.min(180-high,H-35-low));camera+=(target-camera)*Math.min(1,dt*2);
  }
  function line(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();}
  function stone(x,y,alpha){ctx.globalAlpha=alpha;ctx.fillStyle=palette.stone;ctx.fillRect(x+.5,y+.5,S-1,S-1);ctx.strokeStyle=palette.edge;ctx.lineWidth=1;ctx.strokeRect(x+1,y+1,S-2,S-2);ctx.globalAlpha=alpha*.24;ctx.fillStyle=palette.fg;ctx.fillRect(x+3,y+3,S-6,2);ctx.fillRect(x+3,y+5,2,S-9);ctx.globalAlpha=alpha*.22;ctx.strokeStyle=palette.bg;ctx.lineWidth=1;ctx.beginPath();const flip=((x+y)/S)&1;ctx.moveTo(x+(flip?11:29),y+8);ctx.lineTo(x+(flip?17:23),y+16);ctx.lineTo(x+(flip?13:27),y+25);ctx.stroke();ctx.globalAlpha=1;}
  function victory(){
    if(winnerId<0||over<=0)return;const t=RESULT_SHOW-over,cx=W/2,ballY=63,danceY=330,color=palette.series[winnerId];
    ctx.fillStyle='rgba(4,6,4,.78)';ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(cx,ballY);ctx.rotate(t*.35);ctx.strokeStyle='rgba(240,243,234,.18)';ctx.lineWidth=1;for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(260,0);ctx.stroke();}ctx.restore();
    ctx.strokeStyle='#879083';ctx.lineWidth=1;line([[cx,0],[cx,ballY-19]]);ctx.fillStyle='#cfd7c9';ctx.beginPath();ctx.arc(cx,ballY,19,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#70786d';ctx.lineWidth=.8;for(let y=-12;y<=12;y+=6)line([[cx-16,ballY+y],[cx+16,ballY+y]]);for(let x=-12;x<=12;x+=6)line([[cx+x,ballY-16],[cx+x,ballY+16]]);
    const bounce=Math.abs(Math.sin(t*7))*6,swing=Math.sin(t*9)*11;ctx.save();ctx.translate(cx,danceY-bounce);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.arc(0,-48,6,0,Math.PI*2);ctx.fill();line([[0,-41],[0,-19]]);line([[0,-35],[-18-swing*.35,-26-swing*.25],[-25-swing*.45,-38]]);line([[0,-34],[18+swing*.35,-28+swing*.22],[24+swing*.45,-42]]);line([[0,-19],[-11-swing*.25,-7],[-17-swing*.35,4]]);line([[0,-19],[11+swing*.25,-7],[17+swing*.35,4]]);ctx.restore();
    ctx.textAlign='center';ctx.fillStyle=color;ctx.font='800 24px Inter,system-ui,sans-serif';ctx.fillText(String.fromCharCode(65+winnerId)+' GAGNE',cx,386);ctx.fillStyle=palette.fg;ctx.font='600 10px Inter,system-ui,sans-serif';ctx.fillText('DERNIER STICKMAN DEBOUT',cx,405);ctx.fillStyle=palette.stone;ctx.font='700 9px Inter,system-ui,sans-serif';ctx.fillText('PROCHAINE MANCHE DANS '+Math.max(1,Math.ceil(over))+' S',cx,426);ctx.textAlign='start';
  }
  function suddenDeath(){
    if(!tieBreak)return;
    const {ids,winner,left,total,subtitle}=tieBreak,p=1-left/total,loser=ids.find(id=>id!==winner),winnerLeft=ids[0]===winner;
    const ease=value=>value*value*(3-2*value),approach=ease(Math.min(1,p/.27)),exchange=Math.max(0,Math.min(1,(p-.27)/.43)),fatal=Math.max(0,Math.min(1,(p-.70)/.18)),fall=Math.max(0,Math.min(1,(p-.84)/.16));
    const leftId=ids[0],rightId=ids[1],leftX=92+approach*83,rightX=W-92-approach*83,y=302;
    ctx.fillStyle='rgba(4,6,4,.88)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle=palette.blood;ctx.font='800 23px Inter,system-ui,sans-serif';ctx.fillText('COMBAT FINAL',W/2,72);ctx.fillStyle=palette.fg;ctx.font='600 10px Inter,system-ui,sans-serif';ctx.fillText(subtitle,W/2,94);
    ctx.strokeStyle=palette.edge;ctx.globalAlpha=.5;ctx.lineWidth=2;line([[58,y+8],[W-58,y+8]]);ctx.globalAlpha=1;
    function fighter(id,x,dir,isWinner){
      const fatalStrike=isWinner?fatal:0,hit=!isWinner?fall:0,jab=exchange?Math.sin(exchange*Math.PI*8)*9:0;
      ctx.save();ctx.translate(x+(isWinner?dir*fatalStrike*18:-dir*hit*18),y-hit*2);ctx.rotate(!isWinner?dir*hit*1.28:0);ctx.strokeStyle=palette.series[id];ctx.fillStyle=palette.series[id];ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();ctx.arc(0,-48,6,0,Math.PI*2);ctx.fill();line([[0,-41],[0,-19]]);
      const punch=fatalStrike?dir*(18+fatalStrike*24):dir*(13+jab);
      line([[0,-35],[punch,-31-fatalStrike*15],[punch+dir*8,-31-fatalStrike*17]]);line([[0,-34],[-dir*11,-27],[-dir*16,-35]]);
      line([[0,-19],[-9,-7],[-14,4]]);line([[0,-19],[10,-8],[15,3]]);ctx.restore();
      ctx.fillStyle=palette.series[id];ctx.font='800 18px Inter,system-ui,sans-serif';ctx.fillText(String.fromCharCode(65+id),x,y+42);
    }
    fighter(leftId,leftX,1,leftId===winner);fighter(rightId,rightX,-1,rightId===winner);
    if(fatal>.25){const victimX=winnerLeft?rightX:leftX,dir=winnerLeft?1:-1;ctx.fillStyle=palette.blood;for(let i=0;i<12;i++){const spread=(i-5.5)*.42;ctx.globalAlpha=Math.max(0,1-fall)*.85;ctx.beginPath();ctx.arc(victimX-dir*(16+fatal*36),y-45+spread*9,1.4+(i%3),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
    ctx.fillStyle=palette.fg;ctx.font='700 12px Inter,system-ui,sans-serif';ctx.fillText(p<.27?'FACE À FACE':p<.70?'COUPS ÉCHANGÉS':p<.88?'COUP FATAL':'K.O.',W/2,386);ctx.textAlign='start';
  }
  function draw(){
    colors();ctx.clearRect(0,0,W,H);ctx.fillStyle=palette.bg;ctx.fillRect(0,0,W,H);const glow=ctx.createRadialGradient(W/2,H*.45,20,W/2,H*.45,W*.7);glow.addColorStop(0,'rgba(83,112,67,.10)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);ctx.fillStyle=palette.edge;ctx.globalAlpha=.12;for(let x=-20,i=0;x<W+35;x+=48,i++){const h=75+(i%3)*21;ctx.beginPath();ctx.moveTo(x,H);ctx.lineTo(x+20,H-h);ctx.lineTo(x+40,H);ctx.fill();ctx.fillRect(x+18,H-h,4,h);}ctx.globalAlpha=1;ctx.save();const shake=impact>0?Math.sin(impact*150)*impact*22:0;ctx.translate(shake,camera);ctx.strokeStyle=palette.edge;ctx.lineWidth=1;line([[LEFT,BASE+1],[W-LEFT,BASE+1]]);
    ctx.strokeStyle=palette.edge;ctx.lineWidth=2;ctx.setLineDash([4,7]);line([[LEFT-5,-camera],[LEFT-5,BASE]]);line([[W-LEFT+5,-camera],[W-LEFT+5,BASE]]);ctx.setLineDash([]);
    for(const c of stones)if(c.y+camera>-S&&c.y+camera<H)stone(c.x,c.y,.68);
    const warningWaves=[...new Map(pieces.filter(p=>p.wait>0).map(p=>[p.wave,p])).values()];
    for(const p of warningWaves){const start=LEFT+p.zoneStart,width=p.zoneWidth,first=Math.min(width,ARENA_W-p.zoneStart),pulse=.5+.5*Math.sin(time*12);ctx.fillStyle=palette.blood;ctx.globalAlpha=.055+.045*pulse;ctx.fillRect(start,-camera,first,BASE+camera);if(first<width)ctx.fillRect(LEFT,-camera,width-first,BASE+camera);ctx.globalAlpha=.42+.22*pulse;ctx.fillRect(start,BASE-5,first,4);if(first<width)ctx.fillRect(LEFT,BASE-5,width-first,4);ctx.globalAlpha=1;}
    for(const p of pieces)if(p.wait>0){ctx.fillStyle=palette.blood;ctx.globalAlpha=.3+.22*(.5+.5*Math.sin(time*12));const x=LEFT+p.col*S,y=groundAt(x+S/2,-100000);ctx.fillRect(x+3,y-4,S-6,3);ctx.globalAlpha=1;}
    for(const p of pieces){if(p.wait<=0){ctx.fillStyle=palette.stone;ctx.globalAlpha=.08;for(const [dx,dy] of p.cells){const x=LEFT+(p.col+dx)*S;ctx.fillRect(x+8,p.y+dy*S-22,S-16,18);}}ctx.globalAlpha=1;for(const [dx,dy] of p.cells)stone(LEFT+(p.col+dx)*S,p.y+dy*S,.87);}
    ctx.fillStyle=palette.blood;ctx.globalAlpha=.72;for(const p of stains){ctx.beginPath();ctx.ellipse(p.x,p.y,p.size*1.6,p.size*.7,0,0,Math.PI*2);ctx.fill();if(p.drip)ctx.fillRect(p.x-.65,p.y,1.3,p.drip);}ctx.globalAlpha=1;
    const concealed=time<RACE_START;
    for(const r of men){if(!r.alive)continue;const picks=root.dataset?.selectedRunners||root.dataset?.selectedRunner||'',selected=!concealed&&picks.includes(String.fromCharCode(65+r.id));if(selected){ctx.fillStyle=palette.series[r.id];ctx.globalAlpha=.95;ctx.beginPath();ctx.arc(r.x,r.y-39,3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.22;ctx.beginPath();ctx.arc(r.x,r.y-39,7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}ctx.save();ctx.translate(r.x,r.y);ctx.scale(-r.dir*VISUAL_SCALE,VISUAL_SCALE);if(r.recoil>0)ctx.rotate(-Math.sign(r.shove||r.dir)*r.dir*.18);ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=concealed?palette.stone:palette.series[r.id];ctx.fillStyle=concealed?palette.stone:palette.series[r.id];
      const walk=Math.sin(r.phase)*6*r.moving;ctx.beginPath();ctx.arc(-2,-23,3.7,0,Math.PI*2);ctx.fill();line([[-2,-19],[0,-11]]);
      if(r.pushPose>0){line([[-2,-18],[-10,-17],[-17,-17]]);line([[-1,-17],[-9,-14],[-17,-15]]);line([[0,-11],[-7,-5],[-10,0]]);line([[0,-11],[7,-5],[10,0]]);}
      else if(r.climb){const reach=Math.min(1,r.climb.t/.3),grip=-25-reach*5;line([[-2,-18],[-8,-22],[-12,grip]]);line([[-1,-17],[5,-22],[10,grip+1]]);line([[0,-11],[-7,-8],[-10,-1]]);line([[0,-11],[7,-7],[9,0]]);}
      else if(!r.ground){line([[-2,-18],[-9,-22],[-12,-28]]);line([[-1,-18],[7,-22],[10,-27]]);line([[0,-11],[-6,-5],[-9,0]]);line([[0,-11],[5,-5],[8,0]]);}
      else{ctx.translate(0,r.land?2:0);line([[-2,-18],[-walk,-14],[-walk-3,-18]]);line([[-2,-18],[walk,-14],[walk+2,-18]]);line([[0,-11],[-walk,-5],[-walk-2,0]]);line([[0,-11],[walk,-5],[walk+2,0]]);}ctx.restore();
    }
    for(const p of portals){ctx.strokeStyle=palette.series[p.color];ctx.globalAlpha=p.life/.35;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,4+(1-p.life/.35)*9,17,0,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
    ctx.fillStyle=palette.stone;for(const p of dust){ctx.globalAlpha=p.life/p.max*.42;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1+(1-p.life/p.max)*1.6),0,Math.PI*2);ctx.fill();}ctx.fillStyle=palette.blood;for(const b of bursts){ctx.globalAlpha=b.life/.2;ctx.beginPath();ctx.ellipse(b.x,b.y,18*(1-b.life/.3),8,0,0,Math.PI*2);ctx.fill();}for(const p of specks){ctx.globalAlpha=Math.min(1,p.life/.3);ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;ctx.restore();suddenDeath();victory();
  }
  function pause(value){paused=value;button.textContent=paused?'Animer':'Pause';}
  button.onclick=()=>{pause(!paused);window.openai?.setWidgetState?.({privateContent:{paused},modelContent:{animation:'Parcours de stickmen, pièces de Tetris',paused}}).catch(()=>{});};
  window.addEventListener('openai:set_globals',e=>{const p=e.detail?.globals?.widgetState?.privateContent?.paused;if(typeof p==='boolean')pause(p);});
  window.addEventListener('laststick:round',event=>{networked=true;waitingForNetwork=false;root.dataset.networked='1';reset(event.detail||{});pause(false);});
  window.addEventListener('laststick:waiting',()=>{networked=true;waitingForNetwork=true;root.dataset.networked='1';status.textContent='Manche en cours · prochaine course en préparation';});
  window.addEventListener('laststick:server-result',event=>serverResult(event.detail||{}));
  const d=Math.min(devicePixelRatio||1,2);canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);reset();pause(paused);draw();
  let last=0,acc=0;function frame(t){const delta=Math.min(.08,(t-last)/1000);last=t;if(!paused){
    if(networked&&networkRaceAt&&!waitingForNetwork&&!over){const target=RACE_START+(Date.now()-networkRaceAt)/1000;let steps=0;while(time+1/60<=target&&!over&&steps<3600){update(1/60);steps++;}}
    else{acc+=delta;while(acc>=1/60){update(1/60);acc-=1/60;}}
  }draw();if(root.isConnected)requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
