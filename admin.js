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
      document.querySelector('#combat-rate').textContent=stats.rounds_today?Math.round((stats.combat_final_rate||0)*100)+' %':'—';
      document.querySelector('#combat-count').textContent=number(stats.combat_final_count)+' manche'+(stats.combat_final_count===1?'':'s');
      const max=Math.max(1,...Object.values(stats.winners||{}));
      document.querySelector('#winners').innerHTML=Object.keys(colors).map(id=>`<div class="winner-row"><b>${id}</b><i style="--bar:${colors[id]};--width:${(stats.winners?.[id]||0)/max*100}%"></i><span>${number(stats.winners?.[id])}</span></div>`).join('');
      const startMax=Math.max(1,...Object.values(stats.winning_starts||{}));
      document.querySelector('#winning-starts').innerHTML=Array.from({length:10},(_,i)=>`<div class="winner-row"><b>${i+1}</b><i style="--bar:#7ddf8a;--width:${(stats.winning_starts?.[i]||0)/startMax*100}%"></i><span>${number(stats.winning_starts?.[i])}</span></div>`).join('');
      const causeLabels={impact:'Impact direct','écrasement':'Écrasement','combat':'Combat final'},causeColors={impact:'#ff7d62','écrasement':'#d85151',combat:'#b77cff'},causeMax=Math.max(1,...Object.values(stats.death_causes||{}));
      document.querySelector('#death-causes').innerHTML=Object.keys(causeLabels).map(id=>`<div class="winner-row cause-row"><b>${causeLabels[id]}</b><i style="--bar:${causeColors[id]};--width:${(stats.death_causes?.[id]||0)/causeMax*100}%"></i><span>${number(stats.death_causes?.[id])}</span></div>`).join('');
      document.querySelector('#recent-rounds').innerHTML=(stats.recent_rounds||[]).map(round=>`<div class="recent-round"><b>${round.winner} gagne${round.won?' · pari gagné':''}</b><span>${Math.round(round.duration_ms/1000)} s</span><small>${new Date(round.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}${round.winner_start===null||round.winner_start===undefined?'':' · départ '+(round.winner_start+1)}${round.sudden_death?' · combat final':''}${round.seed?' · seed '+round.seed:''}</small></div>`).join('')||'<small>Aucune manche reçue.</small>';
      connection.textContent='EN DIRECT';connection.className='connection online';dashboard.hidden=false;
      document.querySelector('#last-refresh').textContent='Actualisé à '+new Date().toLocaleTimeString('fr-FR');
      localStorage.setItem('last-stick-api-url',endpoint);
    }catch(error){connection.textContent=error.message.toUpperCase();connection.className='connection error';}
  }
  form.addEventListener('submit',event=>{event.preventDefault();clearInterval(timer);refresh();timer=setInterval(refresh,5000);});
})();
