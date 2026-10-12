import assert from 'node:assert/strict';
import {loadSeason,searchPlayers,parseGameLog} from '../lib/data/espn';
import {fetchJson} from '../lib/data/http';
import {defaultSelections} from '../lib/seasons';
async function main() {
const now=new Date();
const defaults=defaultSelections(now);
console.log(JSON.stringify({verifiedAt:now.toISOString(),node:process.version,defaults}));
for(const query of ['里萨谢','James','Luka Doncic','Cooper Flagg','qqqnonexistentplayerzz']) {
  const start=Date.now(),search=await searchPlayers(query);
  console.log(JSON.stringify({query,matches:search.players.map(p=>({id:p.id,name:p.name})),ms:Date.now()-start}));
  if(query==='qqqnonexistentplayerzz'){assert.equal(search.players.length,0);continue;}
  assert.ok(search.players.length>0);
  if(query==='James'){assert.ok(search.players.some(p=>p.name==='LeBron James'));assert.ok(search.players.some(p=>p.name==='Bronny James'));continue;}
  const player=search.players[0];
  for(const selection of defaults){
    const start=Date.now(),row=await loadSeason(player.id,selection);
    console.log(JSON.stringify({player:player.name,...selection,status:row.status,totals:row.totals,minutePrecision:row.minutePrecision,ms:Date.now()-start}));
    if(row.totals&&selection.type==='regular') {
      const raw=await fetchJson(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${player.id}/gamelog?season=${selection.year}`);
      const log=parseGameLog(raw,selection).totals;
      assert.ok(log);
      for(const key of ['gp','fgm','fga','ftm','fta','three','pts','reb','ast','st','blk','to','dd'] as const) assert.equal(log[key],row.totals[key],`${player.name} ${selection.year} ${key}`);
      console.log(`PASS independent season-total/game-log cross-check: ${player.name} ${selection.year}`);
    }
  }
}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
