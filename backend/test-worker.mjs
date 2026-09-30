import assert from 'node:assert/strict';
import worker from './worker.js';

const writes=[];
const DB={prepare(sql){return {
  bind(...values){return {run:async()=>{writes.push({sql,values});return {success:true};}};},
  async first(){
    if(sql.includes('AVG('))return {value:34000};
    if(sql.includes("type='race_finished'"))return {count:7};
    return {count:2};
  },
  async all(){
    if(sql.includes('GROUP BY'))return {results:[{winner:'A',count:3},{winner:'B',count:4}]};
    return {results:[{winner:'B',won:1,duration_ms:33000,sudden_death:0,created_at:new Date().toISOString()}]};
  }
};}};
const env={DB,ADMIN_TOKEN:'secret-test'};

const eventResponse=await worker.fetch(new Request('https://api.test/api/events',{method:'POST',body:JSON.stringify({type:'race_finished',session_id:'12345678-abcd',round_id:'round-1',winner:'B',choice:'B',bet_placed:true,won:true,duration_ms:33000})}),env);
assert.equal(eventResponse.status,202);
assert.equal(writes.length,2);

const denied=await worker.fetch(new Request('https://api.test/api/stats'),env);
assert.equal(denied.status,401);

const statsResponse=await worker.fetch(new Request('https://api.test/api/stats',{headers:{authorization:'Bearer secret-test'}}),env);
assert.equal(statsResponse.status,200);
const stats=await statsResponse.json();
assert.deepEqual({active:stats.active_now,rounds:stats.rounds_today,winnerB:stats.winners.B},{active:2,rounds:7,winnerB:4});
console.log('worker API tests passed');
