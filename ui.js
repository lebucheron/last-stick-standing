(() => {
  const root=document.getElementById('stick-tetris');
  const cards=[...root.querySelectorAll('.runner')];
  const choice=root.querySelector('#selected-runner');
  const button=root.querySelector('#place-bet');
  const state=root.querySelector('#bet-state');
  const status=root.querySelector('#st-status');
  const balanceEl=root.querySelector('#demo-balance');
  const playersEl=root.querySelector('#player-count'),poolEl=root.querySelector('#pool-total'),jackpotEl=root.querySelector('#jackpot-total'),marketEl=root.querySelector('#market-status'),potentialEl=root.querySelector('#potential-payout');
  const settlement=root.querySelector('#settlement'),winnerSwatch=root.querySelector('#winner-swatch'),winnerLabel=root.querySelector('#winner-label'),finalPool=root.querySelector('#final-pool'),finalStake=root.querySelector('#final-stake'),finalPayout=root.querySelector('#final-payout'),finalProfit=root.querySelector('#final-profit');
  const STAKE=500,FEE=.05,RUNNERS=['A','B','C','D','E','F'],OPPONENTS=5;
  let selected='A',locked=false,finished=false,betPlaced=false,settled=false,balance=12500,jackpot=0,opponentBets=[],lobbyTimers=[];
  root.dataset.selectedRunner=selected;

  const credits=value=>Math.floor(value).toLocaleString('fr-FR')+' CR';
  function showBalance(){balanceEl.textContent=credits(balance);}
  function randomRunner(){const data=new Uint32Array(1);crypto.getRandomValues(data);return RUNNERS[data[0]%RUNNERS.length];}
  function startLobby(){
    lobbyTimers.forEach(clearTimeout);lobbyTimers=[];opponentBets=[];root.dataset.lobbyCount='0';updateMarket();
    for(let index=0;index<OPPONENTS;index++)lobbyTimers.push(setTimeout(()=>{
      let runner=randomRunner();
      if(index===OPPONENTS-1){const used=new Set(opponentBets.map(b=>b.runner));if(betPlaced)used.add(selected);if(used.size===1&&used.has(runner))runner=RUNNERS[(RUNNERS.indexOf(runner)+1)%RUNNERS.length];}
      opponentBets.push({runner,stake:STAKE});root.dataset.lobbyCount=String(opponentBets.length);updateMarket();
    },350+index*450));
  }
  function bets(includePreview=false){const all=opponentBets.slice();if(betPlaced||includePreview)all.push({runner:selected,stake:STAKE,user:true});return all;}
  function poolByRunner(includePreview=false){const totals=Object.fromEntries(RUNNERS.map(id=>[id,0]));for(const bet of bets(includePreview))totals[bet.runner]+=bet.stake;return totals;}
  function marketValid(all){return all.length>=2&&new Set(all.map(b=>b.runner)).size>=2;}
  function updateMarket(){
    const all=bets(false),preview=bets(!betPlaced&&!locked),totals=poolByRunner(false),previewTotals=poolByRunner(!betPlaced&&!locked);
    const pot=all.reduce((sum,b)=>sum+b.stake,0),previewPot=preview.reduce((sum,b)=>sum+b.stake,0),valid=marketValid(all);
    playersEl.textContent=all.length;poolEl.textContent=credits(pot);jackpotEl.textContent=credits(jackpot);
    marketEl.textContent=valid?'POT ACTIF':'EN ATTENTE';marketEl.classList.toggle('pending',!valid);
    cards.forEach(card=>{let amount=card.querySelector('em');if(!amount){amount=document.createElement('em');card.append(amount);}amount.textContent=credits(totals[card.dataset.runner]);});
    const winningStake=previewTotals[selected],distributable=Math.floor(previewPot*(1-FEE))+jackpot;
    potentialEl.textContent=marketValid(preview)&&winningStake?credits(distributable*STAKE/winningStake):'En attente';
  }

  function select(id){
    if(locked)return;
    selected=id;
    root.dataset.selectedRunner=id;
    cards.forEach(card=>card.classList.toggle('selected',card.dataset.runner===id));
    choice.textContent='Stickman '+id;
    button.textContent='Miser sur '+id;
    updateMarket();
  }

  cards.forEach(card=>card.addEventListener('click',()=>select(card.dataset.runner)));
  function lockChoice(manual){
    if(locked)return;
    if(manual&&balance<STAKE){state.textContent='Solde insuffisant';return;}
    locked=true;
    if(manual){betPlaced=true;balance-=STAKE;showBalance();}
    cards.forEach(card=>card.disabled=true);
    button.disabled=true;
    button.textContent=manual?'Mise enregistrée · '+selected:'Mises fermées';
    state.textContent=manual?'Pronostic verrouillé':'Aucune mise placée';
    updateMarket();
  }

  function reopenChoice(){
    locked=false;
    cards.forEach(card=>card.disabled=false);
    button.disabled=false;
    button.textContent='Miser sur '+selected;
    state.textContent='Sélection ouverte';
    betPlaced=false;settled=false;settlement.hidden=true;startLobby();
  }

  function showSettlement(winner,pot,payout){
    const card=cards.find(item=>item.dataset.runner===winner),profit=payout-(betPlaced?STAKE:0);
    settlement.hidden=false;settlement.style.setProperty('--winner-color',card.style.getPropertyValue('--runner'));
    winnerSwatch.textContent=winner;winnerLabel.textContent='Stickman '+winner+' gagne';
    finalPool.textContent=credits(pot);finalStake.textContent=credits(betPlaced?STAKE:0);finalPayout.textContent=credits(payout);
    finalProfit.textContent=(profit>0?'+':'')+credits(profit);finalProfit.classList.toggle('positive',profit>0);finalProfit.classList.toggle('negative',profit<0);
  }

  button.addEventListener('click',()=>lockChoice(true));

  new MutationObserver(()=>{
    const text=status.textContent;
    if(text.startsWith('Salle d’attente')){if(finished){reopenChoice();finished=false;}return;}
    if(text.startsWith('Choisis ton stickman')){if(finished){reopenChoice();finished=false;}return;}
    if(text.startsWith('Dernier debout'))lockChoice(false);
    const winner=text.match(/^([A-F]) gagne/);
    if(!winner)return;
    finished=true;
    if(settled)return;
    const all=bets(false),pot=all.reduce((sum,b)=>sum+b.stake,0),valid=marketValid(all),totals=poolByRunner(false),distributable=Math.floor(pot*(1-FEE))+jackpot;
    let payout=0;
    if(!valid){if(betPlaced){balance+=STAKE;showBalance();payout=STAKE;}state.textContent='Manche annulée · mise rendue';}
    else if(!totals[winner[1]]){jackpot=distributable;state.textContent='Aucun pari gagnant · jackpot '+credits(jackpot);}
    else{
      if(betPlaced&&winner[1]===selected){payout=Math.floor(distributable*STAKE/totals[winner[1]]);balance+=payout;showBalance();state.textContent='Gagné · +'+credits(payout);}
      else if(betPlaced)state.textContent='Perdu · victoire du '+winner[1];
      else state.textContent='Victoire du stickman '+winner[1];
      jackpot=0;
    }
    showSettlement(winner[1],pot,payout);
    updateMarket();potentialEl.textContent='Manche terminée';marketEl.textContent='RÈGLEMENT';marketEl.classList.remove('pending');
    settled=true;root.dataset.completedRounds=String(Number(root.dataset.completedRounds||0)+1);
  }).observe(status,{childList:true,characterData:true,subtree:true});

  showBalance();startLobby();
})();
