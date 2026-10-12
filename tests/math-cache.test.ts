import {describe,it,expect,vi} from 'vitest';
import {RequestCache} from '../lib/data/cache';
import {defaultSelections,currentEndYear} from '../lib/seasons';
import {statCells,ratio,createCsv} from '../lib/format';
import {resolveSearch} from '../lib/aliases';
import type {Totals,SeasonRow} from '../lib/types';
const totals:Totals={gp:3,min:75,fgm:10,fga:21,ftm:0,fta:0,three:4,pts:24,reb:14,ast:7,st:1,blk:0,to:3,dd:1};
describe('math and presentation',()=>{
  it('divides totals once and keeps GP/DD as totals',()=>{
    expect(statCells(totals)).toEqual(['3','25.0','3.33/7.00','.476','0.00/0.00','—','1.33','8.00','4.67','2.33','0.33','0.00','1.00','2.333','1']);
  });
  it('uses totals for shooting and A/T rather than rounded averages',()=>{
    expect(ratio(7,3,'at')).toBe('2.333');expect(ratio(1,6)).toBe('.167');
    expect(ratio(0,6)).toBe('.000');expect(ratio(1,0)).toBe('—');expect(ratio(null,6)).toBe('—');expect(ratio(4,0,'at')).toBe('—');
  });
  it('does not divide by zero appearances',()=>{
    expect(statCells({...totals,gp:0,min:0,dd:0})[1]).toBe('—');expect(statCells(null)).toEqual(Array(15).fill('—'));
  });
  it('exports BOM, provenance, and formula-safe names',()=>{
    const row:SeasonRow={year:2027,type:'preseason',totals,status:'ok',fetchedAt:'2026-10-12T00:00:00Z',dataThrough:null,sources:[{label:'ESPN',url:'https://espn.com'}],notes:['MIN 近似'],minutePrecision:'rounded-game-minutes'};
    const csv=createCsv('=HYPERLINK("bad")',[row]);
    expect(csv.startsWith('\uFEFF')).toBe(true);expect(csv).toContain("'=HYPERLINK");expect(csv).toContain('https://espn.com');expect(csv).toContain('MIN 近似');
  });
  it('computes the required defaults dynamically and crosses year boundaries',()=>{
    expect(defaultSelections(new Date('2026-10-12Z'))).toEqual([{year:2025,type:'regular'},{year:2026,type:'regular'},{year:2027,type:'preseason'}]);
    expect(currentEndYear(new Date('2027-01-01Z'))).toBe(2027);
    expect(defaultSelections(new Date('2027-10-12Z'))[0].year).toBe(2026);
    expect(defaultSelections(new Date('2026-02-01Z'))[1].year).toBe(2025);
    expect(defaultSelections(new Date('2026-05-01Z'))[1].year).toBe(2026);
  });
  it('resolves Chinese variants, normalizes accents, and keeps surnames ambiguous',()=>{
    expect(resolveSearch('里薩謝')).toBe('Zaccharie Risacher');expect(resolveSearch('詹姆斯')).toBe('James');expect(resolveSearch('库里')).toBe('Curry');expect(resolveSearch('Nikola Jokić')).toBe('Nikola Jokic');expect(resolveSearch('未收录')).toBe('未收录');
  });
});
describe('bounded request coalescing and cache',()=>{
  it('coalesces concurrent and repeat requests, retains source timestamp until expiry',async()=>{
    let now=0;const cache=new RequestCache(2,()=>now),load=vi.fn(async()=>({fetchedAt:now}));
    const values=await Promise.all(Array.from({length:8},()=>cache.get('same',100,load)));
    expect(load).toHaveBeenCalledTimes(1);expect(values.every(v=>v.fetchedAt===0)).toBe(true);
    now=99;expect((await cache.get('same',100,load)).fetchedAt).toBe(0);
    now=101;expect((await cache.get('same',100,load)).fetchedAt).toBe(101);expect(load).toHaveBeenCalledTimes(2);
  });
  it('cooldowns failed requests but does not poison success forever',async()=>{
    let now=0;const cache=new RequestCache(2,()=>now),loader=vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('ok');
    await expect(cache.get('key',100,loader)).rejects.toThrow('down');
    await expect(cache.get('key',100,loader)).rejects.toThrow('down');expect(loader).toHaveBeenCalledTimes(1);
    now=15001;expect(await cache.get('key',100,loader)).toBe('ok');
  });
  it('bounds entries and isolates season/athlete keys',async()=>{
    const cache=new RequestCache(2);let count=0;const loader=async()=>++count;
    await cache.get('1',10000,loader);await cache.get('2',10000,loader);await cache.get('3',10000,loader);
    expect(await cache.get('1',10000,loader)).toBe(4);expect(await cache.get('3',10000,loader)).toBe(3);
  });
});
