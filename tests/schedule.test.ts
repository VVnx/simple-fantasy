import { describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/schedule/route';
import { parseScoreboard, getWeekSchedule, parseScheduleSeason, getScheduleSeason } from '../lib/data/schedule';
import { addDays, buildScheduleRows, easternDate, mondayOf, currentScheduleWeek, seasonWeekNumber, seasonWeeks, validDate, weekDays, type ScheduleGame, type WeekSchedule } from '../lib/schedule';
import fixture from './fixtures/schedule-2026-10-14.json';

const now=new Date('2026-10-12T12:00:00Z');
function game(date:string,overrides:Partial<ScheduleGame>={}):ScheduleGame{
  return {id:date,date,tipoff:`${date}T23:00:00Z`,homeId:'2',awayId:'13',homeName:'凯尔特人',awayName:'湖人',status:'scheduled',timeKnown:true,neutral:false,type:'regular',...overrides};
}
function board(games:ScheduleGame[]):WeekSchedule{return {weekStart:'2026-10-12',weeks:1,games,fetchedAt:now.toISOString(),source:'ESPN'};}
function boston(games:ScheduleGame[]){return buildScheduleRows(board(games),'regular').find(row=>row.team.id==='2')!;}
afterEach(()=>vi.unstubAllGlobals());

describe('NBA weekly grid',()=>{
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
    const rows=buildScheduleRows(board([]),'regular');
    expect(rows).toHaveLength(30);expect(new Set(rows.map(row=>row.team.id)).size).toBe(30);
    expect(rows.every(row=>row.total===0&&row.days.length===7)).toBe(true);
  });
  it('counts each matchup once per team and places it under the correct weekday',()=>{
    const rows=buildScheduleRows(board([game('2026-10-12'),game('2026-10-14')]),'regular');
    expect(rows.reduce((n,row)=>n+row.total,0)).toBe(4);
    const row=rows.find(row=>row.team.id==='2')!;
    expect(row.total).toBe(2);expect(row.days.map(day=>day.length)).toEqual([1,0,1,0,0,0,0]);
    expect(row.days[0][0].opponent).toBe('湖人');expect(row.days[0][0].home).toBe(true);
    expect(rows.find(row=>row.team.id==='13')!.days[0][0].home).toBe(false);
  });
  it('finds back-to-backs and highlights both games without marking separated dates',()=>{
    const row=boston([game('2026-10-12'),game('2026-10-13'),game('2026-10-15')]);
    expect(row.days[0][0].backToBack).toBe(true);expect(row.days[1][0].backToBack).toBe(true);expect(row.days[3][0].backToBack).toBe(false);
  });
  it('recognizes cross-week pairs without adding outside games to weekly totals',()=>{
    const row=boston([game('2026-10-11'),game('2026-10-12'),game('2026-10-18'),game('2026-10-19')]);
    expect(row.total).toBe(2);
    expect(row.days[0][0].backToBack).toBe(true);
    expect(row.days[6][0].backToBack).toBe(true);
  });
  it('excludes postponed/canceled games from totals and back-to-backs',()=>{
    const row=boston([game('2026-10-12',{status:'live'}),game('2026-10-13',{status:'postponed'}),game('2026-10-14',{status:'canceled'}),game('2026-10-15',{status:'final'})]);
    expect(row.total).toBe(2);expect(row.days.flat().every(game=>!game.backToBack)).toBe(true);
    expect(row.days[1][0].status).toBe('postponed');
  });
  it('never mixes preseason into the regular season grid',()=>{
    const row=boston([game('2026-10-12'),game('2026-10-13',{type:'preseason'})]);
    expect(row.total).toBe(1);expect(row.days[0][0].backToBack).toBe(false);
  });
  it('counts 14 days once and highlights pairs at both outer edges and the middle Sunday/Monday',()=>{
    const games=['2026-10-11','2026-10-12','2026-10-18','2026-10-19','2026-10-25','2026-10-26'].map(date=>game(date));
    games.push(game('2026-10-21',{status:'postponed'}),game('2026-10-22',{type:'preseason'}));
    const rows=buildScheduleRows({...board(games),weeks:2},'regular');
    expect(rows).toHaveLength(30);
    expect(rows.every(row=>row.days.length===14)).toBe(true);
    const row=rows.find(row=>row.team.id==='2')!;
    expect(row.total).toBe(4);
    for(const index of [0,6,7,13])expect(row.days[index][0].backToBack).toBe(true);
    expect(row.days[9][0].status).toBe('postponed');
    expect(rows.reduce((sum,row)=>sum+row.total,0)).toBe(8);
  });
  it('keeps 14 consecutive calendar days across year and DST boundaries',()=>{
    expect(weekDays('2026-12-28',2)).toHaveLength(14);
    expect(weekDays('2026-12-28',2).at(-1)).toBe('2027-01-10');
    const dates=weekDays('2026-10-26',2);
    expect(new Set(dates).size).toBe(14);
    expect(dates.at(-1)).toBe('2026-11-08');
  });
});

// ESPN 2026–27 regular-season phase bounds; its end timestamp is the Pacific day boundary.
const seasonBounds={year:2027,type:2,startDate:'2026-10-20T07:00Z',endDate:'2027-04-12T06:59Z'};
const season=parseScheduleSeason(seasonBounds,2027);
describe('regular-season Week numbering',()=>{
  it('keeps the published season calendar available without upstream metadata',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('Unavailable',{status:503})));
    expect(await getScheduleSeason(2027)).toEqual(season);
    await expect(getScheduleSeason(2028)).rejects.toThrow('503');
  });
  it('starts Week 1 on the Monday of opening week and stops at the final game week',()=>{
    expect(season).toEqual({year:2027,firstWeek:'2026-10-19',lastWeek:'2027-04-05'});
    expect(seasonWeeks(season)).toHaveLength(25);
    expect(seasonWeeks(season).at(-1)).toBe('2027-04-05');
    expect(seasonWeekNumber('2026-10-19',season)).toBe(1);
    expect(seasonWeekNumber('2026-10-26',season)).toBe(2);
    expect(seasonWeekNumber('2027-04-05',season)).toBe(25);
  });
  it('increments by natural weeks across New Year and daylight saving changes',()=>{
    expect(seasonWeekNumber('2026-12-28',season)).toBe(11);
    expect(seasonWeekNumber('2027-01-04',season)).toBe(12);
    expect(seasonWeekNumber('2027-03-08',season)).toBe(21);
    expect(seasonWeekNumber('2027-03-15',season)).toBe(22);
  });
  it('opens at Week 1 before the season and the last week after the season',()=>{
    expect(currentScheduleWeek('2026-10-14',season)).toBe('2026-10-19');
    expect(currentScheduleWeek('2026-10-25',season)).toBe('2026-10-19');
    expect(currentScheduleWeek('2026-10-26',season)).toBe('2026-10-26');
    expect(currentScheduleWeek('2027-05-01',season)).toBe('2027-04-05');
    expect(seasonWeekNumber('2026-10-12',season)).toBeNull();
    expect(seasonWeekNumber('2027-04-12',season)).toBeNull();
  });
  it('rejects missing, mismatched and invalid season metadata',()=>{
    for(const raw of [{},{...seasonBounds,year:2026},{...seasonBounds,type:1},{...seasonBounds,startDate:'bad'},{...seasonBounds,endDate:'2026-10-19T00:00Z'},{...seasonBounds,endDate:'2028-04-12T06:59Z'}]){
      expect(()=>parseScheduleSeason(raw,2027)).toThrow();
    }
  });
  it('keeps both weeks inside the season and shifts the final single week to the last pair',()=>{
    expect(seasonWeeks(season,2)).toHaveLength(24);
    expect(seasonWeeks(season,2).at(-1)).toBe('2027-03-29');
    expect(currentScheduleWeek('2026-10-14',season,2)).toBe('2026-10-19');
    expect(currentScheduleWeek('2026-10-28',season,2)).toBe('2026-10-26');
    expect(currentScheduleWeek('2027-04-05',season,2)).toBe('2027-03-29');
    expect(currentScheduleWeek('2027-05-01',season,2)).toBe('2027-03-29');
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
  it('preserves postponed game status',()=>{
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
  it('rejects unsupported week ranges before making upstream requests',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    for(const weeks of ['0','3','-1','1.5','02','bad','']){
      expect((await GET(new NextRequest(`http://localhost/api/schedule?week=2026-12-07&weeks=${weeks}`))).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('serves two weeks with both adjacent days and reuses daily cache from single-week reads',async()=>{
    const fetcher=vi.fn(async()=>Response.json({leagues:[{slug:'nba'}],events:[]}));vi.stubGlobal('fetch',fetcher);
    await getWeekSchedule('2026-12-07');
    expect(fetcher).toHaveBeenCalledTimes(9);
    const response=await GET(new NextRequest('http://localhost/api/schedule?week=2026-12-07&weeks=2'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({weekStart:'2026-12-07',weeks:2,games:[]});
    expect(fetcher).toHaveBeenCalledTimes(16);
    const requests=fetcher.mock.calls.flat().join(' ');
    expect(requests).toContain('20261206');expect(requests).toContain('20261221');
  });
  it('fails the complete two-week range when the second week is unavailable',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('20270210')?new Response('unavailable',{status:503}):Response.json({leagues:[{slug:'nba'}],events:[]})));
    const response=await GET(new NextRequest('http://localhost/api/schedule?week=2027-02-01&weeks=2'));
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const result=await response.json();
    expect(result).toMatchObject({error:expect.stringContaining('503')});expect(result).not.toHaveProperty('games');
  });
});
