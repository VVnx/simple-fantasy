import { headers, rowCells, createCsv } from './format';
import { selectionLabel } from './seasons';
import type { SeasonRow } from './types';
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download=name;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function exportCsv(name: string, rows: SeasonRow[]) {
  download(new Blob([createCsv(name,rows)],{type:'text/csv;charset=utf-8;'}),`${name}-11cat.csv`);
}
export async function exportPng(name: string, rows: SeasonRow[]) {
  await document.fonts.ready;
  const canvas=document.createElement('canvas');
  const widths=[220,66,85,160,82,150,82,82,82,82,82,72,72,72,90,62];
  const width=widths.reduce((a,b)=>a+b,0)+64;
  const notes=[
    'GP = 出场数；MIN = 场均分钟。除 GP、DD 外，计数均为场均；FG%、FT%、A/T 按总数计算。',
    'DD = 两双总次数（含三双）；— = 缺失或分母为 0。MIN ≈ 表示源逐场分钟舍入后的近似值。',
    ...rows.flatMap(r=>[`${selectionLabel(r)} · 读取 ${r.fetchedAt} · ${r.status==='ok'?'ESPN':'暂无记录'}`, ...r.notes.map(n=>`  ${n}`),...r.sources.map(s=>`  ${s.url}`)]),
  ];
  const height=190+rows.length*68+notes.length*26+42;
  const scale=2;canvas.width=width*scale;canvas.height=height*scale;
  const c=canvas.getContext('2d');if(!c)throw new Error('无法创建图片，请尝试 CSV。');
  c.scale(scale,scale);c.fillStyle='#fff';c.fillRect(0,0,width,height);
  const font=(size:number,bold=false)=>{c.font=`${bold?600:400} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;};
  c.fillStyle='#162d48';font(30,true);c.fillText(`${name} · 场均数据对比`,32,52);
  c.fillStyle='#65758a';font(19);c.fillText('SIMPLE FANTASY  /  Yahoo Fantasy 11 CAT',32,88);
  const drawRow=(cells:string[],y:number,header=false)=>{
    c.fillStyle=header?'#eaf2fc':'#fff';c.fillRect(0,y,width,68);
    c.strokeStyle='#dae4ef';c.beginPath();c.moveTo(0,y+68);c.lineTo(width,y+68);c.stroke();
    c.fillStyle='#253a54';font(header?17:19,header);let x=32;
    cells.forEach((cell,i)=>{c.textAlign=i?'center':'left';c.fillText(cell,i?x+widths[i]/2:x,y+42);x+=widths[i];});c.textAlign='left';
  };
  drawRow(headers,122,true);
  rows.forEach((row,i)=>{const cells=rowCells(row);if(row.minutePrecision==='rounded-game-minutes'&&row.totals)cells[2]+=' ≈';drawRow(cells,190+i*68);});
  c.fillStyle='#617287';font(14);notes.forEach((line,i)=>c.fillText(line,32,190+rows.length*68+34+i*26));
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('图片生成失败，请尝试 CSV。');
  download(blob,`${name}-场均对比-11cat.png`);
}
