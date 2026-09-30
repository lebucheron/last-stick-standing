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
    await env.DB.prepare(`INSERT INTO events
      (session_id, type, round_id, winner, choice, bet_placed, won, duration_ms, sudden_death, is_test, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(event.session_id,event.type,String(event.round_id||'').slice(0,80)||null,/^[A-F]$/.test(event.winner)?event.winner:null,/^[A-F]$/.test(event.choice)?event.choice:null,event.bet_placed?1:0,event.won?1:0,duration,event.sudden_death?1:0,isTest,now).run();
  }
  return json({ok:true},202);
}

async function stats(request,env){
  const expected=env.ADMIN_TOKEN;
  if(!expected||request.headers.get('authorization')!==`Bearer ${expected}`)return json({error:'unauthorized'},401);
  const since=env.STATS_SINCE||'1970-01-01T00:00:00Z';
  const [active,visitors,rounds,average,winners,recent]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE COALESCE(is_test,0)=0 AND datetime(last_seen) >= datetime('now','-45 seconds')").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE COALESCE(is_test,0)=0 AND datetime(first_seen) >= date('now')").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=?").bind(since).first(),
    env.DB.prepare("SELECT AVG(duration_ms) value FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=?").bind(since).first(),
    env.DB.prepare("SELECT winner, COUNT(*) count FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=? GROUP BY winner").bind(since).all(),
    env.DB.prepare("SELECT winner, won, duration_ms, sudden_death, created_at FROM events WHERE type='race_finished' AND COALESCE(is_test,0)=0 AND created_at>=? ORDER BY id DESC LIMIT 12").bind(since).all()
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
