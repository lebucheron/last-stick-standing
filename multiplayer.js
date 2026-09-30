(() => {
  const endpoint=(window.LAST_STICK_TELEMETRY_ENDPOINT||'').replace(/\/$/,''),root=document.querySelector('#stick-tetris');
  if(!endpoint||!root)return;
  root.dataset.walletMode='connecting';
  const live=document.querySelector('#live-pill'),roundLabel=document.querySelector('#round-label');
  const linkToggle=document.querySelector('#device-link-toggle'),linkPanel=document.querySelector('#device-link'),pairCreate=document.querySelector('#pair-create'),pairCode=document.querySelector('#pair-code'),pairInput=document.querySelector('#pair-input'),pairClaim=document.querySelector('#pair-claim'),pairState=document.querySelector('#pair-state');
  const SESSION_KEY='last-stick-session-v1',PLAYER_KEY='last-stick-player-v1',ECONOMY_KEY='last-stick-economy-v2';let sessionId,playerId,socket,retry;
  try{sessionId=sessionStorage.getItem(SESSION_KEY);if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem(SESSION_KEY,sessionId);}}catch{sessionId=crypto.randomUUID();}
  try{playerId=localStorage.getItem(PLAYER_KEY);if(!playerId){playerId=crypto.randomUUID();localStorage.setItem(PLAYER_KEY,playerId);}}catch{playerId=crypto.randomUUID();}
  let imported={};try{imported=JSON.parse(localStorage.getItem(ECONOMY_KEY)||'{}')||{};}catch{}
  const dispatch=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
  function connect(){
    clearTimeout(retry);const url=new URL(endpoint);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/api/live';url.searchParams.set('session',sessionId);url.searchParams.set('player',playerId);
    for(const key of ['balance','jackpot','rounds','wins','losses','wagered','paid'])if(Number.isFinite(Number(imported[key])))url.searchParams.set(key,String(Math.max(0,Math.floor(Number(imported[key])))));
    socket=new WebSocket(url);
    socket.addEventListener('open',()=>{root.dataset.networked='1';if(live)live.lastChild.textContent=' MULTI EN DIRECT';});
    socket.addEventListener('message',event=>{
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='round'){root.dataset.roundId=data.roundId;if(roundLabel)roundLabel.textContent='MANCHE '+data.roundId.slice(0,6).toUpperCase()+(data.catchingUp?' · RATTRAPAGE':'');dispatch('laststick:round',data);}
      if(data.type==='waiting')dispatch('laststick:waiting',data);
      if(data.type==='result')dispatch('laststick:server-result',data);
      if(data.type==='wallet'){root.dataset.serverWallet=JSON.stringify(data);dispatch('laststick:wallet',data);}
      if(data.type==='bet_ack'){root.dataset.serverWallet=JSON.stringify(data);root.dataset.serverBets=JSON.stringify(data.choices||[]);dispatch('laststick:bet-ack',data);}
      if(data.type==='bet_error')dispatch('laststick:bet-error',data);
      if(data.type==='settlement')dispatch('laststick:settlement',data);
      if(data.type==='pairing_code'){pairCode.textContent=data.code.slice(0,3)+' '+data.code.slice(3);pairState.textContent='Code valable 10 minutes';}
      if(data.type==='pair_success'){playerId=data.playerId;try{localStorage.setItem(PLAYER_KEY,playerId);}catch{}root.dataset.serverWallet=JSON.stringify(data);dispatch('laststick:wallet',data);pairState.textContent='Appareil associé · portefeuille synchronisé';pairInput.value='';}
      if(data.type==='pair_notice')pairState.textContent=data.message||'Nouvel appareil associé';
      if(data.type==='pair_error')pairState.textContent=data.message||'Association impossible';
      if(data.type==='market'){root.dataset.livePlayers=String(data.humans||0);root.dataset.liveMarket=JSON.stringify(data.counts||{});if(live)live.lastChild.textContent=' MULTI · '+(data.humans||0)+' EN LIGNE';dispatch('laststick:market',data);}
    });
    socket.addEventListener('close',()=>{if(live)live.lastChild.textContent=' RECONNEXION';retry=setTimeout(connect,2200);});
  }
  window.addEventListener('laststick:event',event=>{
    if(socket?.readyState!==WebSocket.OPEN)return;const data=event.detail||{},roundId=root.dataset.roundId;
    if(data.type==='race_finished')socket.send(JSON.stringify({type:'finished',roundId,winner:data.winner,durationMs:data.duration_ms}));
  });
  window.addEventListener('laststick:bet-request',event=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'bet',roundId:root.dataset.roundId,choice:event.detail.choice,ticket:event.detail.ticket}));});
  linkToggle?.addEventListener('click',()=>{linkPanel.hidden=!linkPanel.hidden;});
  pairCreate?.addEventListener('click',()=>{if(socket?.readyState===WebSocket.OPEN){pairState.textContent='Création du code…';socket.send(JSON.stringify({type:'pair_create'}));}});
  pairInput?.addEventListener('input',()=>{pairInput.value=pairInput.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);});
  pairClaim?.addEventListener('click',()=>{const code=pairInput.value.trim().toUpperCase();if(code.length!==6){pairState.textContent='Entre les 6 caractères du code';return;}if(socket?.readyState===WebSocket.OPEN){pairState.textContent='Association…';socket.send(JSON.stringify({type:'pair_claim',code}));}});
  connect();
})();
