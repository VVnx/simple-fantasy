import {describe,it,expect} from 'vitest';
import {CARD_PASTE_EXAMPLE,matchingPortrait,parsePlayerCardLine} from '../lib/player-card-paste';
import {cardStatLine,cardFilename} from '../lib/player-cards';

describe('pasted player cards',()=>{
  it('round-trips an appendix line without inventing a game, portrait or three-point attempts',()=>{
    const player=parsePlayerCardLine(CARD_PASTE_EXAMPLE);
    expect(cardStatLine(player)).toBe(CARD_PASTE_EXAMPLE);
    expect(player).toMatchObject({team:'凯尔特人',name:'乔治',minutes:'31',stats:{pts:38,reb:5,ast:3,three:7,fgm:12,fga:21,ftm:7,fta:8,st:5,blk:0,to:3}});
    expect(player.stats.threeAttempted).toBeUndefined();expect(player.id).toBeUndefined();expect(player.date).toBeUndefined();expect(player.gameId).toBeUndefined();
    expect(cardFilename(player)).toBe('NBA-Fantasy-乔治.png');
  });
  it('accepts copied punctuation, full-width digits, English names and explicit shooting pairs',()=>{
    const line='- 凯尔特人 Paul George，出场３１分０５秒，38分 5篮板 3助攻；三分12投7中，投篮12/21，罚球8投7中，5抢断0封盖3失误';
    expect(parsePlayerCardLine(line)).toMatchObject({name:'Paul George',minutes:'31:05',stats:{three:7,threeAttempted:12,fgm:12,fga:21,ftm:7,fta:8}});
    expect(parsePlayerCardLine(CARD_PASTE_EXAMPLE.replace('出场31分钟','出场31:05').replace('7记三分','三分7/12')).minutes).toBe('31:05');
    expect(parsePlayerCardLine(CARD_PASTE_EXAMPLE.replace('31分钟','31.5分钟')).minutes).toBe('31.5');
  });
  it('preserves true zero values without allowing missing fields',()=>{
    const zero='湖人 球员 出场2分钟 0分0板0助攻 0记三分 投篮0投0中 罚球0/0 0抢断0盖帽0失误';
    expect(parsePlayerCardLine(zero).stats).toMatchObject({pts:0,three:0,ftm:0,fta:0,st:0,blk:0,to:0});
    for(const value of ['出场2分钟','0助攻','0记三分','0盖帽','罚球0/0'])expect(()=>parsePlayerCardLine(zero.replace(value,''))).toThrow(/缺少/);
  });
  it('rejects conflicting, duplicate, malformed and multiple-player data',()=>{
    for(const line of [CARD_PASTE_EXAMPLE+' 38分',CARD_PASTE_EXAMPLE+'\n'+CARD_PASTE_EXAMPLE,CARD_PASTE_EXAMPLE.replace('31分钟','-31分钟'),CARD_PASTE_EXAMPLE.replace('5板','5.5板')])expect(()=>parsePlayerCardLine(line)).toThrow();
    expect(()=>parsePlayerCardLine(CARD_PASTE_EXAMPLE.replace('38分','39分'))).toThrow('得分与投篮不一致');
    expect(()=>parsePlayerCardLine(CARD_PASTE_EXAMPLE.replace('21投12中','11投12中'))).toThrow('命中数');
    expect(()=>parsePlayerCardLine(CARD_PASTE_EXAMPLE.replace('7记三分','三分7/19'))).toThrow('命中数');
    expect(()=>parsePlayerCardLine('凯尔特人乔治 38分')).toThrow('球队 球员');
  });
  it('leaves shared surnames for explicit selection and matches full-name aliases',()=>{
    const players=[{id:'4251',name:'Paul George',team:'Boston Celtics'},{id:'1',name:'Keyonte George',team:'Utah Jazz'}];
    expect(matchingPortrait(players,'乔治')).toBeUndefined();
    expect(matchingPortrait(players,'保罗乔治')?.id).toBe('4251');
    expect(matchingPortrait(players,'Paul George')?.id).toBe('4251');
    expect(matchingPortrait([],'乔治')).toBeUndefined();
  });
});
