(() => {
  const form=document.querySelector('#admin-login'),dashboard=document.querySelector('#dashboard'),connection=document.querySelector('#connection');
  const apiInput=document.querySelector('#api-url'),keyInput=document.querySelector('#admin-key');
  const colors={A:'#4da3ff',B:'#ff9f43',C:'#52d273',D:'#ff6ba9',E:'#b77cff',F:'#f1d34f'};
  let timer;
  apiInput.value=localStorage.getItem('last-stick-api-url')||window.LAST_STICK_TELEMETRY_ENDPOINT||'';
  const number=value=>Number(value||0).toLocaleString('fr-FR');
  async function refresh(){
    const endpoint=apiInput.value.replace(/\/$/,''),key=keyInput.value;
    try{
      const response=await fetch(endpoint+'/api/stats',{headers:{authorization:'Bearer '+key},cache:'no-store'});
      if(!response.ok)throw new Error(response.status===401?'Clé refusée':'API indisponible');
      const stats=await response.json();
      document.querySelector('#active-now').textContent=number(stats.active_now);
      document.querySelector('#visitors-today').textContent=number(stats.visitors_today);
      document.querySelector('#rounds-today').textContent=number(stats.rounds_today);
      document.querySelector('#average-duration').textContent=stats.average_duration_ms?Math.round(stats.average_duration_ms/1000)+' s':'—';
      const max=Math.max(1,...Object.values(stats.winners||{}));
      document.querySelector('#winners').innerHTML=Object.keys(colors).map(id=>`<div class="winner-row"><b>${id}</b><i style="--bar:${colors[id]};--width:${(stats.winners?.[id]||0)/max*100}%"></i><span>${number(stats.winners?.[id])}</span></div>`).join('');
      document.querySelector('#recent-rounds').innerHTML=(stats.recent_rounds||[]).map(round=>`<div class="recent-round"><b>${round.winner} gagne${round.won?' · pari gagné':''}</b><span>${Math.round(round.duration_ms/1000)} s</span><small>${new Date(round.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}${round.sudden_death?' · combat final':''}</small></div>`).join('')||'<small>Aucune manche reçue.</small>';
      connection.textContent='EN DIRECT';connection.className='connection online';dashboard.hidden=false;
      document.querySelector('#last-refresh').textContent='Actualisé à '+new Date().toLocaleTimeString('fr-FR');
      localStorage.setItem('last-stick-api-url',endpoint);
    }catch(error){connection.textContent=error.message.toUpperCase();connection.className='connection error';}
  }
  form.addEventListener('submit',event=>{event.preventDefault();clearInterval(timer);refresh();timer=setInterval(refresh,5000);});
})();
