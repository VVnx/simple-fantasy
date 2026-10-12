import {describe,it,expect,vi,afterEach} from 'vitest';
import {parseCore,parseGameLog,parseSearch} from '../lib/data/espn';
import {fetchJson} from '../lib/data/http';
import core25 from './fixtures/risacher-core-2025.json';
import core26 from './fixtures/risacher-core-2026.json';
import doncicCore from './fixtures/doncic-core-2026.json';
import doncicLog from './fixtures/doncic-log-2026.json';
import log25 from './fixtures/risacher-log-2025.json';
import log26 from './fixtures/risacher-log-2026.json';
import log27 from './fixtures/risacher-log-2027.json';
const regular={year:2025,type:'regular' as const};
const pre={year:2027,type:'preseason' as const};
afterEach(()=>vi.unstubAllGlobals());
describe('independently retrieved ESPN fixtures (2026-10-12)',()=>{
  it.each([[2025,core25,log25],[2026,core26,log26]] as const)('cross-checks %s raw season totals against independent game aggregation', (year,core,log)=>{
    const selection={year,type:'regular' as const};
    const a=parseCore(core,'5211175',selection),b=parseGameLog(log,selection).totals!;
    for(const key of ['gp','fgm','fga','ftm','fta','three','pts','reb','ast','st','blk','to','dd'] as const) expect(b[key]).toBe(a[key]);
    expect(a.gp).toBeGreaterThan(50);
  });
  it('excludes the live All-Star contamination in Doncic 2025–26',()=>{
    const selection={year:2026,type:'regular' as const};
    const core=parseCore(doncicCore,'3945274',selection),log=parseGameLog(doncicLog,selection).totals!;
    for(const key of ['gp','fgm','fga','ftm','fta','three','pts','reb','ast','st','blk','to','dd'] as const)expect(log[key]).toBe(core[key]);
    expect(log.gp).toBe(64);
  });
  it('excludes play-in and preseason from regular season',()=>{
    expect(parseGameLog(log25,regular).totals?.gp).toBe(75);
    expect(parseGameLog(log25,{year:2025,type:'preseason'}).totals?.gp).toBe(2);
  });
  it('gets the correct 2026–27 preseason and preserves zero FT vs missing percentage',()=>{
    const data=parseGameLog(log27,pre);
    expect(data.totals).toEqual({gp:2,min:48,fgm:11,fga:22,ftm:0,fta:0,three:3,pts:25,reb:11,ast:3,st:2,blk:1,to:4,dd:0});
    expect(data.notes.join('')).toContain('近似');
    expect(data.dataThrough).toBe('2026-10-11T10:00:00.000Z');
  });
  it('rejects wrong source year even if the request was correct',()=>{
    expect(()=>parseCore(core26,'5211175',regular)).toThrow('不匹配');
    expect(()=>parseGameLog(log25,pre)).toThrow('其他赛季');
  });
  it('rejects a different athlete and team-only splits',()=>{
    expect(()=>parseCore(core25,'1966',regular)).toThrow('不匹配');
    const d=structuredClone(core25);d.splits.type='team';
    expect(()=>parseCore(d,'5211175',regular)).toThrow('不匹配');
  });
  it('never turns a missing core field into zero',()=>{
    const d=structuredClone(core25);
    for(const c of d.splits.categories)c.stats=c.stats.filter(s=>s.name!=='steals');
    expect(parseCore(d,'5211175',regular).st).toBeNull();
  });
  it('recognizes the observed rookie no-history response without inventing zero GP',()=>{
    expect(parseGameLog({filters:[{name:'league',value:'nba'}]},regular).totals).toBeNull();
    expect(()=>parseGameLog({filters:[]},regular)).toThrow('结构');
  });
  it('does not represent a missing season segment as zero appearances',()=>{
    expect(parseGameLog(log27,{year:2027,type:'regular'}).totals).toBeNull();
  });
  it('rejects unexpected response shape instead of empty success',()=>{
    expect(()=>parseGameLog({},pre)).toThrow('结构');
    expect(()=>parseCore({error:'forbidden'},'5211175',regular)).toThrow('结构');
  });
  it('deduplicates events and rejects conflicting duplicates',()=>{
    const d=structuredClone(log27),category=d.seasonTypes[0].categories[0];
    category.events!.push(structuredClone(category.events![0]));
    expect(parseGameLog(d,pre).totals?.gp).toBe(2);
    category.events!.at(-1)!.stats[0]='99';
    expect(()=>parseGameLog(d,pre)).toThrow('冲突');
  });
  it('uses field names rather than fixed positions',()=>{
    const d=structuredClone(log27);d.names.reverse();
    for(const t of d.seasonTypes)for(const c of t.categories)for(const e of c.events??[])e.stats.reverse();
    expect(parseGameLog(d,pre).totals).toEqual(parseGameLog(log27,pre).totals);
  });
  it('counts a triple-double once and missing DD inputs as unknown',()=>{
    const d=structuredClone(log27),events=d.seasonTypes[0].categories[0].events!;
    for(const name of ['points','totalRebounds','assists'])events[0].stats[d.names.indexOf(name)]='10';
    expect(parseGameLog(d,pre).totals?.dd).toBe(1);
    events[1].stats[d.names.indexOf('blocks')]='--';
    const totals=parseGameLog(d,pre).totals!;
    expect(totals.blk).toBeNull();expect(totals.dd).toBeNull();expect(totals.pts).toBe(19);
  });
  it('keeps a real zero-minute appearance and zero points',()=>{
    const d=structuredClone(log27),event=d.seasonTypes[0].categories[0].events![0];
    event.stats[d.names.indexOf('minutes')]='0';event.stats[d.names.indexOf('points')]='0';
    expect(parseGameLog(d,pre).totals?.gp).toBe(2);
    expect(parseGameLog(d,pre).totals?.pts).toBe(9);
  });
  it('rejects incomplete or in-progress events',()=>{
    const d=structuredClone(log27);Object.values(d.events)[0].gameResult='';
    expect(()=>parseGameLog(d,pre)).toThrow('结构');
  });
  it('rejects impossible shooting totals and missing GP',()=>{
    const d=structuredClone(core25);
    for(const c of d.splits.categories)for(const stat of c.stats)if(stat.name==='fieldGoalsMade')stat.value=9999;
    expect(()=>parseCore(d,'5211175',regular)).toThrow('结构');
    for(const c of d.splits.categories)c.stats=c.stats.filter(s=>s.name!=='gamesPlayed');
    expect(()=>parseCore(d,'5211175',regular)).toThrow('结构');
  });
});
describe('search and transport contracts',()=>{
  it('filters other sports, preserves distinct people with similar names',()=>{
    const players=parseSearch({results:[{type:'player',contents:[{uid:'s:40~l:46~a:1',displayName:'LeBron James',subtitle:'Lakers'},{uid:'s:40~l:46~a:2',displayName:'Bronny James',subtitle:'Lakers'},{uid:'s:20~l:1~a:3',displayName:'James Smith'}]}]});
    expect(players.map(p=>p.id)).toEqual(['1','2']);
  });
  it('recognizes empty search but not malformed nonempty response',()=>{
    expect(parseSearch({})).toEqual([]);expect(()=>parseSearch({unexpected:true})).toThrow('结构');
  });
  it('reports denial without retries or header impersonation',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response('denied',{status:403}));vi.stubGlobal('fetch',fetch);
    await expect(fetchJson('https://example.com')).rejects.toThrow('HTTP 403');expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('distinguishes not found and timeout',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:404})));
    await expect(fetchJson('https://example.com')).rejects.toMatchObject({code:'NOT_FOUND'});
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('Timed out','TimeoutError')));
    await expect(fetchJson('https://example.com')).rejects.toMatchObject({code:'TIMEOUT'});
  });
});
