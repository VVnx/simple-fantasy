import { describe, expect, it } from 'vitest';
import { createScheduleExport } from '../lib/schedule-export';
import { NBA_TEAMS, type ScheduleGame, type WeekSchedule } from '../lib/schedule';

const season={year:2027,firstWeek:'2026-10-19',lastWeek:'2027-04-05'};
function game(date:string,overrides:Partial<ScheduleGame>={}):ScheduleGame {
  return {id:date,date,tipoff:`${date}T23:00:00Z`,timeKnown:true,homeId:'2',awayId:'13',homeName:'凯尔特人',awayName:'湖人',type:'regular',neutral:false,status:'scheduled',...overrides};
}
function data(weeks:1|2,games:ScheduleGame[]=[]):WeekSchedule {
  return {weekStart:'2026-10-19',weeks,games,fetchedAt:'2026-10-19T03:00:00Z',source:'ESPN'};
}

describe('schedule image export',()=>{
  it('includes every team and seven dates in a full-height single-week image',()=>{
    const result=createScheduleExport(data(1),{season});
    for(const team of NBA_TEAMS)expect(result.svg.match(new RegExp(`>${team.abbreviation}</text>`, 'g'))).toHaveLength(1);
    expect(result.svg).toContain('10/19');expect(result.svg).toContain('10/25');
    expect(result.svg).not.toContain('10/26');
    expect(result.filename).toBe('NBA-Fantasy-单周-W1-2026-10-19.png');
    expect(result.width).toBe(1200);expect(result.height).toBeGreaterThan(30*40);
  });

  it('matches the page with both weeks side by side and one total per team, excluding adjacent days',()=>{
    const result=createScheduleExport(data(2,[game('2026-10-18'),game('2026-10-19'),game('2026-10-25'),game('2026-10-26'),game('2026-11-02')]),{season});
    for(const team of NBA_TEAMS)expect(result.svg.match(new RegExp(`>${team.abbreviation}</text>`, 'g'))).toHaveLength(1);
    expect(result.svg).toContain('Week 1');expect(result.svg).toContain('Week 2');
    expect(result.svg).toContain('11/1');expect(result.svg).not.toContain('11/2');
    // BOS and LAL each have one total covering all fourteen dates.
    expect(result.svg.match(/font-weight="600">3<\/text>/g)).toHaveLength(2);
    expect(result.svg).not.toMatch(/font-weight="600">5<\/text>/);
    expect(result.svg.indexOf('>BOS<')).toBeLessThan(result.svg.indexOf('>ATL<'));
    const single=createScheduleExport(data(1),{season});
    expect(result.width).toBeGreaterThan(single.width);
    expect(result.height-single.height).toBe(32);
    const headers=[...result.svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>Week [12]<\/text>/g)];
    expect(headers).toHaveLength(2);
    expect(Number(headers[1][1])).toBeGreaterThan(Number(headers[0][1]));
    expect(headers[1][2]).toBe(headers[0][2]);
    expect(result.svg).not.toContain('>本周<');
    expect(result.filename).toContain('双周-W1-2');
    expect(result.svg).toContain('fill="#e4f3ea" rx="4"');
  });

  it('keeps cancellations visible but out of totals, excludes preseason and escapes opponent labels',()=>{
    const result=createScheduleExport(data(1,[
      game('2026-10-19',{awayName:'<script>alert(1)</script> & 对手'}),
      game('2026-10-20',{status:'postponed'}),
      game('2026-10-21',{status:'canceled'}),
      game('2026-10-22',{type:'preseason',awayName:'季前对手'}),
    ]),{season});
    expect(result.svg).toContain('&lt;script&gt;');expect(result.svg).not.toContain('<script>');
    expect(result.svg).toContain('延期');expect(result.svg).toContain('取消');
    expect(result.svg).not.toContain('季前对手');
    expect(result.svg.match(/font-weight="600">1<\/text>/g)).toHaveLength(2);
    expect(result.svg).not.toContain('fill="#e4f3ea" rx="4"');
  });

  it('preserves ascending sorting and a 14-day window across New Year',()=>{
    const result=createScheduleExport({...data(2,[game('2026-12-28')]),weekStart:'2026-12-28'},{season,direction:'ascending'});
    expect(result.svg.indexOf('>ATL<')).toBeLessThan(result.svg.indexOf('>BOS<'));
    expect(result.svg).toContain('2026-12-28 — 2027-01-10');
    expect(result.filename).toContain('W11-12');
  });

  it('does not create an out-of-season export',()=>{
    expect(()=>createScheduleExport({...data(2),weekStart:'2027-04-05'},{season})).toThrow('超出');
    expect(()=>createScheduleExport({...data(1),weekStart:'2026-10-12'},{season})).toThrow('有效');
  });
});
