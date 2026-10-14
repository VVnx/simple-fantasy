import { describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/schedule/route';
import { parseScoreboard, getWeekSchedule } from '../lib/data/schedule';
import { addDays, buildScheduleRows, easternDate, mondayOf, validDate, weekDays, type ScheduleGame, type WeekSchedule } from '../lib/schedule';
import fixture from './fixtures/schedule-2026-10-14.json';

const now=new Date('2026-10-12T12:00:00Z');
function game(date:string,overrides:Partial<ScheduleGame>={}):ScheduleGame{
  return {id:date,date,tipoff:`${date}T23:00:00Z`,homeId:'2',awayId:'13',homeName:'凯尔特人',awayName:'湖人',status:'scheduled',timeKnown:true,neutral:false,type:'regular',...overrides};
}
function board(games:ScheduleGame[]):WeekSchedule{return {weekStart:'2026-10-12',games,fetchedAt:now.toISOString(),source:'ESPN'};}
function boston(games:ScheduleGame[],from='2026-10-12',at=now){return buildScheduleRows(board(games),'regular',from,at).find(row=>row.team.id==='2')!;}
afterEach(()=>vi.unstubAllGlobals());

describe('NBA week and streaming opportunities',()=>{
  it('uses Eastern date rather than UTC or Beijing date, including DST',()=>{
    expect(easternDate(new Date('2026-10-12T02:00:00Z'))).toBe('2026-10-11');
    expect(easternDate(new Date('2026-11-02T04:30:00Z'))).toBe('2026-11-01');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
    expect(weekDays('2026-12-28').at(-1)).toBe('2027-01-03');
    expect(addDays('2026-03-08',1)).toBe('2026-03-09');
  });
  it('rejects impossible dates and accepts leap days',()=>{
    expect(validDate('2026-02-29')).toBe(false);expect(validDate('2028-02-29')).toBe(true);expect(validDate('2026-1-1')).toBe(false);
  });
  it('always includes all 30 teams and zero-game rows',()=>{
    const rows=buildScheduleRows(board([]),'regular','2026-10-12',now);
    expect(rows).toHaveLength(30);expect(new Set(rows.map(row=>row.team.id)).size).toBe(30);
    expect(rows.every(row=>row.total===0&&row.days.length===7)).toBe(true);
  });
  it('counts each matchup once per team and places it under the correct weekday',()=>{
    const rows=buildScheduleRows(board([game('2026-10-12'),game('2026-10-14')]),'regular','2026-10-12',now);
    expect(rows.reduce((n,row)=>n+row.total,0)).toBe(4);
    const row=rows.find(row=>row.team.id==='2')!;
    expect(row.total).toBe(2);expect(row.days.map(day=>day.length)).toEqual([1,0,1,0,0,0,0]);
    expect(row.days[0][0].opponent).toBe('湖人');expect(row.days[0][0].home).toBe(true);
    expect(rows.find(row=>row.team.id==='13')!.days[0][0].home).toBe(false);
  });
  it('separates total games, remaining games and the selected two-day window',()=>{
    const row=boston([game('2026-10-12'),game('2026-10-13'),game('2026-10-15'),game('2026-10-18')],'2026-10-13');
    expect(row.total).toBe(4);expect(row.remaining).toBe(3);expect(row.nextTwo).toBe(1);
    expect(row.pairs[0].available).toBe(false);
  });
  it('finds back-to-backs and highlights both games without marking separated dates',()=>{
    const row=boston([game('2026-10-12'),game('2026-10-13'),game('2026-10-15')]);
    expect(row.pairs).toEqual([{start:'2026-10-12',end:'2026-10-13',available:true}]);
    expect(row.days[0][0].backToBack).toBe(true);expect(row.days[1][0].backToBack).toBe(true);expect(row.days[3][0].backToBack).toBe(false);
    expect(row.nextTwo).toBe(2);
  });
  it('recognizes cross-week pairs without adding outside games to weekly totals',()=>{
    const row=boston([game('2026-10-11'),game('2026-10-12'),game('2026-10-18'),game('2026-10-19')]);
    expect(row.total).toBe(2);expect(row.remaining).toBe(2);
    expect(row.pairs).toEqual([{start:'2026-10-11',end:'2026-10-12',available:false},{start:'2026-10-18',end:'2026-10-19',available:true}]);
    expect(row.days[6][0].backToBack).toBe(true);
  });
  it('does not offer games already started even if upstream still says scheduled',()=>{
    const row=boston([game('2026-10-12'),game('2026-10-13')],'2026-10-12',new Date('2026-10-12T23:01:00Z'));
    expect(row.total).toBe(2);expect(row.remaining).toBe(1);expect(row.pairs[0].available).toBe(false);
  });
  it('excludes postponed/canceled games from totals and pairs, and live/final games from remaining',()=>{
    const row=boston([game('2026-10-12',{status:'live'}),game('2026-10-13',{status:'postponed'}),game('2026-10-14',{status:'canceled'}),game('2026-10-15',{status:'final'})]);
    expect(row.total).toBe(2);expect(row.remaining).toBe(0);expect(row.pairs).toHaveLength(0);
    expect(row.days[1][0].status).toBe('postponed');
  });
  it('never mixes preseason into regular season opportunities',()=>{
    const row=boston([game('2026-10-12'),game('2026-10-13',{type:'preseason'})]);
    expect(row.total).toBe(1);expect(row.pairs).toHaveLength(0);
  });
});

describe('ESPN schedule adapter',()=>{
  it('parses a captured live scoreboard and converts UTC overnight games to Eastern dates',()=>{
    const games=parseScoreboard(fixture,'2026-10-14');
    expect(games).toHaveLength(7);expect(games.every(g=>g.type==='preseason'&&g.date==='2026-10-14')).toBe(true);
    expect(games[0]).toMatchObject({homeName:'热火',awayName:'篮网',homeId:'14',awayId:'17'});
  });
  it('rejects malformed or wrong-day results instead of showing a zero-game week',()=>{
    expect(()=>parseScoreboard({},'2026-10-14')).toThrow();
    expect(()=>parseScoreboard({...fixture,events:undefined},'2026-10-14')).toThrow();
    expect(()=>parseScoreboard(fixture,'2026-10-15')).toThrow('其他日期');
    expect(parseScoreboard({leagues:[{slug:'nba'}],events:[]},'2026-10-14')).toEqual([]);
  });
  it('removes Cup championship and All-Star games from fantasy schedules',()=>{
    const event=fixture.events[0];
    const copy={...fixture,events:[{...event,competitions:[{...event.competitions[0],notes:[{headline:'NBA Cup - Championship'}]}]}]};
    expect(parseScoreboard(copy,'2026-10-14')).toEqual([]);
  });
  it('retains NBA preseason games against a non-NBA opponent',()=>{
    const copy=structuredClone(fixture);copy.events=copy.events.slice(0,1);
    copy.events[0].competitions[0].competitors[1].team={id:'9999',displayName:'International Team'};
    expect(parseScoreboard(copy,'2026-10-14')[0].awayName).toBe('International Team');
  });
  it('marks postponed games rather than advertising them as opportunities',()=>{
    const copy=structuredClone(fixture);copy.events[0].status.type.name='STATUS_POSTPONED';
    expect(parseScoreboard(copy,'2026-10-14')[0].status).toBe('postponed');
  });
  it('uses requested game day for time-TBD placeholders',()=>{
    const copy=structuredClone(fixture);copy.events=copy.events.slice(0,1);
    copy.events[0].competitions[0].date='2026-10-14T00:00Z';copy.events[0].competitions[0].timeValid=false;
    expect(parseScoreboard(copy,'2026-10-14')[0]).toMatchObject({date:'2026-10-14',timeKnown:false});
  });
  it('loads all nine days and coalesces repeated weekly reads',async()=>{
    const fetcher=vi.fn(async()=>Response.json({leagues:[{slug:'nba'}],events:[]}));vi.stubGlobal('fetch',fetcher);
    const week=await getWeekSchedule('2026-11-09');await getWeekSchedule('2026-11-09');
    expect(fetcher).toHaveBeenCalledTimes(9);expect(week.weekStart).toBe('2026-11-09');
    expect(fetcher.mock.calls.flat().join(' ')).toContain('20261108');expect(fetcher.mock.calls.flat().join(' ')).toContain('20261116');
  });
  it('fails the week when one day fails, never fills unknown days with zero',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('20261118')?new Response('unavailable',{status:503}):Response.json({leagues:[{slug:'nba'}],events:[]})));
    await expect(getWeekSchedule('2026-11-16')).rejects.toThrow('503');
  });
  it('validates route dates before making upstream requests',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    for(const date of ['2026-10-13','2026-02-30','bad','2200-01-06']){
      expect((await GET(new NextRequest(`http://localhost/api/schedule?week=${date}`))).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
