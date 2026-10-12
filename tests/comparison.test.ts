import {describe,it,expect} from 'vitest';
import {averageMinutes,minuteConversion,statCells,comparisonSelections,doubleDoubleCell,tableSelectionLabel} from '../lib/format';
import {parseCore,parseGameLog} from '../lib/data/espn';
import type {SeasonRow} from '../lib/types';
import core25 from './fixtures/risacher-core-2025.json';
import core26 from './fixtures/risacher-core-2026.json';
import log27 from './fixtures/risacher-log-2027.json';
const meta={status:'ok' as const,fetchedAt:'2026-10-12T00:00:00Z',dataThrough:null,sources:[{label:'ESPN',url:'https://espn.com'}],notes:[]};
const a:SeasonRow={...meta,year:2025,type:'regular',totals:parseCore(core25,'5211175',{year:2025,type:'regular'}),minutePrecision:'season-total'};
const b:SeasonRow={...meta,year:2026,type:'regular',totals:parseCore(core26,'5211175',{year:2026,type:'regular'}),minutePrecision:'season-total'};
const pre:SeasonRow={...meta,year:2027,type:'preseason',totals:parseGameLog(log27,{year:2027,type:'preseason'}).totals,minutePrecision:'rounded-game-minutes'};
describe('totals and minute-normalized preseason presentation',()=>{
  it('uses exact source totals, not rounded per-game values multiplied by GP',()=>{
    expect(statCells(a.totals,{mode:'total'})).toEqual(['75','1843','357/779','.458','106/149','.711','122','942','268','92','52','37','92','1.000','1（1.3%）','86']);
    expect(statCells(b.totals,{mode:'total'})[7]).toBe('641');
    expect(statCells({...a.totals!,min:1843.5},{mode:'total'})[1]).toBe('1843.5');
  });
  it.each([a,b])('uses unrounded minute ratios for historical year $year',target=>{
    const conversion=minuteConversion(pre,target)!;
    const expected=(target.totals!.min!/target.totals!.gp)/(48/2);
    expect(conversion.factor).toBe(expected);
    expect(conversion.targetMinutes).toBe(target.totals!.min!/target.totals!.gp);
    const cells=statCells(pre.totals,{conversion});
    expect(cells[1]).toBe(conversion.targetMinutes.toFixed(1));
    expect(cells[7]).toBe((25/2*expected).toFixed(2));
    expect(cells[2]).toBe(`${(11/2*expected).toFixed(2)}/${(22/2*expected).toFixed(2)}`);
    const actual=statCells(pre.totals);
    for(const i of [0,3,5,13,14])expect(cells[i]).toBe(actual[i]);
  });
  it('preserves zero, missing fields and zero denominators',()=>{
    const conversion=minuteConversion(pre,a)!;
    const cells=statCells({...pre.totals!,st:null,blk:0,to:0},{conversion});
    expect(cells[10]).toBe('—');expect(cells[11]).toBe('0.00');expect(cells[5]).toBe('—');expect(cells[13]).toBe('—');
    expect(statCells(null,{conversion})).toEqual(Array(16).fill('—'));
  });
  it('disables unavailable or invalid minute targets and sources without division by zero',()=>{
    for(const min of [null,0,-1,Infinity,NaN]){
      const invalid={...a,totals:{...a.totals!,min}};
      expect(averageMinutes(invalid)).toBeNull();expect(minuteConversion(pre,invalid)).toBeUndefined();
      expect(minuteConversion({...pre,totals:{...pre.totals!,min}},a)).toBeUndefined();
    }
    expect(minuteConversion(pre,{...a,status:'unavailable',totals:null})).toBeUndefined();
    expect(minuteConversion(undefined,a)).toBeUndefined();
    expect(minuteConversion({...pre,totals:{...pre.totals!,gp:0}},a)).toBeUndefined();
    expect(minuteConversion(a,b)).toBeUndefined();expect(minuteConversion(pre,pre)).toBeUndefined();
  });
  it('never mutates observed totals or applies conversion to totals rows',()=>{
    const before=JSON.stringify(pre);
    const conversion=minuteConversion(pre,a)!;
    statCells(pre.totals,{conversion});
    expect(JSON.stringify(pre)).toBe(before);
    expect(statCells(a.totals,{mode:'total',conversion})).toEqual(statCells(a.totals,{mode:'total'}));
  });
});

describe('one additional comparison row and DD appearance share',()=>{
  const currentRegular={year:2027,type:'regular' as const};
  const selected=[a,b,pre,currentRegular];
  it('preserves the observed preseason row and adds exactly one adjacent converted row',()=>{
    const original=comparisonSelections(selected);
    expect(original).toHaveLength(8);expect(original.some(s=>s.converted)).toBe(false);
    const converted=comparisonSelections(selected,pre);
    expect(converted).toHaveLength(9);
    expect(converted[2]).toMatchObject({year:2027,type:'preseason',mode:'average'});
    expect(converted[2].converted).toBeUndefined();
    expect(converted[3]).toMatchObject({year:2027,type:'preseason',converted:true});
    expect(converted[4]).toMatchObject(currentRegular);
    for(let i=0;i<3;i++)expect(comparisonSelections(selected,pre).filter(s=>s.converted)).toHaveLength(1);
    expect(comparisonSelections(selected)).toHaveLength(8);
    expect(comparisonSelections([a,b,currentRegular],pre).some(s=>s.converted)).toBe(false);
  });
  it('includes raw totals for every event and labels average/conversion/total separately',()=>{
    const rows=comparisonSelections(selected,pre);
    expect(rows.slice(-4)).toEqual(selected.map(s=>({...s,mode:'total'})));
    expect(rows.filter(s=>s.mode==='total').some(s=>s.converted)).toBe(false);
    expect(tableSelectionLabel(rows[2])).toBe('2026–27 季前赛 · 平均');
    expect(tableSelectionLabel(rows[3])).toBe('2026–27 季前赛 · 换算');
    expect(tableSelectionLabel(rows[7])).toBe('2026–27 季前赛 · 总计');
    expect(tableSelectionLabel(rows[8])).toBe('2026–27 常规赛 · 总计');
    expect(statCells(pre.totals,{mode:'total'})[1]).toBe('48');
    expect(statCells(pre.totals,{mode:'total'})[7]).toBe('25');
  });
  it('scales OREB only when observed and never converts totals',()=>{
    const conversion=minuteConversion(pre,a)!;
    expect(statCells({...pre.totals!,oreb:3},{conversion})[15]).toBe((3/2*conversion.factor).toFixed(2));
    expect(statCells({...pre.totals!,oreb:3},{mode:'total',conversion})[15]).toBe('3');
    expect(statCells({...pre.totals!,oreb:0},{conversion})[15]).toBe('0.00');
    expect(statCells(pre.totals,{conversion})[15]).toBe('—');
  });
  it('uses real DD and GP for percentages, preserving zero vs missing',()=>{
    expect(doubleDoubleCell(a.totals)).toBe('1（1.3%）');
    expect(doubleDoubleCell(b.totals)).toBe('0（0.0%）');
    expect(doubleDoubleCell({...a.totals!,dd:10,gp:10})).toBe('10（100.0%）');
    expect(doubleDoubleCell({...a.totals!,dd:null})).toBe('—');
    expect(doubleDoubleCell({...a.totals!,dd:0,gp:0})).toBe('—');
    expect(doubleDoubleCell(null)).toBe('—');
    const conversion=minuteConversion(pre,a);
    const ddSample={...pre.totals!,dd:1};
    expect(statCells(ddSample,{conversion})[14]).toBe('1（50.0%）');
    expect(statCells(ddSample,{mode:'total'})[14]).toBe('1（50.0%）');
  });
});
