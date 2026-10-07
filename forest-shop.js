/* Legacy Forest message bridge. No wallet credentials or signing secrets in this file. */
(() => {
  const root=document.querySelector('#stick-tetris'),endpoint=window.LAST_STICK_TELEMETRY_ENDPOINT,PROJECT='89e95544-cafc-446f-8513-772e6e856505';
  if(!endpoint||!root)return;
  let context=null,token=null,loginPromise=null,sessionExpires=0;
  const recovering=new Set();
  const pending=new Map(),origins=new Set(['https://apps.forest.inc','https://forest.inc']);
  const status=document.createElement('p'),connect=document.createElement('button');status.className='forest-shop-state';status.setAttribute('role','status');connect.type='button';connect.textContent='Connecter Forest pour les achats';connect.className='forest-shop-connect';
  document.querySelector('.cosmetics nav').before(status,connect);
  const funds=document.createElement('form'),amount=document.createElement('input'),deposit=document.createElement('button');
  funds.className='forest-shop-funds';amount.type='text';amount.inputMode='decimal';amount.placeholder='Montant en $STICK';amount.setAttribute('aria-label','Montant à déposer en STICK');deposit.type='submit';deposit.textContent='Déposer des $STICK';funds.append(amount,deposit);connect.after(funds);
  funds.onsubmit=async event=>{event.preventDefault();const value=amount.value.trim().replace(',','.');try{if(amountUnits(value)<=0n)throw Error('Saisis un montant supérieur à zéro.');deposit.disabled=true;await authenticate();status.textContent='Confirme le dépôt dans Forest et ton portefeuille…';await rpc('forest.game.deposit',{amount:value});await refresh();amount.value='';}catch(e){status.textContent=e.message;}finally{deposit.disabled=false;}};
  async function api(path,input){const r=await fetch(endpoint+'/api/shop/'+path,{method:input?'POST':'GET',headers:{...(input?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},...(input?{body:JSON.stringify(input)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Connexion indisponible');return data;}
  function rpc(method,params={}){return new Promise((resolve,reject)=>{if(!context||context.projectId!==PROJECT){reject(Error('Ouvre le jeu dans Forest pour acheter'));return;}const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('Forest ne répond pas. Réessaie la connexion.'));},60000);pending.set(id,{resolve,reject,timer});window.parent.postMessage({type:'FOREST_RPC_REQUEST',version:1,id,method,params},'*');});}
  window.addEventListener('message',event=>{if(event.source!==window.parent||!origins.has(event.origin))return;const data=event.data||{};if(data.type==='FOREST_PROJECT_CONTEXT'){context=data;status.textContent=data.projectId===PROJECT?'Achats via le solde de jeu Forest en $STICK':'Projet Forest incompatible';connect.disabled=data.projectId!==PROJECT;return;}if(data.type==='FOREST_WALLET_DISCONNECTED'){token=null;loginPromise=null;status.textContent='Compte Forest déconnecté';return;}if(data.type!=='FOREST_RPC_RESPONSE')return;const call=pending.get(data.id);if(!call||!['success','error'].includes(data.status))return;clearTimeout(call.timer);pending.delete(data.id);data.status==='success'?call.resolve(data.result):call.reject(Error(data.error?.message||'Action annulée'));});
  async function authenticate(){if(token&&sessionExpires>Date.now()+10000)return sync();if(loginPromise)return loginPromise;loginPromise=(async()=>{const n=await api('nonce',{}),identity=await rpc('forest.identity.code',{nonce:n.nonce}),session=await api('login',{nonce:n.nonce,code:identity.code});token=session.token;sessionExpires=session.expiresAt;window.dispatchEvent(new CustomEvent('laststick:forest-auth',{detail:{token}}));return sync();})();try{return await loginPromise;}catch(e){token=null;throw e;}finally{loginPromise=null;}}
  async function sync(){const inventory=await api('inventory');window.dispatchEvent(new CustomEvent('laststick:forest-inventory',{detail:inventory}));return inventory;}
  async function refresh(){await authenticate();const balance=await rpc('forest.game.balance');status.textContent='Solde de jeu : '+balance.balance+' $STICK';connect.textContent='Actualiser mon solde et mon vestiaire';}
  connect.onclick=async()=>{connect.disabled=true;status.textContent='Connexion au compte Forest…';try{await refresh();}catch(e){status.textContent=e.message;}finally{connect.disabled=false;}};
  window.addEventListener('laststick:forest-round-finished',()=>{if(token)sync().catch(()=>{});});
  LastStickCosmetics.connectPurchases({
    async quote({itemId}){await authenticate();return api('quote',{itemId});},
    async purchase(quote){
      if(quote.recover||recovering.has(quote.actionId)){const receipt=await api('purchase',{actionId:quote.actionId});recovering.delete(quote.actionId);await sync();return receipt;}
      if(quote.expiresAt<=Date.now())throw Error('Devis expiré');
      const item=LastStickCosmeticsCore.find(quote.itemId);
      const approved=await confirmPurchase(item.name,quote.amount,quote.targetEurCents);
      if(!approved)throw Error('Achat annulé');
      const balance=await rpc('forest.game.balance');
      if(amountUnits(balance.balance)<BigInt(quote.units))throw Error('Solde de jeu Forest insuffisant. Dépose des $STICK dans Forest, puis réessaie.');
      await rpc('forest.game.action.authorize',{actionId:quote.actionId,debitLimitAmount:quote.amount});
      recovering.add(quote.actionId);
      // A network error is recoverable with this same action, never a second debit.
      const receipt=await api('purchase',{actionId:quote.actionId});recovering.delete(quote.actionId);await sync();window.dispatchEvent(new CustomEvent('laststick:forest-auth',{detail:{token}}));await refresh();return receipt;
    },
    async verifyOwnership({receipt}){return api('verify',{actionId:receipt.actionId});}
  });
  function amountUnits(value){const m=String(value).match(/^(\d+)(?:\.(\d{1,18}))?$/);if(!m)throw Error('Solde Forest indisponible');return BigInt(m[1])*10n**18n+BigInt((m[2]||'').padEnd(18,'0'));}
  function confirmPurchase(name,amount,cents){return new Promise(resolve=>{const dialog=document.createElement('dialog'),title=document.createElement('h3'),text=document.createElement('p'),yes=document.createElement('button'),no=document.createElement('button');title.textContent='Acheter '+name+' ?';text.textContent=amount+' $STICK · prix cible '+(cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})+'. Débit sur ton solde de jeu Forest, sans récompense monétaire.';yes.textContent='Confirmer l’achat';no.textContent='Annuler';yes.type=no.type='button';dialog.className='forest-purchase-dialog';dialog.append(title,text,no,yes);document.body.append(dialog);const end=value=>{dialog.close();dialog.remove();resolve(value);};yes.onclick=()=>end(true);no.onclick=()=>end(false);dialog.oncancel=e=>{e.preventDefault();end(false);};dialog.showModal();no.focus();});}
  status.textContent=window.parent===window?'Ouvre le jeu dans Forest pour acheter en $STICK.':'Connexion Forest en attente…';
  if(window.parent!==window)window.parent.postMessage({type:'FOREST_REQUEST_WALLET'},'*');
})();
