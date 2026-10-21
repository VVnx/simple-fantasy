import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseCardGame,parseCardScoreboard} from '../lib/data/player-cards';
import {cardStatLine,cardFilename,localDate} from '../lib/player-cards';
import {GET as cardsRoute} from '../app/api/player-cards/route';
import {GET as photoRoute} from '../app/api/player-headshot/route';
import {NextRequest} from 'next/server';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/card-game-401909088.json',import.meta.url),'utf8'));
const date='2026-10-20',gameId='401909088';
describe('single-game player cards',()=>{
  it('reads a complete real game with shooting, threes, zero stats and the actual game team',()=>{
    const players=parseCardGame(fixture(),gameId,date);const george=players.find(p=>p.id==='4251')!;
    expect(george).toMatchObject({team:'凯尔特人',date,beijingDate:'2026-10-21',stats:{pts:38,reb:5,ast:3,three:7,threeAttempted:12,fgm:12,fga:21,ftm:7,fta:8,st:5,blk:0,to:3}});
    expect(cardStatLine(george,'乔治')).toBe('凯尔特人 乔治 38分5板3助攻 7记三分 投篮21投12中 罚球7/8 5抢断0盖帽3失误');
    expect(cardFilename(george)).toBe('NBA-Fantasy-2026-10-20-Paul-George.png');
    expect(players.reduce((total,p)=>total+p.stats.pts,0)).toBe(234);
  });
  it('never manufactures a zero game for an inactive player',()=>{
    const data=fixture();data.boxscore.players[0].statistics[0].athletes.push({athlete:{id:'999999',displayName:'Inactive player'},didNotPlay:true});
    expect(parseCardGame(data,gameId,date).some(p=>p.id==='999999')).toBe(false);
  });
  it('rejects a different game/date, a live result, missing stats and inconsistent scoring',()=>{
    expect(()=>parseCardGame(fixture(),'999',date)).toThrow('不匹配');expect(()=>parseCardGame(fixture(),gameId,'2026-10-21')).toThrow('不匹配');
    const live=fixture();live.header.competitions[0].status.type.completed=false;expect(()=>parseCardGame(live,gameId,date)).toThrow('不匹配');
    const missing=fixture();missing.boxscore.players[0].statistics[0].athletes[0].stats.pop();expect(()=>parseCardGame(missing,gameId,date)).toThrow('不完整');
    const changed=fixture();changed.boxscore.players[0].statistics[0].athletes[0].stats[1]='99';expect(()=>parseCardGame(changed,gameId,date)).toThrow('不完整');
  });
  it('selects final games only, and preserves source dates across timezone boundaries',()=>{
    const events=[{id:'1',date:'2026-10-21T01:30Z',status:{type:{completed:true}}},{id:'2',date:'2026-10-20T23:00Z',status:{type:{completed:false}}}];
    expect(parseCardScoreboard({events},date)).toEqual({finished:['1'],pending:1});
    expect(()=>parseCardScoreboard({events},'2026-10-21')).toThrow('不匹配');
    expect(localDate(new Date('2026-10-20T19:00Z'))).toBe('2026-10-21');
  });
  it('rejects invalid dates and image URLs before requesting an upstream',async()=>{
    expect((await cardsRoute(new NextRequest('https://example.com/api/player-cards?date=2026-02-30'))).status).toBe(400);
    expect((await photoRoute(new NextRequest('https://example.com/api/player-headshot?id=https://example.com/private'))).status).toBe(400);
  });
});
