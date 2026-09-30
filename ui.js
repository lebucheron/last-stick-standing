(() => {
  const root=document.getElementById('stick-tetris');
  const cards=[...root.querySelectorAll('.runner')];
  const choice=root.querySelector('#selected-runner');
  const button=root.querySelector('#place-bet');
  const state=root.querySelector('#bet-state');
  const ticketsEl=root.querySelector('#local-tickets');
  const status=root.querySelector('#st-status');
  const balanceEl=root.querySelector('#demo-balance');
  const recordEl=root.querySelector('#wallet-record'),economyProfitEl=root.querySelector('#economy-profit'),economyWageredEl=root.querySelector('#economy-wagered'),economyLastEl=root.querySelector('#economy-last'),economyNoteEl=root.querySelector('#economy-note');
  const playersEl=root.querySelector('#player-count'),poolEl=root.querySelector('#pool-total'),jackpotEl=root.querySelector('#jackpot-total'),marketEl=root.querySelector('#market-status'),potentialEl=root.querySelector('#potential-payout');
  const settlement=root.querySelector('#settlement'),winnerSwatch=root.querySelector('#winner-swatch'),winnerLabel=root.querySelector('#winner-label'),finalPool=root.querySelector('#final-pool'),finalStake=root.querySelector('#final-stake'),finalPayout=root.querySelector('#final-payout'),finalProfit=root.querySelector('#final-profit');
  const STAKE=500,FEE=.12,JACKPOT_SHARE=.15,MAX_JACKPOT=15000,MAX_LOCAL_BETS=2,RUNNERS=['A','B','C','D','E','F'],OPPONENTS=5,STORAGE_KEY='last-stick-economy-v2';
  const blankEconomy=()=>({balance:12500,jackpot:0,rounds:0,wins:0,losses:0,wagered:0,paid:0,pending:0,history:[]});
  function loadEconomy(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!saved||typeof saved!=='object')return blankEconomy();
      const clean={...blankEconomy(),...saved};
      for(const key of ['balance','jackpot','rounds','wins','losses','wagered','paid','pending'])clean[key]=Math.max(0,Number(clean[key])||0);
      clean.history=Array.isArray(clean.history)?clean.history.slice(0,8):[];
      // A refresh cannot reproduce the interrupted race, so its locked stake is returned.
      if(clean.pending){clean.balance+=clean.pending;clean.pending=0;}
      return clean;
    }catch{return blankEconomy();}
  }
  let economy=loadEconomy(),selected='A',locked=false,finished=false,betPlaced=false,settled=false,balance=economy.balance,jackpot=economy.jackpot,playerBets=[],opponentBets=[],lobbyTimers=[],raceStartedAt=0,roundId='',networkCounts=null;
  root.dataset.selectedRunner=selected;

  function report(type,data={}){
    window.dispatchEvent(new CustomEvent('laststick:event',{detail:{type,...data}}));
  }

  const credits=value=>Math.floor(value).toLocaleString('fr-FR')+' CR';
  function saveEconomy(){
    economy.balance=balance;economy.jackpot=jackpot;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(economy));}catch{}
  }
  function showEconomy(){
    balanceEl.textContent=credits(balance);recordEl.textContent=economy.wins+' V · '+economy.losses+' D';
    const profit=economy.paid-economy.wagered;
    economyProfitEl.textContent=(profit>0?'+':'')+credits(profit);economyProfitEl.classList.toggle('positive',profit>0);economyProfitEl.classList.toggle('negative',profit<0);
    economyWageredEl.textContent=credits(economy.wagered);
    const last=economy.history[0];economyLastEl.textContent=last?(last.profit>0?'+':'')+credits(last.profit)+' · '+last.choice:'Aucune';
    economyLastEl.classList.toggle('positive',!!last&&last.profit>0);economyLastEl.classList.toggle('negative',!!last&&last.profit<0);
    economyNoteEl.textContent='Crédits fictifs enregistrés sur cet appareil · '+economy.rounds+' manche'+(economy.rounds>1?'s':'')+' réglée'+(economy.rounds>1?'s':'')+' · retour théorique ≈ 81–85 %';
  }
  function showBalance(){showEconomy();}
  function randomRunner(){const data=new Uint32Array(1);crypto.getRandomValues(data);return RUNNERS[data[0]%RUNNERS.length];}
  function startLobby(){
    lobbyTimers.forEach(clearTimeout);lobbyTimers=[];opponentBets=[];root.dataset.lobbyCount='0';updateMarket();
    if(root.dataset.networked==='1'){if(!networkCounts)try{networkCounts=JSON.parse(root.dataset.liveMarket||'null');}catch{}applyNetworkMarket();return;}
    for(let index=0;index<OPPONENTS;index++)lobbyTimers.push(setTimeout(()=>{
      let runner=randomRunner();
      if(index===OPPONENTS-1){const used=new Set([...opponentBets,...playerBets].map(b=>b.runner));if(used.size===1&&used.has(runner))runner=RUNNERS[(RUNNERS.indexOf(runner)+1)%RUNNERS.length];}
      opponentBets.push({runner,stake:STAKE});root.dataset.lobbyCount=String(opponentBets.length);updateMarket();
    },350+index*450));
  }
  function applyNetworkMarket(){
    if(!networkCounts)return;opponentBets=[];
    for(const runner of RUNNERS)for(let i=0;i<Number(networkCounts[runner]||0);i++)opponentBets.push({runner,stake:STAKE});
    for(const local of playerBets){const index=opponentBets.findIndex(b=>b.runner===local.runner);if(index>=0)opponentBets.splice(index,1);}
    root.dataset.lobbyCount=root.dataset.livePlayers||'1';updateMarket();
  }
  window.addEventListener('laststick:market',event=>{lobbyTimers.forEach(clearTimeout);lobbyTimers=[];networkCounts=event.detail?.counts||null;applyNetworkMarket();});
  function bets(includePreview=false){const all=opponentBets.concat(playerBets);if(includePreview)all.push({runner:selected,stake:STAKE,user:true,preview:true});return all;}
  function poolByRunner(includePreview=false){const totals=Object.fromEntries(RUNNERS.map(id=>[id,0]));for(const bet of bets(includePreview))totals[bet.runner]+=bet.stake;return totals;}
  function marketValid(all){return all.length>=2&&new Set(all.map(b=>b.runner)).size>=2;}
  function updateMarket(){
    const canPreview=!locked&&playerBets.length<MAX_LOCAL_BETS&&balance>=STAKE,all=bets(false),preview=bets(canPreview),totals=poolByRunner(false),previewTotals=poolByRunner(canPreview);
    const pot=all.reduce((sum,b)=>sum+b.stake,0),previewPot=preview.reduce((sum,b)=>sum+b.stake,0),valid=marketValid(all);
    playersEl.textContent=all.length;poolEl.textContent=credits(pot);jackpotEl.textContent=credits(jackpot);
    marketEl.textContent=valid?'POT ACTIF':'EN ATTENTE';marketEl.classList.toggle('pending',!valid);
    cards.forEach(card=>{let amount=card.querySelector('em');if(!amount){amount=document.createElement('em');card.append(amount);}amount.textContent=credits(totals[card.dataset.runner]);});
    const winningStake=previewTotals[selected],winningUserStake=preview.filter(b=>b.user&&b.runner===selected).reduce((sum,b)=>sum+b.stake,0),basePool=Math.floor(previewPot*(1-FEE));
    potentialEl.textContent=marketValid(preview)&&winningStake&&winningUserStake?credits(basePool*winningUserStake/winningStake+jackpot):'En attente';
  }

  function select(id){
    if(locked)return;
    selected=id;
    root.dataset.selectedRunner=id;
    cards.forEach(card=>card.classList.toggle('selected',card.dataset.runner===id));
    choice.textContent='Stickman '+id;
    button.textContent=(playerBets.length?'Ajouter le ticket ':'Miser sur ')+id;
    updateMarket();
  }

  cards.forEach(card=>card.addEventListener('click',()=>select(card.dataset.runner)));
  function renderTickets(){
    root.dataset.selectedRunners=playerBets.map(b=>b.runner).join('');
    ticketsEl.innerHTML=playerBets.length?playerBets.map((bet,index)=>`<b style="--ticket-color:var(--viz-series-${RUNNERS.indexOf(bet.runner)+1})"><i></i>Joueur ${index+1} · ${bet.runner}</b>`).join(''):'<span>2 tickets locaux maximum · invite un ami</span>';
  }
  function lockChoice(manual){
    if(manual){
      if(locked||playerBets.length>=MAX_LOCAL_BETS)return;
      if(balance<STAKE){state.textContent='Solde insuffisant';return;}
      playerBets.push({runner:selected,stake:STAKE,user:true});betPlaced=true;balance-=STAKE;economy.pending+=STAKE;saveEconomy();showBalance();report('bet_placed',{choice:selected,stake:STAKE,ticket:playerBets.length});renderTickets();
      if(playerBets.length<MAX_LOCAL_BETS&&balance>=STAKE){state.textContent='Ticket '+playerBets.length+' enregistré · encore une place';button.textContent='Ajouter le ticket '+selected;updateMarket();return;}
    }
    if(locked)return;
    locked=true;betPlaced=playerBets.length>0;
    cards.forEach(card=>card.disabled=true);
    button.disabled=true;
    button.textContent=betPlaced?playerBets.length+' ticket'+(playerBets.length>1?'s':'')+' enregistré'+(playerBets.length>1?'s':''):'Mises fermées';
    state.textContent=betPlaced?'Pronostics verrouillés':'Aucune mise placée';
    updateMarket();
  }

  function reopenChoice(){
    locked=false;
    cards.forEach(card=>card.disabled=false);
    button.disabled=balance<STAKE;
    button.textContent='Miser sur '+selected;
    state.textContent=balance>=STAKE?'Sélection ouverte':'Portefeuille épuisé';
    betPlaced=false;playerBets=[];renderTickets();root.dataset.selectedRunner=selected;settled=false;settlement.hidden=true;startLobby();
  }

  function showSettlement(winner,pot,payout){
    const localStake=playerBets.length*STAKE,card=cards.find(item=>item.dataset.runner===winner),profit=payout-localStake;
    settlement.hidden=false;settlement.style.setProperty('--winner-color',card.style.getPropertyValue('--runner'));
    winnerSwatch.textContent=winner;winnerLabel.textContent='Stickman '+winner+' gagne';
    finalPool.textContent=credits(pot);finalStake.textContent=credits(localStake);finalPayout.textContent=credits(payout);
    finalProfit.textContent=(profit>0?'+':'')+credits(profit);finalProfit.classList.toggle('positive',profit>0);finalProfit.classList.toggle('negative',profit<0);
  }

  button.addEventListener('click',()=>lockChoice(true));

  new MutationObserver(()=>{
    const text=status.textContent;
    if(text.startsWith('Salle d’attente')){if(finished){reopenChoice();finished=false;}return;}
    if(text.startsWith('Choisis')){if(finished){reopenChoice();finished=false;}return;}
    if(text.startsWith('Dernier debout')){
      lockChoice(false);
      if(!raceStartedAt){raceStartedAt=Date.now();roundId=root.dataset.roundId||crypto.randomUUID?.()||String(raceStartedAt);report('race_started',{round_id:roundId,seed:Number(root.dataset.roundSeed)||null,choice:playerBets[0]?.runner||null,choices:playerBets.map(b=>b.runner),bet_placed:betPlaced});}
    }
    const winner=text.match(/^([A-F]) gagne/);
    if(!winner)return;
    finished=true;
    if(settled)return;
    const all=bets(false),pot=all.reduce((sum,b)=>sum+b.stake,0),valid=marketValid(all),totals=poolByRunner(false),basePool=Math.floor(pot*(1-FEE)),localStake=playerBets.length*STAKE,userWinningStake=playerBets.filter(b=>b.runner===winner[1]).reduce((sum,b)=>sum+b.stake,0);
    let payout=0;
    if(!valid){if(betPlaced){balance+=localStake;economy.pending=0;saveEconomy();showBalance();payout=localStake;}state.textContent='Manche annulée · mises rendues';}
    else if(!totals[winner[1]]){const added=Math.max(0,Math.min(MAX_JACKPOT-jackpot,Math.floor(basePool*JACKPOT_SHARE)));jackpot+=added;state.textContent=added?'Aucun pari gagnant · +'+credits(added)+' au jackpot':'Aucun pari gagnant · jackpot conservé';}
    else{
      if(userWinningStake){payout=Math.floor(basePool*userWinningStake/totals[winner[1]])+jackpot;balance+=payout;jackpot=0;state.textContent='Ticket gagnant · +'+credits(payout);}
      else if(betPlaced)state.textContent='Perdu · victoire du '+winner[1]+(jackpot?' · jackpot conservé':'');
      else state.textContent='Victoire du stickman '+winner[1];
    }
    if(valid&&betPlaced){
      const profit=payout-localStake;economy.rounds++;economy.wagered+=localStake;economy.paid+=payout;economy.pending=0;
      if(profit>0)economy.wins++;else economy.losses++;
      economy.history.unshift({winner:winner[1],choice:playerBets.map(b=>b.runner).join('+'),payout,profit,at:Date.now()});economy.history=economy.history.slice(0,8);
    }
    saveEconomy();showEconomy();
    showSettlement(winner[1],pot,payout);
    updateMarket();potentialEl.textContent='Manche terminée';marketEl.textContent='RÈGLEMENT';marketEl.classList.remove('pending');
    settled=true;root.dataset.completedRounds=String(Number(root.dataset.completedRounds||0)+1);
    let starts={},deaths=[];
    try{starts=JSON.parse(root.dataset.roundStarts||'{}');}catch{}
    try{deaths=JSON.parse(root.dataset.roundDeaths||'[]');}catch{}
    report('race_finished',{round_id:roundId,seed:Number(root.dataset.roundSeed)||null,winner:winner[1],winner_start:starts[winner[1]],deaths,choice:playerBets[0]?.runner||null,choices:playerBets.map(b=>b.runner),bet_placed:betPlaced,won:userWinningStake>0,duration_ms:raceStartedAt?Date.now()-raceStartedAt:null,sudden_death:text.includes('combat final')});
    raceStartedAt=0;roundId='';
  }).observe(status,{childList:true,characterData:true,subtree:true});

  saveEconomy();showEconomy();renderTickets();
  if(balance<STAKE){button.disabled=true;state.textContent='Portefeuille épuisé';}
  startLobby();
})();
