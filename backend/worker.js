const ALLOWED_EVENTS=new Set(['session_started','heartbeat','session_left','bet_placed','race_started','race_finished']);
const CORS_HEADERS={
  'access-control-allow-origin':'https://lebucheron.github.io',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'authorization,content-type',
  'access-control-max-age':'86400'
};

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...CORS_HEADERS,...extra}});
}

function validId(value){return typeof value==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(value);}
function validRuleset(value){return typeof value==='string'&&/^[A-Za-z0-9._-]{1,24}$/.test(value);}
function cleanDeaths(value){
  if(!Array.isArray(value))return [];
  return value.slice(0,6).flatMap(item=>{
    const runner=String(item?.runner||''),cause=String(item?.cause||''),at=Number(item?.at);
    return /^[A-F]$/.test(runner)&&['impact','écrasement','combat'].includes(cause)&&Number.isFinite(at)&&at>=0&&at<=120?[{runner,cause,at:Math.round(at*10)/10}]:[];
  });
}
function cleanStarts(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const starts={};
  for(const runner of ['A','B','C','D','E','F'])if(Number.isInteger(value[runner])&&value[runner]>=0&&value[runner]<=9)starts[runner]=value[runner];
  return Object.keys(starts).length===6?starts:null;
}

async function receiveEvent(request,env){
  if(request.headers.get('origin')!=='https://lebucheron.github.io')return json({error:'origin_forbidden'},403);
  const length=Number(request.headers.get('content-length')||0);
  if(length>4096)return json({error:'payload_too_large'},413);
  let event;
  try{event=JSON.parse(await request.text());}catch{return json({error:'invalid_json'},400);}
  if(!ALLOWED_EVENTS.has(event.type)||!validId(event.session_id))return json({error:'invalid_event'},400);

  const now=new Date().toISOString();
  const isTest=event.test?1:0;
  await env.DB.prepare(`INSERT INTO sessions (id, first_seen, last_seen, page, referrer, is_test)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen, page=excluded.page, is_test=excluded.is_test`)
    .bind(event.session_id,now,now,String(event.page||'').slice(0,120),String(event.referrer||'').slice(0,120),isTest).run();

  if(event.type==='session_left'){
    await env.DB.prepare('UPDATE sessions SET last_seen=? WHERE id=?').bind(new Date(Date.now()-60000).toISOString(),event.session_id).run();
  }
  if(!['heartbeat','session_left'].includes(event.type)){
    const duration=Number.isFinite(Number(event.duration_ms))?Math.max(0,Math.min(180000,Number(event.duration_ms))):null;
    if(['race_started','race_finished'].includes(event.type)&&!validId(event.round_id))return json({error:'invalid_round'},400);
    if(event.type==='race_finished'){
      if(duration===null||duration<5000||duration>120000)return json({error:'invalid_duration'},400);
      const started=await env.DB.prepare("SELECT created_at FROM events WHERE session_id=? AND round_id=? AND type='race_started' ORDER BY id DESC LIMIT 1").bind(event.session_id,event.round_id).first();
      const finished=await env.DB.prepare("SELECT id FROM events WHERE session_id=? AND round_id=? AND type='race_finished' LIMIT 1").bind(event.session_id,event.round_id).first();
      if(!started||finished||Date.now()-Date.parse(started.created_at)<5000)return json({error:'invalid_sequence'},409);
    }
    const winnerStart=Number.isInteger(event.winner_start)&&event.winner_start>=0&&event.winner_start<=9?event.winner_start:null;
    const roundSeed=Number.isInteger(event.seed)&&event.seed>=1&&event.seed<=4294967295?event.seed:null;
    const deaths=event.type==='race_finished'?JSON.stringify(cleanDeaths(event.deaths)):null;
    const ruleset=validRuleset(event.ruleset)?event.ruleset:'legacy';
    const starts=event.type==='race_finished'&&cleanStarts(event.starts)?JSON.stringify(cleanStarts(event.starts)):null;
    await env.DB.prepare(`INSERT INTO events
      (session_id, type, round_id, seed, winner, choice, bet_placed, won, duration_ms, sudden_death, winner_start, deaths, ruleset, starts, is_test, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(event.session_id,event.type,String(event.round_id||'').slice(0,80)||null,roundSeed,/^[A-F]$/.test(event.winner)?event.winner:null,/^[A-F]$/.test(event.choice)?event.choice:null,event.bet_placed?1:0,event.won?1:0,duration,event.sudden_death?1:0,winnerStart,deaths,ruleset,starts,isTest,now).run();
  }
  return json({ok:true},202);
}

async function stats(request,env){
  const expected=env.ADMIN_TOKEN;
  if(!expected||request.headers.get('authorization')!==`Bearer ${expected}`)return json({error:'unauthorized'},401);
  const since=env.STATS_SINCE||'1970-01-01T00:00:00Z',url=new URL(request.url),requested=url.searchParams.get('ruleset')||'R5',selected=requested==='all'||validRuleset(requested)?requested:'R5';
  const filter=selected==='all'?'':' AND COALESCE(ruleset,\'legacy\')=?',scope=[since,...(selected==='all'?[]:[selected])];
  const withFinished=`WITH finished AS (SELECT e.* FROM events e JOIN (SELECT MIN(id) id FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=?${filter} GROUP BY round_id) one ON one.id=e.id)`;
  const query=(sql,extra=[])=>env.DB.prepare(`${withFinished} ${sql}`).bind(...scope,...extra);
  const [active,visitors,rounds,versions]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE COALESCE(is_test,0)=0 AND datetime(last_seen) >= datetime('now','-45 seconds')").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE COALESCE(is_test,0)=0 AND datetime(first_seen) >= date('now')").first(),
    query('SELECT COUNT(*) count FROM finished').first(),
    env.DB.prepare("SELECT COALESCE(ruleset,'legacy') ruleset, COUNT(DISTINCT round_id) count FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=? GROUP BY COALESCE(ruleset,'legacy') ORDER BY MAX(id) DESC").bind(since).all()
  ]);
  const roundCount=rounds?.count||0,medianOffset=Math.max(0,Math.floor((roundCount-1)*.5)),p90Offset=Math.max(0,Math.floor((roundCount-1)*.9));
  const [duration,median,p90,winners,starts,appearances,causes,combat,recent]=await Promise.all([
    query('SELECT AVG(duration_ms) average, MIN(duration_ms) minimum, MAX(duration_ms) maximum FROM finished').first(),
    query('SELECT duration_ms value FROM finished ORDER BY duration_ms LIMIT 1 OFFSET ?',[medianOffset]).first(),
    query('SELECT duration_ms value FROM finished ORDER BY duration_ms LIMIT 1 OFFSET ?',[p90Offset]).first(),
    query('SELECT winner, COUNT(*) count FROM finished GROUP BY winner').all(),
    query('SELECT winner_start, COUNT(*) count FROM finished WHERE winner_start IS NOT NULL GROUP BY winner_start').all(),
    query("SELECT CAST(value AS INTEGER) start, COUNT(*) count FROM finished, json_each(finished.starts) WHERE starts IS NOT NULL AND json_valid(starts) GROUP BY CAST(value AS INTEGER)").all(),
    query("SELECT json_extract(value,'$.cause') cause, COUNT(*) count FROM finished, json_each(finished.deaths) WHERE deaths IS NOT NULL AND json_valid(deaths) GROUP BY cause").all(),
    query('SELECT COUNT(*) count FROM finished WHERE sudden_death=1').first(),
    query('SELECT winner, won, duration_ms, sudden_death, winner_start, seed, ruleset, created_at FROM finished ORDER BY id DESC LIMIT 12').all()
  ]);
  const byWinner=Object.fromEntries((winners.results||[]).map(row=>[row.winner,row.count]));
  const byStart=Object.fromEntries((starts.results||[]).map(row=>[row.winner_start,row.count]));
  const byAppearance=Object.fromEntries((appearances.results||[]).map(row=>[row.start,row.count]));
  const byCause=Object.fromEntries((causes.results||[]).map(row=>[row.cause,row.count]));
  return json({active_now:active?.count||0,visitors_today:visitors?.count||0,rounds_today:roundCount,selected_ruleset:selected,available_rulesets:versions.results||[],average_duration_ms:duration?.average||null,median_duration_ms:median?.value||null,p90_duration_ms:p90?.value||null,min_duration_ms:duration?.minimum||null,max_duration_ms:duration?.maximum||null,combat_final_count:combat?.count||0,combat_final_rate:roundCount?(combat?.count||0)/roundCount:0,winners:byWinner,winning_starts:byStart,start_appearances:byAppearance,death_causes:byCause,recent_rounds:recent.results||[]},200,{'cache-control':'no-store'});
}

function nextSeed(){const data=new Uint32Array(1);crypto.getRandomValues(data);return data[0]||1;}
function botPicks(seed){
  let value=seed>>>0;const picks=[];
  for(let i=0;i<5;i++){value^=value<<13;value^=value>>>17;value^=value<<5;picks.push(String.fromCharCode(65+(value>>>0)%6));}
  if(new Set(picks).size===1)picks[4]=String.fromCharCode(65+((picks[4].charCodeAt(0)-64)%6));
  return picks;
}
function pairingCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return Array.from(bytes,value=>alphabet[value%alphabet.length]).join('');}
const DEMO_REFILL_BALANCE=2500,DEMO_REFILL_COOLDOWN=86400000;
export function demoRefillDecision(wallet,activeBetCount=0,now=Date.now()){
  if(activeBetCount>0)return {ok:false,message:'Attends le règlement de la manche en cours'};
  if((Number(wallet?.balance)||0)>=500)return {ok:false,message:'Le secours apparaît seulement sous 500 CR'};
  const availableAt=(Number(wallet?.demoRefillAt)||0)+DEMO_REFILL_COOLDOWN;
  if(availableAt>now){const hours=Math.max(1,Math.ceil((availableAt-now)/3600000));return {ok:false,message:`Secours déjà utilisé · disponible dans ${hours} h`,availableAt};}
  return {ok:true,balance:DEMO_REFILL_BALANCE,refilledAt:now};
}

export class MatchRoom{
  constructor(state,env){this.state=state;this.env=env;}
  sockets(){return this.state.getWebSockets();}
  async canonical(player){let current=player;for(let i=0;i<4;i++){const next=await this.state.storage.get('alias:'+current);if(!next||next===current)break;current=next;}return current;}
  async wallet(player,initial={}){
    let wallet=await this.state.storage.get('wallet:'+player);if(wallet)return wallet;
    const safe=(value,fallback,max=1000000)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Math.floor(Number(value)))):fallback;
    wallet={balance:safe(initial.balance,12500,50000),rounds:safe(initial.rounds,0),wins:safe(initial.wins,0),losses:safe(initial.losses,0),wagered:safe(initial.wagered,0),paid:safe(initial.paid,0),last:null};
    await this.state.storage.put('wallet:'+player,wallet);return wallet;
  }
  async jackpot(initial=0){let value=await this.state.storage.get('jackpot');if(value===undefined){value=Math.max(0,Math.min(15000,Math.floor(Number(initial)||0)));await this.state.storage.put('jackpot',value);}return value;}
  async sendWallet(socket,player,wallet=null){const value=wallet||await this.wallet(player),jackpot=await this.jackpot();this.send(socket,{type:'wallet',wallet:value,jackpot});}
  sendPlayer(player,message){for(const socket of this.sockets())if(socket.deserializeAttachment()?.player===player)this.send(socket,message);}
  async createRound(){
    const seed=nextSeed(),round={id:crypto.randomUUID(),seed,raceAt:Date.now()+9000,bots:botPicks(seed),bets:{},closing:false};
    await this.state.storage.put('round',round);await this.state.storage.setAlarm(round.raceAt+55000);return round;
  }
  async current(){let round=await this.state.storage.get('round');if(round&&Date.now()>round.raceAt+60000&&!round.closing)await this.refund(round);if(!round||Date.now()>round.raceAt+60000)round=await this.createRound();return round;}
  market(round){
    const counts=Object.fromEntries(['A','B','C','D','E','F'].map(id=>[id,0]));
    for(const id of round.bots||[])if(counts[id]!==undefined)counts[id]++;
    for(const picks of Object.values(round.bets||{}))for(const id of picks)if(counts[id]!==undefined)counts[id]++;
    return {type:'market',roundId:round.id,counts,humans:this.sockets().length,bots:(round.bots||[]).length};
  }
  send(socket,message){try{socket.send(JSON.stringify(message));}catch{}}
  broadcast(message){for(const socket of this.sockets())this.send(socket,message);}
  async refund(round){
    for(const [player,picks] of Object.entries(round.bets||{})){const amount=picks.length*500,wallet=await this.wallet(player);wallet.balance+=amount;wallet.wagered=Math.max(0,wallet.wagered-amount);await this.state.storage.put('wallet:'+player,wallet);this.sendPlayer(player,{type:'wallet',wallet,jackpot:await this.jackpot()});}
  }
  async settle(round,winner){
    const market=this.market(round),pot=Object.values(market.counts).reduce((sum,count)=>sum+count*500,0),basePool=Math.floor(pot*.88),winningPool=(market.counts[winner]||0)*500;
    let jackpot=await this.jackpot(),realWinningStake=0;for(const picks of Object.values(round.bets||{}))realWinningStake+=picks.filter(id=>id===winner).length*500;
    if(!winningPool)jackpot=Math.min(15000,jackpot+Math.floor(basePool*.15));
    const settlements={};
    for(const [player,picks] of Object.entries(round.bets||{})){
      const wallet=await this.wallet(player),stake=picks.length*500,winningStake=picks.filter(id=>id===winner).length*500;
      let payout=winningPool?Math.floor(basePool*winningStake/winningPool):0;if(winningStake&&realWinningStake)payout+=Math.floor(jackpot*winningStake/realWinningStake);
      wallet.balance+=payout;wallet.rounds++;wallet.paid+=payout;if(payout>stake)wallet.wins++;else wallet.losses++;wallet.last={winner,choice:picks.join('+'),payout,profit:payout-stake,at:Date.now()};
      await this.state.storage.put('wallet:'+player,wallet);settlements[player]={winner,pot,stake,payout,profit:payout-stake,wallet};
    }
    if(realWinningStake)jackpot=0;await this.state.storage.put('jackpot',jackpot);round.settlements=settlements;return {pot,jackpot,settlements};
  }
  async sendSettlement(socket,round){
    const player=socket.deserializeAttachment()?.player;if(!player)return;const wallet=await this.wallet(player),entry=round.settlements?.[player]||{winner:round.result?.winner,pot:this.market(round).counts?Object.values(this.market(round).counts).reduce((sum,count)=>sum+count*500,0):0,stake:0,payout:0,profit:0};
    this.send(socket,{type:'settlement',...entry,wallet,jackpot:await this.jackpot()});
  }
  async fetch(request){
    if(request.headers.get('Upgrade')!=='websocket')return new Response('WebSocket required',{status:426});
    const url=new URL(request.url),session=url.searchParams.get('session'),device=url.searchParams.get('player');if(!validId(session)||!validId(device))return new Response('Invalid identity',{status:400});const player=await this.canonical(device);
    const initial={balance:url.searchParams.get('balance'),rounds:url.searchParams.get('rounds'),wins:url.searchParams.get('wins'),losses:url.searchParams.get('losses'),wagered:url.searchParams.get('wagered'),paid:url.searchParams.get('paid')};
    const wallet=await this.wallet(player,initial);await this.jackpot(url.searchParams.get('jackpot'));
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.state.acceptWebSocket(server);server.serializeAttachment({session,device,player});
    const round=await this.current();
    await this.sendWallet(server,player,wallet);
    if(round.bets?.[player]?.length)this.send(server,{type:'bet_ack',choices:round.bets[player],wallet,jackpot:await this.jackpot()});
    this.send(server,{type:'round',roundId:round.id,seed:round.seed,raceAt:round.raceAt,catchingUp:Date.now()>=round.raceAt});
    if(round.closing&&round.result){this.send(server,{type:'result',roundId:round.id,...round.result});await this.sendSettlement(server,round);}
    this.broadcast(this.market(round));return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(socket,message){
    let data;try{data=JSON.parse(String(message));}catch{return;}const round=await this.current(),attachment=socket.deserializeAttachment()||{},player=attachment.player;
    if(data.type==='pair_create'&&player){
      let code;for(let i=0;i<5;i++){const candidate=pairingCode();if(!await this.state.storage.get('pair:'+candidate)){code=candidate;break;}}if(!code){this.send(socket,{type:'pair_error',message:'Impossible de créer un code'});return;}
      const expiresAt=Date.now()+600000;await this.state.storage.put('pair:'+code,{player,expiresAt});this.send(socket,{type:'pairing_code',code,expiresAt});return;
    }
    if(data.type==='pair_claim'&&attachment.device){
      const code=String(data.code||'').trim().toUpperCase(),link=await this.state.storage.get('pair:'+code);if(!/^[A-Z2-9]{6}$/.test(code)||!link||link.expiresAt<Date.now()){this.send(socket,{type:'pair_error',message:'Code invalide ou expiré'});return;}
      const target=await this.canonical(link.player),source=await this.canonical(attachment.device);if((round.bets?.[source]?.length||round.bets?.[target]?.length)){this.send(socket,{type:'pair_error',message:'Association après la fin de la manche en cours'});return;}
      await this.state.storage.put('alias:'+attachment.device,target);await this.state.storage.delete('pair:'+code);socket.serializeAttachment({...attachment,player:target});const wallet=await this.wallet(target),jackpot=await this.jackpot();
      this.send(socket,{type:'pair_success',playerId:target,wallet,jackpot});this.sendPlayer(target,{type:'pair_notice',message:'Nouvel appareil associé au portefeuille'});return;
    }
    if(data.type==='demo_refill'&&player){
      const wallet=await this.wallet(player),decision=demoRefillDecision(wallet,round.bets?.[player]?.length||0);
      if(!decision.ok){this.send(socket,{type:'demo_refill_error',message:decision.message,availableAt:decision.availableAt||null});return;}
      wallet.balance=decision.balance;wallet.demoRefillAt=decision.refilledAt;await this.state.storage.put('wallet:'+player,wallet);
      const jackpot=await this.jackpot();this.sendPlayer(player,{type:'wallet',wallet,jackpot});this.sendPlayer(player,{type:'demo_refill_success',amount:decision.balance,message:'2 500 CR de test ajoutés · cinq tickets disponibles'});return;
    }
    if(data.type==='bet'&&data.roundId===round.id&&Date.now()<round.raceAt&&/^[A-F]$/.test(data.choice)&&[1,2].includes(data.ticket)&&player){
      const picks=Array.isArray(round.bets[player])?round.bets[player].slice(0,2):[],wallet=await this.wallet(player);
      if(picks[data.ticket-1]){this.send(socket,{type:'bet_error',message:'Ticket déjà utilisé'});return;}if(wallet.balance<500){this.send(socket,{type:'bet_error',message:'Solde insuffisant'});return;}
      picks[data.ticket-1]=data.choice;round.bets[player]=picks.filter(Boolean);wallet.balance-=500;wallet.wagered+=500;await this.state.storage.put('round',round);await this.state.storage.put('wallet:'+player,wallet);
      this.sendPlayer(player,{type:'bet_ack',choices:round.bets[player],wallet,jackpot:await this.jackpot()});this.broadcast(this.market(round));
    }
    if(data.type==='finished'&&data.roundId===round.id&&!round.closing&&Date.now()>=round.raceAt+5000){
      round.closing=true;round.result={winner:/^[A-F]$/.test(data.winner)?data.winner:null,durationMs:Math.max(5000,Math.min(120000,Date.now()-round.raceAt))};await this.settle(round,round.result.winner);await this.state.storage.put('round',round);await this.state.storage.setAlarm(Date.now()+8000);this.broadcast({type:'result',roundId:round.id,...round.result});for(const peer of this.sockets())await this.sendSettlement(peer,round);
    }
  }
  async webSocketClose(){const round=await this.current();this.broadcast(this.market(round));}
  async webSocketError(){const round=await this.current();this.broadcast(this.market(round));}
  async alarm(){const previous=await this.state.storage.get('round');if(previous&&!previous.closing)await this.refund(previous);const round=await this.createRound();this.broadcast({type:'round',roundId:round.id,seed:round.seed,raceAt:round.raceAt});this.broadcast(this.market(round));}
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS_HEADERS});
    const url=new URL(request.url);
    try{
      if(request.method==='POST'&&url.pathname==='/api/events')return await receiveEvent(request,env);
      if(request.method==='GET'&&url.pathname==='/api/stats')return await stats(request,env);
      if(request.method==='GET'&&url.pathname==='/api/live'){
        if(request.headers.get('origin')!=='https://lebucheron.github.io')return json({error:'origin_forbidden'},403);
        const id=env.MATCH_ROOM.idFromName('public-arena-v2');return env.MATCH_ROOM.get(id).fetch(request);
      }
      if(request.method==='GET'&&url.pathname==='/health')return json({ok:true});
      return json({error:'not_found'},404);
    }catch(error){console.error(error);return json({error:'server_error'},500);}
  }
};
