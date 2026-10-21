import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseCardGame} from '../lib/data/player-cards';
import {BOARD_WIDTH,BOARD_HEIGHT,BOARD_PADDING,clampPoint,pointerOnBoard,readBoardLayout,matchSurprisePlayers,emptyBoard} from '../lib/surprise-board';
import {GET} from '../app/api/surprise-board/route';
const players=()=>parseCardGame(JSON.parse(readFileSync(new URL('./fixtures/card-game-401909088.json',import.meta.url),'utf8')),'401909088','2026-10-20');
const appendix='附录：惊喜球员表现明细\n\n凯尔特人 乔治 38分5板3助攻 7记三分 投篮21投12中 罚球7/8 5抢断0盖帽3失误\n\n活塞 贾旺特·格林 19分4板0助攻 5记三分 投篮10投5中 罚球4/4 0抢断0盖帽0失误';
describe('daily surprise portrait board',()=>{
  it('uses only the briefing surprise appendix, preserving order and disambiguating aliases by actual team',()=>{
    const data=matchSurprisePlayers('其他球员在正文出现不自动上榜。\n'+appendix,players());
    expect(data.total).toBe(2);expect(data.warnings).toEqual([]);expect(data.players.map(p=>p.name)).toEqual(['Paul George','Javonte Green']);expect(data.players[0].boardName).toBe('乔治');
    expect(matchSurprisePlayers('今天没有惊喜球员。',players()).players).toEqual([]);
  });
  it('does not silently assign portraits when stats, team, identity or appendix formatting fail to match',()=>{
    for(const text of [appendix.replace('38分','39分'),appendix.replace('凯尔特人 乔治','雷霆 乔治'),appendix.replace('乔治','不存在的球员'),appendix.replace('38分5板','38分五板')]){
      const data=matchSurprisePlayers(text,players());expect(data.players.map(p=>p.name)).toEqual(['Javonte Green']);expect(data.warnings).toHaveLength(1);
    }
    const duplicates=[...players(),{...players().find(p=>p.name==='Paul George')!,id:'999999'}];
    expect(matchSurprisePlayers(appendix,duplicates).players.map(p=>p.name)).toEqual(['Javonte Green']);
  });
  it('accepts both old appendices and explicit playing time, rejecting a mismatched time',()=>{
    const withMinutes=appendix.replace('乔治 38分','乔治 出场31分钟 38分');
    expect(matchSurprisePlayers(withMinutes,players()).warnings).toEqual([]);
    expect(matchSurprisePlayers(withMinutes.replace('出场31分钟','出场32分钟'),players()).players.map(p=>p.name)).toEqual(['Javonte Green']);
    const precise=players().map(p=>p.name==='Paul George'?{...p,minutes:'31:05'}:p);
    expect(matchSurprisePlayers(withMinutes.replace('出场31分钟','出场31分05秒'),precise).warnings).toEqual([]);
  });
  it('keeps full free movement including space above and below the tiers at different display scales',()=>{
    const rect={left:100,top:50,width:BOARD_WIDTH/2,height:BOARD_HEIGHT/2};
    expect(pointerOnBoard({x:250,y:90},rect)).toEqual({x:300,y:80});
    expect(pointerOnBoard({x:250,y:90},rect,{x:10,y:5})).toEqual({x:290,y:75});
    expect(pointerOnBoard({x:99,y:90},rect)).toBeNull();
    const top=clampPoint({x:300,y:80},112),bottom=clampPoint({x:500,y:920},112);
    expect(top.y+56).toBeLessThan(BOARD_PADDING);expect(bottom.y-56).toBeGreaterThan(BOARD_HEIGHT-BOARD_PADDING);
    expect(clampPoint({x:-20,y:2000},112)).toEqual({x:56,y:BOARD_HEIGHT-56});
  });
  it('restores layout safely, excludes stale players and constrains corrupt saved positions',()=>{
    expect(readBoardLayout('{bad', ['4251'])).toEqual(emptyBoard());
    expect(readBoardLayout('{"version":2,"positions":{}}', ['4251'])).toEqual(emptyBoard());
    const stored=JSON.stringify({version:1,size:112,showNames:false,positions:{4251:{x:300,y:80},999:{x:10,y:20},123:{x:-200,y:2000},456:{x:'bad',y:2}}});
    expect(readBoardLayout(stored,['4251','123','456'])).toEqual({size:112,showNames:false,positions:{4251:{x:300,y:80},123:{x:56,y:930}}});
  });
  it('rejects invalid dates before accessing storage',async()=>{
    const response=await GET(new Request('https://example.com/api/surprise-board?date=2026-02-30'));expect(response.status).toBe(400);
  });
});
