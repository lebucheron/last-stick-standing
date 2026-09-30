(() => {
  const endpoint=(window.LAST_STICK_TELEMETRY_ENDPOINT||'').replace(/\/$/,''),root=document.querySelector('#stick-tetris');
  if(!endpoint||!root)return;
  const live=document.querySelector('#live-pill'),roundLabel=document.querySelector('#round-label');
  const SESSION_KEY='last-stick-session-v1';let sessionId,socket,retry;
  try{sessionId=sessionStorage.getItem(SESSION_KEY);if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem(SESSION_KEY,sessionId);}}catch{sessionId=crypto.randomUUID();}
  const dispatch=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
  function connect(){
    clearTimeout(retry);const url=new URL(endpoint);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/api/live';url.searchParams.set('session',sessionId);
    socket=new WebSocket(url);
    socket.addEventListener('open',()=>{root.dataset.networked='1';if(live)live.lastChild.textContent=' MULTI EN DIRECT';});
    socket.addEventListener('message',event=>{
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='round'){root.dataset.roundId=data.roundId;if(roundLabel)roundLabel.textContent='MANCHE '+data.roundId.slice(0,6).toUpperCase()+(data.catchingUp?' · RATTRAPAGE':'');dispatch('laststick:round',data);}
      if(data.type==='waiting')dispatch('laststick:waiting',data);
      if(data.type==='result')dispatch('laststick:server-result',data);
      if(data.type==='market'){root.dataset.livePlayers=String(data.humans||0);root.dataset.liveMarket=JSON.stringify(data.counts||{});if(live)live.lastChild.textContent=' MULTI · '+(data.humans||0)+' EN LIGNE';dispatch('laststick:market',data);}
    });
    socket.addEventListener('close',()=>{if(live)live.lastChild.textContent=' RECONNEXION';retry=setTimeout(connect,2200);});
  }
  window.addEventListener('laststick:event',event=>{
    if(socket?.readyState!==WebSocket.OPEN)return;const data=event.detail||{},roundId=root.dataset.roundId;
    if(data.type==='bet_placed')socket.send(JSON.stringify({type:'bet',roundId,choice:data.choice,ticket:data.ticket}));
    if(data.type==='race_finished')socket.send(JSON.stringify({type:'finished',roundId,winner:data.winner,durationMs:data.duration_ms}));
  });
  connect();
})();
