import assert from 'node:assert/strict';
import {shopRequest,decimal,display,priceUnits,PROJECT_ID} from './shop.js';
assert.equal(decimal('3.324420183784223e-7'),332442018378n);
assert.equal(display('1230000000000000000'),'1.23');
assert.equal(display('1000000000000000000'),'1');
assert.equal(priceUnits(25,'0.5','1.2'),'600000000000000000');
assert.throws(()=>priceUnits(25,'0','1.2'));
const data=new Map(),storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),transaction:async f=>f(storage)},room={state:{storage},env:{SETTLEMENT_SECRET:'test-only-secret'}};
let nonce,settlements=[],failOnce=true;
async function fetcher(url,options){
  if(url.endsWith('/identity/redeem')){assert.ok(options.headers['X-Forest-Settlement-Signature'].startsWith('v1='));assert.ok(url.includes(PROJECT_ID));return Response.json({userId:'forest-user',nonce});}
  if(url.includes('/stats?'))return Response.json({price:'0.5'});
  if(url.includes('ecb.europa'))return new Response("<Cube time='"+new Date().toISOString().slice(0,10)+"'><Cube currency='USD' rate='1.2'/></Cube>");
  if(url.endsWith('/settlements')){settlements.push(options.body);if(failOnce){failOnce=false;throw Error('Network interrupted');}const body=JSON.parse(options.body);return Response.json({id:'settlement-one',actionId:body.actionId,debitAmount:display(body.debitAmount),creditAmount:'0'});}
  throw Error('Unexpected URL');
}
let token;
async function call(route,input){const r=await shopRequest(new Request('https://api.test/api/shop/'+route,{method:input?'POST':'GET',headers:{...(token?{authorization:'Bearer '+token}:{}),...(input?{'content-type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})}),room,{fetcher});return {status:r.status,data:await r.json()};}
nonce=(await call('nonce',{})).data.nonce;const login=await call('login',{nonce,code:'opaque-test-code'});assert.equal(login.status,200);token=login.data.token;
assert.equal((await call('login',{nonce,code:'opaque-test-code'})).status,401);
assert.equal((await call('quote',{itemId:'forest-moss',games:999,wins:999})).status,403);
data.set('forest-progress:forest-user',{games:15,wins:0});
const quote=(await call('quote',{itemId:'forest-moss'})).data;assert.equal(quote.units,'600000000000000000');assert.equal((await call('quote',{itemId:'forest-moss'})).data.actionId,quote.actionId);
assert.equal((await call('purchase',{actionId:crypto.randomUUID()})).status,404);
assert.equal((await call('purchase',{actionId:quote.actionId,units:'1'})).status,502);
assert.deepEqual(data.get('forest-inventory:forest-user'),undefined);
assert.equal((await call('purchase',{actionId:quote.actionId})).data.owned,true);
assert.equal(settlements[0],settlements[1]);
assert.deepEqual(data.get('forest-inventory:forest-user'),['forest-moss']);
assert.equal((await call('verify',{actionId:quote.actionId})).data.owned,true);
await call('purchase',{actionId:quote.actionId});assert.equal(settlements.length,2);
assert.equal((await call('quote',{itemId:'forest-moss'})).status,409);
token='forged';assert.equal((await call('inventory')).status,401);
console.log('Shop tests passed: verified identity, exact prices, prerequisites, replay recovery and idempotent ownership');
