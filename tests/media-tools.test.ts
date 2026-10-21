import {describe,it,expect} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import reports from '../data/tools/poster-reports.json';
import seed from '../data/tools/publications.json';
import {normalizePosterReport,parsePosterImport,wrapPosterText} from '../lib/poster-report';
import {parseBackup,serializeBackup,validateUrl,validateDate} from '../lib/publication-records';
import {zipFiles} from '../lib/download';

describe('migrated media tools',()=>{
  it('retains every archived team and resolves every attached image locally',()=>{
    expect(reports.map(r=>r.cards.length)).toEqual([10,8,10,4]);
    for(const report of reports)for(const card of normalizePosterReport(report).cards)for(const p of [...card.prediction.players,...card.actual.players])expect(existsSync(`public${p.avatar}`)).toBe(true);
    expect(seed.teams).toHaveLength(30);
    for(const team of seed.teams)for(const attachment of [team.draftPlan,team.startingFive])expect(existsSync(`public${attachment.image}`)).toBe(true);
    expect(parseBackup(serializeBackup(seed.teams),seed.teams)).toEqual(seed.teams);
  });
  it('imports original report data and preserves explicit empty copy without reading local or remote paths',()=>{
    const input=structuredClone(reports[0]);input.cards[0].poster.paragraphs=[];input.cards[0].prediction.players[0].avatar='../../assets/portraits/old.png';
    const parsed=normalizePosterReport(input);
    expect(parsed.cards[0].poster.paragraphs).toEqual([]);
    expect(parsed.cards[0].prediction.players[0].avatar).toMatch(/^\/tools\/assets\//);
    input.cards[0].prediction.players[0].name='Unknown Test Player';input.cards[0].prediction.players[0].avatar='https://example.test/track';
    expect(normalizePosterReport(input).cards[0].prediction.players[0].avatar).toBe('');
    expect(parsePosterImport(JSON.stringify({version:1,reports}))).toHaveLength(4);
    expect(()=>parsePosterImport(JSON.stringify({version:1,reports:[reports[0],reports[0]]}))).toThrow('重复日期');
    expect(()=>normalizePosterReport({...reports[0],reportDate:'2026-02-30'})).toThrow();
    expect(()=>normalizePosterReport({...reports[0],cards:[reports[0].cards[0],reports[0].cards[0]]})).toThrow('重复');
  });
  it('rejects malformed publication backups, credentials in URLs and impossible dates',()=>{
    const bad=JSON.parse(serializeBackup(seed.teams));bad.teams[0].id=bad.teams[1].id;
    expect(()=>parseBackup(JSON.stringify(bad),seed.teams)).toThrow();
    expect(()=>validateUrl('https://user:secret@mp.weixin.qq.com/s/anything')).toThrow();
    expect(()=>validateDate('2026-02-30T10:00')).toThrow();
  });
  it('wraps long Chinese and English notes without losing characters',()=>{
    const text='乔治太强了，Paul George命中7记三分！';
    const lines=wrapPosterText(text,12,t=>[...t].length);
    expect(lines.every(line=>[...line].length<=12)).toBe(true);
    expect(lines.join('').replaceAll(' ','')).toBe(text.replaceAll(' ',''));
    expect(lines.some(line=>/^[，！]/.test(line))).toBe(false);
  });
  it('writes valid UTF-8 ZIP entries with unmodified payloads',async()=>{
    const bytes=new TextEncoder().encode('example image bytes');
    const zip=new Uint8Array(await zipFiles([{name:'勇士-1.png',bytes}]).arrayBuffer());
    const data=new DataView(zip.buffer),nameLength=data.getUint16(26,true);
    expect(data.getUint32(0,true)).toBe(0x04034b50);
    expect(data.getUint16(6,true)).toBe(0x0800);
    expect(new TextDecoder().decode(zip.slice(30,30+nameLength))).toBe('勇士-1.png');
    expect(zip.slice(30+nameLength,30+nameLength+bytes.length)).toEqual(bytes);
    expect(data.getUint32(zip.length-22,true)).toBe(0x06054b50);
    expect(data.getUint16(zip.length-12,true)).toBe(1);
  });
  it('keeps both standalone tools executable and all extracted images resolvable',()=>{
    for(const name of ['charts','rotation']){
      const html=readFileSync(`public/tools/${name}/index.html`,'utf8');
      for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!match[1].includes('application/json'))expect(()=>new Script(match[2])).not.toThrow();
      for(const path of new Set(html.match(/\/tools\/assets\/[a-f0-9]{24}\.(?:png|webp|jpg)/g)))expect(existsSync(`public${path}`)).toBe(true);
    }
  });
});
