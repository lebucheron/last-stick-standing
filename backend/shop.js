import '../cosmetics-core.js';
const C=globalThis.LastStickCosmeticsCore;
export const TOKEN_ID='f7512ad0-3941-4bc5-aeea-577d20bb13d9';
export const PROJECT_ID='89e95544-cafc-446f-8513-772e6e856505';
const API='https://forest.inc/api';
const headers={'content-type':'application/json','access-control-allow-origin':'https://lebucheron.github.io','cache-control':'no-store'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function decimal(value,places=18){
  const m=String(value).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);if(!m)throw Error('Montant invalide');
  const power=places+Number(m[3]||0)-(m[2]||'').length;if(Math.abs(power)>100)throw Error('Montant invalide');
  const n=BigInt(m[1]+(m[2]||''));return power>=0?n*10n**BigInt(power):n/10n**BigInt(-power);
}
export function display(units){const n=BigInt(units),s=n.toString().padStart(19,'0');return (s.slice(0,-18)+'.'+s.slice(-18)).replace(/\.?0+$/,'');}
export function priceUnits(cents,usdPerToken,usdPerEur){const price=decimal(usdPerToken),eur=decimal(usdPerEur);if(price<=0n||eur<=0n)throw Error('Cours indisponible');const numerator=BigInt(cents)*eur*10n**18n,denominator=100n*price;return ((numerator+denominator-1n)/denominator).toString();}
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function signed(env,path,body,fetcher=fetch){
  if(!env.SETTLEMENT_SECRET)throw Error('Connexion Forest non configurée');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SETTLEMENT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body));
  const hex=[...new Uint8Array(signature)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const r=await fetcher(API+'/playables/'+PROJECT_ID+'/html/'+path,{method:'POST',headers:{'content-type':'application/json','X-Forest-Settlement-Signature':'v1='+hex},body,signal:AbortSignal.timeout(15000)});
  let data;try{data=await r.json();}catch{throw Error('Réponse Forest indisponible');}
  if(!r.ok)throw Error('Forest : '+(typeof data.message==='string'?data.message:'règlement refusé ('+r.status+')'));
  return data;
}
async function market(fetcher=fetch){
  const [token,fx]=await Promise.all([fetcher(API+'/tokens/'+TOKEN_ID+'/stats?currency=usd',{signal:AbortSignal.timeout(10000)}),fetcher('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',{signal:AbortSignal.timeout(10000)})]);
  if(!token.ok||!fx.ok)throw Error('Cours indisponible');
  const t=await token.json(),xml=await fx.text(),usd=xml.match(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/)?.[1],date=xml.match(/time=['"]([\d-]+)['"]/)?.[1];
  if(!usd||!date||Date.now()-Date.parse(date)>7*86400000)throw Error('Cours euro indisponible');
  return {usdPerToken:t.price,usdPerEur:usd};
}
export async function shopSession(storage,token){if(typeof token!=='string'||token.length>150)return null;const s=await storage.get('shop-session:'+await hash(token));return s&&s.expiresAt>Date.now()?s:null;}
export async function shopRequest(request,room,{fetcher=fetch}={}){
  const store=room.state.storage,env=room.env,url=new URL(request.url),route=url.pathname.slice('/api/shop/'.length);
  try{
    if(route==='status')return response({configured:!!env.SETTLEMENT_SECRET,projectId:PROJECT_ID,tokenId:TOKEN_ID});
    if(!env.SETTLEMENT_SECRET)return response({error:'Connexion Forest non configurée'},503);
    let input={};if(request.method==='POST'){const text=await request.text();if(text.length>2048)return response({error:'Requête trop longue'},413);try{input=JSON.parse(text);}catch{return response({error:'Requête invalide'},400);}}
    if(route==='nonce'&&request.method==='POST'){const nonce=crypto.randomUUID();await store.put('shop-nonce:'+nonce,{expiresAt:Date.now()+60000});return response({nonce});}
    if(route==='login'&&request.method==='POST'){
      const key='shop-nonce:'+input.nonce,n=uuid(input.nonce)?await store.get(key):null;
      if(!n||n.expiresAt<Date.now()||typeof input.code!=='string'||input.code.length>512)return response({error:'Connexion expirée'},401);
      // Consume before redeem; a lost Forest response requires a fresh handshake.
      await store.delete(key);
      const identity=await signed(env,'identity/redeem',JSON.stringify({code:input.code,timestamp:Math.floor(Date.now()/1000)}),fetcher);
      if(identity.nonce!==input.nonce||typeof identity.userId!=='string')return response({error:'Identité non vérifiée'},401);
      const token=crypto.randomUUID()+crypto.randomUUID(),expiresAt=Date.now()+3600000;
      await store.put('shop-session:'+await hash(token),{userId:identity.userId,expiresAt});return response({token,expiresAt});
    }
    const token=request.headers.get('authorization')?.replace(/^Bearer /,''),session=await shopSession(store,token);
    if(!session)return response({error:'Connecte ton compte Forest'},401);
    const owner=session.userId,inventoryKey='forest-inventory:'+owner,inventory=await store.get(inventoryKey)||[],progress=await store.get('forest-progress:'+owner)||{games:0,wins:0};
    if(route==='inventory'&&request.method==='GET')return response({owned:inventory,progress});
    if(route==='quote'&&request.method==='POST'){
      const item=C.find(input.itemId);if(!item||item.rarity==='free')return response({error:'Objet invalide'},400);
      if(inventory.includes(item.id))return response({error:'Objet déjà possédé'},409);
      if(!C.unlocked(item,progress))return response({error:'Prérequis non atteints'},403);
      const currentKey='shop-current:'+owner+':'+item.id,existingId=await store.get(currentKey),existing=existingId&&await store.get('shop-quote:'+existingId);
      if(existing&&(existing.status==='pending'||existing.quote.expiresAt>Date.now()))return response(existing.status==='pending'?{...existing.quote,recover:true,expiresAt:Date.now()+120000}:existing.quote);
      const rates=await market(fetcher),units=priceUnits(C.rarities[item.rarity].cents,rates.usdPerToken,rates.usdPerEur),actionId=crypto.randomUUID();
      const quote={itemId:item.id,targetEurCents:C.rarities[item.rarity].cents,currency:'STICK',units,amount:display(units),actionId,expiresAt:Date.now()+120000};
      const chosen=await store.transaction(async tx=>{const activeId=await tx.get(currentKey),active=activeId&&await tx.get('shop-quote:'+activeId);if(active&&(active.status==='pending'||active.quote.expiresAt>Date.now()))return active.status==='pending'?{...active.quote,recover:true,expiresAt:Date.now()+120000}:active.quote;await tx.put('shop-quote:'+actionId,{owner,quote,status:'quoted'});await tx.put(currentKey,actionId);return quote;});return response(chosen);
    }
    if((route==='purchase'||route==='verify')&&request.method==='POST'){
      if(!uuid(input.actionId))return response({error:'Achat invalide'},400);
      const key='shop-quote:'+input.actionId;
      let record=await store.get(key);if(!record||record.owner!==owner)return response({error:'Achat inconnu'},404);
      if(route==='verify')return response({itemId:record.quote.itemId,owned:record.status==='complete'&&inventory.includes(record.quote.itemId)});
      if(record.status==='complete')return response({actionId:input.actionId,itemId:record.quote.itemId,owned:true});
      if(record.status==='quoted'&&record.quote.expiresAt<Date.now())return response({error:'Devis expiré'},409);
      // Freeze exact bytes once. Every recovery replays this body and its timestamp.
      record=await store.transaction(async tx=>{const value=await tx.get(key);if(value.status==='quoted'){value.body=JSON.stringify({actionId:value.quote.actionId,debitAmount:value.quote.units,creditAmount:'0',timestamp:Math.floor(Date.now()/1000)});value.status='pending';await tx.put(key,value);}return value;});
      const result=await signed(env,'settlements',record.body,fetcher);
      if(result.actionId!==record.quote.actionId||decimal(result.debitAmount).toString()!==record.quote.units||decimal(result.creditAmount)!==0n||!result.id)throw Error('Règlement non confirmé');
      await store.transaction(async tx=>{const owned=await tx.get(inventoryKey)||[];if(!owned.includes(record.quote.itemId))owned.push(record.quote.itemId);await tx.put(inventoryKey,owned);record.status='complete';record.settlementId=result.id;await tx.put(key,record);});
      return response({actionId:input.actionId,itemId:record.quote.itemId,owned:true});
    }
    return response({error:'Route inconnue'},404);
  }catch(error){return response({error:error.message||'Connexion momentanément indisponible'},502);}
}
