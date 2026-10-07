(() => {
  const C=LastStickCosmeticsCore,R=LastStickCosmeticsRender,root=document.querySelector('#stick-tetris'),key='last-stick-cosmetics-v1';
  let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  let profile=C.clean(saved),category='skins',active=null,busy=false,provider=null,shared={},previewArena=null;
  const panel=document.createElement('section');panel.className='cosmetics';panel.setAttribute('aria-label','Cosmétiques');
  panel.innerHTML='<h2>Ton vestiaire</h2><p>Skins et effets partagés dans la salle · arène personnelle · aucun bonus de jeu.</p><p id="cosmetic-progress"></p><p>Le jeu reste accessible sans mise. Pour la progression cosmétique, une course avec un ticket compte comme une partie ; un ticket sur le gagnant compte comme une victoire.</p><nav aria-label="Catégories cosmétiques"></nav><div class="cosmetics-grid"></div><p role="status" aria-live="polite" id="cosmetic-notice">Achats $STICK bientôt disponibles. Prix cibles en euros ; conversion au cours du coin lors de l’achat.</p>';
  root.insertBefore(panel,document.querySelector('#st-result'));
  const grid=panel.querySelector('.cosmetics-grid'),notice=panel.querySelector('#cosmetic-notice');
  const previewBar=document.createElement('div');previewBar.className='arena-preview-bar';previewBar.hidden=true;
  const previewLabel=document.createElement('span'),closePreview=document.createElement('button');closePreview.type='button';closePreview.textContent='Fermer l’aperçu';previewBar.append(previewLabel,closePreview);document.querySelector('.arena-card').prepend(previewBar);
  closePreview.onclick=()=>{previewArena=null;previewBar.hidden=true;};
  function save(){try{localStorage.setItem(key,JSON.stringify(profile));}catch{notice.textContent='Sauvegarde indisponible sur cet appareil.';}}
  function publish(){for(const runner of new Set(root.dataset.selectedRunners||''))window.dispatchEvent(new CustomEvent('laststick:cosmetic-selection',{detail:{runner,...C.publicLoadout(profile)}}));}
  for(const [id,label] of [['skins','Skins'],['deaths','Effets de mort'],['arenas','Arènes']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.category=id;b.onclick=()=>{category=id;render();};panel.querySelector('nav').append(b);}
  function render(){
    panel.querySelector('#cosmetic-progress').textContent=profile.games+' parties · '+profile.wins+' victoires · Rares : 15 parties · Épiques : 25 + 3 victoires · Légendaires : 50 + 7 victoires';
    panel.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
    grid.replaceChildren();
    if(category==='skins'){const reset=document.createElement('button');reset.type='button';reset.style.gridColumn='1 / -1';reset.textContent='Apparence classique';reset.disabled=profile.equipped.skins===null;reset.onclick=()=>{profile.equipped.skins=null;save();publish();render();};grid.append(reset);}
    for(const item of C.items.filter(i=>i.category===category&&!(category==='skins'&&i.rarity==='free'))){
      const s=C.state(item,profile),r=C.rarities[item.rarity],card=document.createElement('article');card.className='cosmetic-item';card.dataset.rarity=item.rarity;
      const canvas=document.createElement('canvas');canvas.width=120;canvas.height=item.category==='arenas'?130:65;canvas.setAttribute('aria-label','Aperçu : '+item.name);R.preview(canvas.getContext('2d'),item);
      const title=document.createElement('strong');title.textContent=item.name;
      const info=document.createElement('small');info.textContent=r.label+' · '+(r.cents?(r.cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})+' cible':'Gratuit');
      const description=document.createElement('small');description.textContent=item.description;
      const requirement=document.createElement('small');requirement.textContent=s==='locked'?Math.min(profile.games,r.games)+'/'+r.games+' parties · '+Math.min(profile.wins,r.wins)+'/'+r.wins+' victoires':{equipped:'Équipé',owned:'Acheté / possédé',unlocked:'Débloqué · non acheté'}[s];
      const button=document.createElement('button');button.type='button';button.textContent={locked:'Verrouillé',equipped:'Équipé',owned:'Équiper',unlocked:provider?'Acheter en $STICK':'Achat bientôt disponible'}[s];button.disabled=busy||s==='locked'||s==='equipped'||(s==='unlocked'&&!provider);
      button.onclick=async()=>{if(s==='owned'){profile.equipped[category]=item.id;save();publish();render();return;}if(s!=='unlocked'||!provider)return;busy=true;render();try{
        // Provider contract: server quote -> wallet confirmation -> server ownership verification.
        const quote=await provider.quote({itemId:item.id,targetEurCents:r.cents});
        if(quote.itemId!==item.id||quote.targetEurCents!==r.cents||quote.currency!=='STICK'||!/^\d+$/.test(String(quote.units))||BigInt(quote.units)<=0n||!Number.isSafeInteger(quote.expiresAt)||quote.expiresAt<=Date.now())throw Error('Devis invalide ou expiré');
        const receipt=await provider.purchase(quote);const ownership=await provider.verifyOwnership({itemId:item.id,receipt});
        if(ownership?.itemId!==item.id||ownership.owned!==true)throw Error('Achat non confirmé');
        profile.owned.push(item.id);save();notice.textContent=item.name+' acheté. Tu peux l’équiper.';
      }catch(error){notice.textContent=error.message||'Achat annulé';}finally{busy=false;render();}};
      card.append(canvas,title,info,description,requirement,button);
      if(item.category==='arenas'){const preview=document.createElement('button');preview.type='button';preview.className='arena-preview-button';preview.textContent='Voir dans l’arène';preview.onclick=()=>{previewArena=item.id;previewLabel.textContent='Aperçu : '+item.name+' · non équipé';previewBar.hidden=false;document.querySelector('.arena-card').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});closePreview.focus({preventScroll:true});};card.append(preview);}
      grid.append(card);
    }
  }
  window.addEventListener('laststick:event',event=>{const d=event.detail||{};if(d.type==='bet_placed'){window.dispatchEvent(new CustomEvent('laststick:cosmetic-selection',{detail:{runner:d.choice,...C.publicLoadout(profile)}}));}if(d.type==='race_started'){root.dataset.cosmeticRaceActive='1';active=d.bet_placed?{runner:d.choices?.[0]||d.choice,id:d.round_id}:null;render();}if(d.type==='race_finished'){root.dataset.cosmeticRaceActive='0';if(active?.id===d.round_id&&C.complete(profile,d.round_id,d.bet_placed===true&&(d.choices||[d.choice]).includes(d.winner)))save();active=null;render();}});
  window.addEventListener('laststick:round',()=>{root.dataset.cosmeticRaceActive='0';active=null;shared={};render();});
  window.addEventListener('laststick:cosmetics',e=>{if(e.detail?.roundId===root.dataset.roundId)shared=e.detail?.loadouts||{};});
  globalThis.LastStickCosmetics={
    loadout(id){const runner=String.fromCharCode(65+id);if(root.dataset.networked==='1')return shared[runner]||{skin:null,death:'pouf'};return (root.dataset.selectedRunners||'').includes(runner)?C.publicLoadout(profile):{skin:null,death:'pouf'};},
    arena:()=>previewArena||profile.equipped.arenas,
    connectPurchases(adapter){if(!adapter||!['quote','purchase','verifyOwnership'].every(k=>typeof adapter[k]==='function'))throw Error('Adaptateur incomplet');provider=adapter;render();},
    publicLoadout:()=>C.publicLoadout(profile)
  };
  render();
})();
