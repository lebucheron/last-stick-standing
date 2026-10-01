(() => {
  const form=document.querySelector('#admin-login'),dashboard=document.querySelector('#dashboard'),connection=document.querySelector('#connection');
  const apiInput=document.querySelector('#api-url'),keyInput=document.querySelector('#admin-key'),rulesetFilter=document.querySelector('#ruleset-filter');
  const colors={A:'#4da3ff',B:'#ff9f43',C:'#52d273',D:'#ff6ba9',E:'#b77cff',F:'#f1d34f'};
  let timer,connected=false;
  apiInput.value=localStorage.getItem('last-stick-api-url')||window.LAST_STICK_TELEMETRY_ENDPOINT||'';
  const number=value=>Number(value||0).toLocaleString('fr-FR');
  const percent=value=>(Number(value||0)*100).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+' %';
  const seconds=value=>Number(value)>0?(Number(value)/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})+' s':'—';
  const eta=(rounds,average)=>{const remaining=Math.max(0,10000-rounds),hours=remaining*((Number(average)||35000)+17000)/3600000;if(!remaining)return 'ATTEINT';if(hours>=48)return (hours/24).toLocaleString('fr-FR',{maximumFractionDigits:1})+' jours';return hours.toLocaleString('fr-FR',{maximumFractionDigits:1})+' h';};
  const margin95=(wins,total)=>total?1.96*Math.sqrt((wins/total)*(1-wins/total)/total):0;
  function sampleText(count){
    if(count<100)return ['Échantillon exploratoire','Les écarts peuvent encore provenir largement du hasard.'];
    if(count<600)return ['Premières tendances','On surveille les écarts sans modifier les règles trop vite.'];
    if(count<3000)return ['Échantillon utile','Les biais persistants commencent à devenir crédibles.'];
    if(count<10000)return ['Analyse solide','Les petits écarts restent à confirmer jusqu’à 10 000 manches.'];
    return ['Audit de 10 000 manches atteint','La base permet une documentation statistique robuste.'];
  }
  function updateVersions(stats){
    const selected=stats.selected_ruleset||rulesetFilter.value||'R5',versions=stats.available_rulesets||[];
    rulesetFilter.replaceChildren();
    for(const item of versions){const option=document.createElement('option');option.value=item.ruleset;option.textContent=item.ruleset+' · '+number(item.count)+' manches';rulesetFilter.append(option);}
    if(!versions.some(item=>item.ruleset==='R5')){const option=document.createElement('option');option.value='R5';option.textContent='R5 · 0 manche';rulesetFilter.prepend(option);}
    const all=document.createElement('option');all.value='all';all.textContent='Toutes les versions';rulesetFilter.append(all);rulesetFilter.value=selected;
  }
  async function refresh(){
    const endpoint=apiInput.value.replace(/\/$/,''),key=keyInput.value,version=rulesetFilter.value||'R5';
    try{
      const response=await fetch(endpoint+'/api/stats?ruleset='+encodeURIComponent(version),{headers:{authorization:'Bearer '+key},cache:'no-store'});
      if(!response.ok)throw new Error(response.status===401?'Clé refusée':'API indisponible');
      const stats=await response.json(),rounds=Number(stats.rounds_today)||0;updateVersions(stats);
      document.querySelector('#active-now').textContent=number(stats.active_now);
      document.querySelector('#visitors-today').textContent=number(stats.visitors_today);
      document.querySelector('#rounds-today').textContent=number(rounds);
      document.querySelector('#average-duration').textContent=seconds(stats.average_duration_ms);
      document.querySelector('#median-duration').textContent=seconds(stats.median_duration_ms);
      document.querySelector('#p90-duration').textContent=seconds(stats.p90_duration_ms);
      document.querySelector('#audit-eta').textContent=eta(rounds,stats.average_duration_ms);
      document.querySelector('#combat-rate').textContent=rounds?percent(stats.combat_final_rate):'—';
      document.querySelector('#combat-count').textContent=number(stats.combat_final_count)+' manche'+(stats.combat_final_count===1?'':'s');
      const [sampleLabel,sampleNote]=sampleText(rounds);document.querySelector('#sample-label').textContent=sampleLabel+' · '+number(rounds)+' manches uniques';document.querySelector('#sample-note').textContent=sampleNote;
      document.querySelector('#winners').innerHTML=Object.keys(colors).map(id=>{const wins=Number(stats.winners?.[id])||0,rate=rounds?wins/rounds:0,margin=margin95(wins,rounds);return `<div class="winner-row"><b>${id}</b><i style="--bar:${colors[id]};--width:${Math.min(100,rate*300)}%"></i><span>${percent(rate)} ± ${percent(margin)}</span></div>`;}).join('');
      document.querySelector('#winning-starts').innerHTML=Array.from({length:10},(_,i)=>{const wins=Number(stats.winning_starts?.[i])||0,starts=Number(stats.start_appearances?.[i])||0,rate=starts?wins/starts:0;return `<div class="winner-row"><b>${i+1}</b><i style="--bar:#7ddf8a;--width:${Math.min(100,rate*300)}%"></i><span>${percent(rate)} · ${wins}/${starts}</span></div>`;}).join('');
      const causeLabels={impact:'Impact direct','écrasement':'Écrasement','combat':'Combat final'},causeColors={impact:'#ff7d62','écrasement':'#d85151',combat:'#b77cff'},causeMax=Math.max(1,...Object.values(stats.death_causes||{}));
      document.querySelector('#death-causes').innerHTML=Object.keys(causeLabels).map(id=>`<div class="winner-row cause-row"><b>${causeLabels[id]}</b><i style="--bar:${causeColors[id]};--width:${(stats.death_causes?.[id]||0)/causeMax*100}%"></i><span>${number(stats.death_causes?.[id])}</span></div>`).join('');
      document.querySelector('#recent-rounds').innerHTML=(stats.recent_rounds||[]).map(round=>`<div class="recent-round"><b>${round.winner} gagne${round.won?' · pari gagné':''}</b><span>${seconds(round.duration_ms)}</span><small>${round.ruleset||'legacy'} · ${new Date(round.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}${round.winner_start===null||round.winner_start===undefined?'':' · départ '+(round.winner_start+1)}${round.sudden_death?' · combat final':''}${round.seed?' · seed '+round.seed:''}</small></div>`).join('')||'<small>Aucune manche reçue pour cette version.</small>';
      connection.textContent='EN DIRECT';connection.className='connection online';dashboard.hidden=false;connected=true;
      document.querySelector('#last-refresh').textContent='Actualisé à '+new Date().toLocaleTimeString('fr-FR')+' · une manche partagée ne compte qu’une fois';localStorage.setItem('last-stick-api-url',endpoint);
    }catch(error){connection.textContent=error.message.toUpperCase();connection.className='connection error';}
  }
  form.addEventListener('submit',event=>{event.preventDefault();clearInterval(timer);refresh();timer=setInterval(refresh,5000);});
  rulesetFilter.addEventListener('change',()=>{if(connected)refresh();});
})();
