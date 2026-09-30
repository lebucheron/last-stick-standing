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
function cleanDeaths(value){
  if(!Array.isArray(value))return [];
  return value.slice(0,6).flatMap(item=>{
    const runner=String(item?.runner||''),cause=String(item?.cause||''),at=Number(item?.at);
    return /^[A-F]$/.test(runner)&&['impact','écrasement','combat'].includes(cause)&&Number.isFinite(at)&&at>=0&&at<=120?[{runner,cause,at:Math.round(at*10)/10}]:[];
  });
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
    await env.DB.prepare(`INSERT INTO events
      (session_id, type, round_id, seed, winner, choice, bet_placed, won, duration_ms, sudden_death, winner_start, deaths, is_test, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(event.session_id,event.type,String(event.round_id||'').slice(0,80)||null,roundSeed,/^[A-F]$/.test(event.winner)?event.winner:null,/^[A-F]$/.test(event.choice)?event.choice:null,event.bet_placed?1:0,event.won?1:0,duration,event.sudden_death?1:0,winnerStart,deaths,isTest,now).run();
  }
  return json({ok:true},202);
}

async function stats(request,env){
  const expected=env.ADMIN_TOKEN;
  if(!expected||request.headers.get('authorization')!==`Bearer ${expected}`)return json({error:'unauthorized'},401);
  const since=env.STATS_SINCE||'1970-01-01T00:00:00Z';
  const [active,visitors,rounds,average,winners,starts,causes,combat,recent]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE COALESCE(is_test,0)=0 AND datetime(last_seen) >= datetime('now','-45 seconds')").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE COALESCE(is_test,0)=0 AND datetime(first_seen) >= date('now')").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=?").bind(since).first(),
    env.DB.prepare("SELECT AVG(duration_ms) value FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=?").bind(since).first(),
    env.DB.prepare("SELECT winner, COUNT(*) count FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=? GROUP BY winner").bind(since).all(),
    env.DB.prepare("SELECT winner_start, COUNT(*) count FROM events WHERE type='race_finished' AND winner_start IS NOT NULL AND COALESCE(is_test,0)=0 AND created_at>=? GROUP BY winner_start").bind(since).all(),
    env.DB.prepare("SELECT json_extract(value,'$.cause') cause, COUNT(*) count FROM events, json_each(events.deaths) WHERE events.type='race_finished' AND deaths IS NOT NULL AND json_valid(deaths) AND COALESCE(is_test,0)=0 AND events.created_at>=? GROUP BY cause").bind(since).all(),
    env.DB.prepare("SELECT COUNT(*) count FROM events WHERE type='race_finished' AND sudden_death=1 AND COALESCE(is_test,0)=0 AND created_at>=?").bind(since).first(),
    env.DB.prepare("SELECT winner, won, duration_ms, sudden_death, winner_start, seed, created_at FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=? ORDER BY id DESC LIMIT 12").bind(since).all()
  ]);
  const byWinner=Object.fromEntries((winners.results||[]).map(row=>[row.winner,row.count]));
  const byStart=Object.fromEntries((starts.results||[]).map(row=>[row.winner_start,row.count]));
  const byCause=Object.fromEntries((causes.results||[]).map(row=>[row.cause,row.count]));
  const roundCount=rounds?.count||0;
  return json({active_now:active?.count||0,visitors_today:visitors?.count||0,rounds_today:roundCount,average_duration_ms:average?.value||null,combat_final_count:combat?.count||0,combat_final_rate:roundCount?(combat?.count||0)/roundCount:0,winners:byWinner,winning_starts:byStart,death_causes:byCause,recent_rounds:recent.results||[]},200,{'cache-control':'no-store'});
}

function nextSeed(){const data=new Uint32Array(1);crypto.getRandomValues(data);return data[0]||1;}
function botPicks(seed){
  let value=seed>>>0;const picks=[];
  for(let i=0;i<5;i++){value^=value<<13;value^=value>>>17;value^=value<<5;picks.push(String.fromCharCode(65+(value>>>0)%6));}
  if(new Set(picks).size===1)picks[4]=String.fromCharCode(65+((picks[4].charCodeAt(0)-64)%6));
  return picks;
}

export class MatchRoom{
  constructor(state,env){this.state=state;this.env=env;}
  sockets(){return this.state.getWebSockets();}
  async createRound(){
    const seed=nextSeed(),round={id:crypto.randomUUID(),seed,raceAt:Date.now()+9000,bots:botPicks(seed),bets:{},closing:false};
    await this.state.storage.put('round',round);await this.state.storage.setAlarm(round.raceAt+55000);return round;
  }
  async current(){let round=await this.state.storage.get('round');if(!round||Date.now()>round.raceAt+60000)round=await this.createRound();return round;}
  market(round){
    const counts=Object.fromEntries(['A','B','C','D','E','F'].map(id=>[id,0]));
    for(const id of round.bots||[])if(counts[id]!==undefined)counts[id]++;
    for(const picks of Object.values(round.bets||{}))for(const id of picks)if(counts[id]!==undefined)counts[id]++;
    return {type:'market',roundId:round.id,counts,humans:this.sockets().length,bots:(round.bots||[]).length};
  }
  send(socket,message){try{socket.send(JSON.stringify(message));}catch{}}
  broadcast(message){for(const socket of this.sockets())this.send(socket,message);}
  async fetch(request){
    if(request.headers.get('Upgrade')!=='websocket')return new Response('WebSocket required',{status:426});
    const session=new URL(request.url).searchParams.get('session');if(!validId(session))return new Response('Invalid session',{status:400});
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.state.acceptWebSocket(server);server.serializeAttachment({session});
    const round=await this.current();
    if(Date.now()<round.raceAt)this.send(server,{type:'round',roundId:round.id,seed:round.seed,raceAt:round.raceAt});else this.send(server,{type:'waiting',roundId:round.id});
    this.broadcast(this.market(round));return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(socket,message){
    let data;try{data=JSON.parse(String(message));}catch{return;}const round=await this.current(),session=socket.deserializeAttachment()?.session;
    if(data.type==='bet'&&data.roundId===round.id&&Date.now()<round.raceAt&&/^[A-F]$/.test(data.choice)&&[1,2].includes(data.ticket)&&session){
      const picks=Array.isArray(round.bets[session])?round.bets[session].slice(0,2):[];picks[data.ticket-1]=data.choice;round.bets[session]=picks.filter(Boolean);await this.state.storage.put('round',round);this.broadcast(this.market(round));
    }
    if(data.type==='finished'&&data.roundId===round.id&&!round.closing&&Date.now()>=round.raceAt+5000){
      round.closing=true;await this.state.storage.put('round',round);await this.state.storage.setAlarm(Date.now()+6000);this.broadcast({type:'result',roundId:round.id,winner:/^[A-F]$/.test(data.winner)?data.winner:null});
    }
  }
  async webSocketClose(){const round=await this.current();this.broadcast(this.market(round));}
  async webSocketError(){const round=await this.current();this.broadcast(this.market(round));}
  async alarm(){const round=await this.createRound();this.broadcast({type:'round',roundId:round.id,seed:round.seed,raceAt:round.raceAt});this.broadcast(this.market(round));}
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
        const id=env.MATCH_ROOM.idFromName('public-arena-v1');return env.MATCH_ROOM.get(id).fetch(request);
      }
      if(request.method==='GET'&&url.pathname==='/health')return json({ok:true});
      return json({error:'not_found'},404);
    }catch(error){console.error(error);return json({error:'server_error'},500);}
  }
};
