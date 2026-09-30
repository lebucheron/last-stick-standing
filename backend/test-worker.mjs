import assert from 'node:assert/strict';
import worker from './worker.js';

const writes=[];
const DB={prepare(sql){return {
  values:[],bind(...values){this.values=values;return this;},
  async run(){writes.push({sql,values:this.values});return {success:true};},
  async first(){
    if(sql.includes("type='race_started'"))return {created_at:new Date(Date.now()-10000).toISOString()};
    if(sql.includes("type='race_finished' LIMIT 1"))return null;
    if(sql.includes('AVG('))return {average:34000,minimum:18000,maximum:44000};
    if(sql.includes('ORDER BY duration_ms'))return {value:sql.includes('OFFSET')?35000:34000};
    if(sql.includes('sudden_death=1'))return {count:1};
    if(sql.includes("type='race_finished'"))return {count:7};
    return {count:2};
  },
  async all(){
    if(sql.includes('COUNT(DISTINCT round_id)'))return {results:[{ruleset:'R2',count:7}]};
    if(sql.includes('json_each(finished.starts)'))return {results:[{start:2,count:5},{start:7,count:6}]};
    if(sql.includes('GROUP BY winner_start'))return {results:[{winner_start:2,count:3},{winner_start:7,count:4}]};
    if(sql.includes('GROUP BY cause'))return {results:[{cause:'impact',count:30},{cause:'combat',count:1}]};
    if(sql.includes('GROUP BY winner'))return {results:[{winner:'A',count:3},{winner:'B',count:4}]};
    return {results:[{winner:'B',won:1,duration_ms:33000,sudden_death:0,ruleset:'R2',created_at:new Date().toISOString()}]};
  }
};}};
const env={DB,ADMIN_TOKEN:'secret-test',STATS_SINCE:'2026-09-30T09:30:00Z'};

const eventResponse=await worker.fetch(new Request('https://api.test/api/events',{method:'POST',headers:{origin:'https://lebucheron.github.io'},body:JSON.stringify({type:'race_finished',session_id:'12345678-abcd',round_id:'round-0001',ruleset:'R2',seed:4294967295,winner:'B',winner_start:7,starts:{A:0,B:7,C:2,D:4,E:6,F:9},deaths:[{runner:'A',cause:'impact',at:12.34},{runner:'Z',cause:'hack',at:-1}],choice:'B',bet_placed:true,won:true,duration_ms:33000})}),env);
assert.equal(eventResponse.status,202);
assert.equal(writes.length,2);
assert.equal(writes[1].values[3],4294967295);
assert.equal(writes[1].values[10],7);
assert.equal(writes[1].values[11],JSON.stringify([{runner:'A',cause:'impact',at:12.3}]));
assert.equal(writes[1].values[12],'R2');
assert.equal(writes[1].values[13],JSON.stringify({A:0,B:7,C:2,D:4,E:6,F:9}));

const denied=await worker.fetch(new Request('https://api.test/api/stats'),env);
assert.equal(denied.status,401);

const statsResponse=await worker.fetch(new Request('https://api.test/api/stats',{headers:{authorization:'Bearer secret-test'}}),env);
assert.equal(statsResponse.status,200);
const stats=await statsResponse.json();
assert.deepEqual({active:stats.active_now,rounds:stats.rounds_today,winnerB:stats.winners.B},{active:2,rounds:7,winnerB:4});
assert.equal(stats.winning_starts[7],4);
assert.equal(stats.start_appearances[7],6);
assert.equal(stats.death_causes.impact,30);
assert.equal(stats.combat_final_rate,1/7);
console.log('worker API tests passed');
