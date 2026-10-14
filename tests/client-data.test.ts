import {afterEach,describe,expect,it,vi} from 'vitest';
import {readWithPublicFallback,readPlayerSeason,readPlayerSearch} from '../lib/data/client';
import core from './fixtures/risacher-core-2025.json';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const signal=()=>new AbortController().signal;
const denied=()=>Response.json({code:'UPSTREAM_DENIED',error:'HTTP 403'},{status:502});
describe('public browser data fallback',()=>{
  it('keeps successful server data and does not issue another upstream read',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({row:'server'})));
    const fallback=vi.fn();
    expect(await readWithPublicFallback('/api/stats',fallback,signal())).toEqual({row:'server'});
    expect(fallback).not.toHaveBeenCalled();
  });
  it('does not mask ordinary server errors with fallback data',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({code:'SCHEMA',error:'字段变化'},{status:502})));
    const fallback=vi.fn();
    await expect(readWithPublicFallback('/api/stats',fallback,signal())).rejects.toThrow('字段变化');
    expect(fallback).not.toHaveBeenCalled();
  });
  it('reuses the validated statistics adapter after an explicit server denial',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(denied()).mockResolvedValueOnce(Response.json(core));vi.stubGlobal('fetch',fetcher);
    const result=await readPlayerSeason('5211175',{year:2025,type:'regular'},signal());
    expect(result.row.totals).toMatchObject({gp:75,oreb:86});
    expect(fetcher.mock.calls[1][0]).toBe('https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2025/types/2/athletes/5211175/statistics/0');
    expect(fetcher.mock.calls[1][1].credentials).toBe('omit');
    expect(fetcher.mock.calls[1][1].headers).toEqual({Accept:'application/json'});
  });
  it('keeps player identity and Chinese alias resolution on the public search path',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(denied()).mockResolvedValueOnce(Response.json({results:[{type:'player',contents:[{uid:'s:40~l:46~a:4431680',displayName:'Onyeka Okongwu',subtitle:'Atlanta Hawks'}]}]}));vi.stubGlobal('fetch',fetcher);
    const result=await readPlayerSearch('奥孔古',signal());
    expect(result.players[0]).toMatchObject({id:'4431680',name:'Onyeka Okongwu'});
    expect(result.resolvedQuery).toBe('Onyeka Okongwu');
  });
  it('discards a fallback result when the user has changed their selection',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>denied()));
    const controller=new AbortController();
    await expect(readWithPublicFallback('/api/stats',async()=>{controller.abort();return {old:true};},controller.signal)).rejects.toMatchObject({name:'AbortError'});
  });
  it('preserves a denied or unavailable browser source as an error',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>denied()));
    await expect(readWithPublicFallback('/api/stats',async()=>{throw new Error('浏览器读取失败');},signal())).rejects.toThrow('浏览器读取失败');
  });
});
