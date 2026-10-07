/* Shared, side-effect-free catalogue and state rules. No gameplay values. */
(() => {
  const rarities = Object.freeze({free:{label:'Gratuit',cents:0,games:0,wins:0},rare:{label:'Rare',cents:25,games:15,wins:0},epic:{label:'Épique',cents:75,games:25,wins:3},legendary:{label:'Légendaire',cents:200,games:50,wins:7}});
  const items=[];
  function add(category,id,name,rarity,color,description){items.push(Object.freeze({category,id,name,rarity,color,description}));}
  ['Red','Blue','Green','Yellow','Black','White'].forEach((name,i)=>add('skins','classic-'+name.toLowerCase(),'Classic '+name,'free',['#e55555','#64aaff','#75bf65','#e8cb54','#333b37','#e9eee5'][i],'Stickman classique'));
  add('skins','forest-moss','Forest Moss','rare','#78ae58','Traits arrondis et petites feuilles');
  add('skins','rave-pulse','Rave Pulse','epic','#484052','Deux ondes sonores discrètes');
  add('skins','forest-survivor','Forest Survivor','epic','#8c9a62','Bandana rouge et couteau à la taille');
  add('skins','golden-stick','Golden Stick','legendary','#d7b85b','Doré sobre');
  add('skins','technofather','Technofather','legendary','#a4adb3','Articulations mécaniques');
  add('skins','bidouille-tribute','Bidouille Tribute','legendary','#9bdded','Bleu clair, canard et robot');
  [['pouf','Pouf','free'],['confetti','Confettis','rare'],['pixel-break','Pixel Break','rare'],['electric-zap','Electric Zap','epic'],['rave-collapse','Rave Collapse','epic'],['golden-burst','Golden Burst','legendary'],['duck-escape','Duck Escape','legendary']].forEach(([id,name,rarity])=>add('deaths',id,name,rarity,'#aad5ca','Animation courte, purement visuelle'));
  [['classic-arena','Classic Arena','free','#141c15'],['forest-floor','Forest Floor','rare','#203023'],['rave-clearing','Rave Clearing','rare','#211b30'],['construction-zone','Construction Zone','epic','#282922'],['technofather-lab','Technofather Lab','epic','#182832'],['golden-temple','Golden Temple','legendary','#302b1d'],['bidouille-workshop','Bidouille Workshop','legendary','#1b3036']].forEach(([id,name,rarity,color])=>add('arenas',id,name,rarity,color,'Décor local · aucun changement des blocs'));
  const find=id=>items.find(item=>item.id===id);
  const defaults={skins:null,deaths:'pouf',arenas:'classic-arena'};
  const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
  function clean(raw={}){
    if(!raw||typeof raw!=='object')raw={};
    const owned=[...new Set(items.filter(i=>i.rarity==='free').map(i=>i.id).concat(Array.isArray(raw.owned)?raw.owned.filter(id=>find(id)):[]))];
    const equipped={...defaults};for(const category of Object.keys(defaults)){const id=raw.equipped?.[category];if(find(id)?.category===category&&owned.includes(id))equipped[category]=id;}
    return {version:1,games:count(raw.games),wins:Math.min(count(raw.wins),count(raw.games)),owned,equipped,recent:Array.isArray(raw.recent)?raw.recent.filter(id=>typeof id==='string').slice(-100):[]};
  }
  function unlocked(item,profile){const r=rarities[item.rarity];return profile.games>=r.games&&profile.wins>=r.wins;}
  function state(item,profile){if(profile.owned.includes(item.id))return profile.equipped[item.category]===item.id?'equipped':'owned';return unlocked(item,profile)?'unlocked':'locked';}
  function complete(profile,id,won){if(!id||profile.recent.includes(id))return false;profile.games++;if(won)profile.wins++;profile.recent.push(id);profile.recent=profile.recent.slice(-100);return true;}
  function publicLoadout(profile){return {skin:profile.equipped.skins,death:profile.equipped.deaths};}
  function validatePublic(value,owned=[]){return {skin:find(value?.skin)?.category==='skins'&&(find(value.skin).rarity==='free'||owned.includes(value.skin))?value.skin:defaults.skins,death:find(value?.death)?.category==='deaths'&&(find(value.death).rarity==='free'||owned.includes(value.death))?value.death:defaults.deaths};}
  // Quotes use integer token units, with upward rounding. The provider owns expiry and settlement.
  function tokenUnits(cents,eurMicrosPerToken,decimals){if(!Number.isSafeInteger(cents)||cents<=0||!Number.isSafeInteger(eurMicrosPerToken)||eurMicrosPerToken<=0||!Number.isInteger(decimals)||decimals<0||decimals>18)throw Error('Cours indisponible');const rate=BigInt(eurMicrosPerToken);return ((BigInt(cents)*10000n*10n**BigInt(decimals)+rate-1n)/rate).toString();}
  globalThis.LastStickCosmeticsCore=Object.freeze({rarities,items:Object.freeze(items),find,defaults,clean,unlocked,state,complete,publicLoadout,validatePublic,tokenUnits});
})();
