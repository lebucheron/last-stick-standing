(() => {
  const endpoint=(window.LAST_STICK_TELEMETRY_ENDPOINT||'').replace(/\/$/,'');
  if(!endpoint)return;

  const SESSION_KEY='last-stick-session-v1';
  let sessionId;
  try{
    sessionId=sessionStorage.getItem(SESSION_KEY);
    if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem(SESSION_KEY,sessionId);}
  }catch{sessionId=crypto.randomUUID?.()||String(Date.now())+Math.random();}

  function send(type,data={}){
    const body=JSON.stringify({type,session_id:sessionId,page:location.pathname,...data});
    if(navigator.sendBeacon&&type==='session_left'){
      navigator.sendBeacon(endpoint+'/api/events',new Blob([body],{type:'text/plain'}));
      return;
    }
    fetch(endpoint+'/api/events',{method:'POST',headers:{'content-type':'text/plain'},body,keepalive:true,mode:'cors'}).catch(()=>{});
  }

  send('session_started',{referrer:document.referrer?new URL(document.referrer).hostname:''});
  const heartbeat=setInterval(()=>send('heartbeat'),15000);
  window.addEventListener('laststick:event',event=>send(event.detail.type,event.detail));
  window.addEventListener('pagehide',()=>{clearInterval(heartbeat);send('session_left');},{once:true});
})();
