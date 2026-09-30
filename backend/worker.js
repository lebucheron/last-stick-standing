const ALLOWED_EVENTS=new Set(['session_started','heartbeat','session_left','bet_placed','race_started','race_finished']);
const CORS_HEADERS={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'authorization,content-type',
  'access-control-max-age':'86400'
};

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...CORS_HEADERS,...extra}});
}

function validId(value){return typeof value==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(value);}

async function receiveEvent(request,env){
  const length=Number(request.headers.get('content-length')||0);
  if(length>4096)return json({error:'payload_too_large'},413);
  let event;
  try{event=JSON.parse(await request.text());}catch{return json({error:'invalid_json'},400);}
  if(!ALLOWED_EVENTS.has(event.type)||!validId(event.session_id))return json({error:'invalid_event'},400);

  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO sessions (id, first_seen, last_seen, page, referrer)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen, page=excluded.page`)
    .bind(event.session_id,now,now,String(event.page||'').slice(0,120),String(event.referrer||'').slice(0,120)).run();

  if(event.type==='session_left'){
    await env.DB.prepare('UPDATE sessions SET last_seen=? WHERE id=?').bind(new Date(Date.now()-60000).toISOString(),event.session_id).run();
  }
  if(!['heartbeat','session_left'].includes(event.type)){
    const duration=Number.isFinite(Number(event.duration_ms))?Math.max(0,Math.min(180000,Number(event.duration_ms))):null;
    await env.DB.prepare(`INSERT INTO events
      (session_id, type, round_id, winner, choice, bet_placed, won, duration_ms, sudden_death, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(event.session_id,event.type,String(event.round_id||'').slice(0,80)||null,/^[A-F]$/.test(event.winner)?event.winner:null,/^[A-F]$/.test(event.choice)?event.choice:null,event.bet_placed?1:0,event.won?1:0,duration,event.sudden_death?1:0,now).run();
  }
  return json({ok:true},202);
}

async function stats(request,env){
  const expected=env.ADMIN_TOKEN;
  if(!expected||request.headers.get('authorization')!==`Bearer ${expected}`)return json({error:'unauthorized'},401);
  const [active,visitors,rounds,average,winners,recent]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE datetime(last_seen) >= datetime('now','-45 seconds')").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE datetime(first_seen) >= date('now')").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM events WHERE type='race_finished' AND datetime(created_at) >= date('now')").first(),
    env.DB.prepare("SELECT AVG(duration_ms) value FROM events WHERE type='race_finished' AND datetime(created_at) >= date('now')").first(),
    env.DB.prepare("SELECT winner, COUNT(*) count FROM events WHERE type='race_finished' GROUP BY winner").all(),
    env.DB.prepare("SELECT winner, won, duration_ms, sudden_death, created_at FROM events WHERE type='race_finished' ORDER BY id DESC LIMIT 12").all()
  ]);
  const byWinner=Object.fromEntries((winners.results||[]).map(row=>[row.winner,row.count]));
  return json({active_now:active?.count||0,visitors_today:visitors?.count||0,rounds_today:rounds?.count||0,average_duration_ms:average?.value||null,winners:byWinner,recent_rounds:recent.results||[]},200,{'cache-control':'no-store'});
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS_HEADERS});
    const url=new URL(request.url);
    try{
      if(request.method==='POST'&&url.pathname==='/api/events')return await receiveEvent(request,env);
      if(request.method==='GET'&&url.pathname==='/api/stats')return await stats(request,env);
      if(request.method==='GET'&&url.pathname==='/health')return json({ok:true});
      return json({error:'not_found'},404);
    }catch(error){console.error(error);return json({error:'server_error'},500);}
  }
};
