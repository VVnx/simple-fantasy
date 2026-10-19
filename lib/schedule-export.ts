import { addDays, buildScheduleRows, countsAsGame, seasonWeekNumber, shortDate, weekday, weekDays, type ScheduleSeason, type TeamGame, type WeekSchedule } from './schedule';
import { seasonLabel } from './seasons';

type ExportOptions = {season:ScheduleSeason; direction?:'ascending'|'descending'};
const colors = {ink:'#20344d', muted:'#768498', line:'#e2e9f0', pale:'#ecf3fc', green:'#e4f3ea', greenInk:'#28684d', red:'#fde8e7', redInk:'#9c6464'};
const escape = (value:string|number) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));

// Render from the same schedule model as the grid, never from its clipped viewport.
export function createScheduleExport(data:WeekSchedule, {season,direction='descending'}:ExportOptions) {
  const firstWeek=seasonWeekNumber(data.weekStart,season);
  if(firstWeek===null || ![1,2].includes(data.weeks))throw new Error('请选择有效的赛程范围。');
  const dates=weekDays(data.weekStart,data.weeks);
  if(addDays(data.weekStart,7*(data.weeks-1))>season.lastWeek)throw new Error('导出范围超出了常规赛。');
  const rows=buildScheduleRows(data,'regular').sort((a,b)=>
    (direction==='ascending'?a.total-b.total:b.total-a.total)||a.team.abbreviation.localeCompare(b.team.abbreviation),
  );
  const width=1200, left=32, tableWidth=width-left*2, teamWidth=132, countWidth=64;
  const hasTotal=data.weeks===2;
  const dayLeft=left+teamWidth+countWidth*(hasTotal?2:1), dayWidth=(width-left-dayLeft)/7;
  const parts:string[]=[];
  const rect=(x:number,y:number,w:number,h:number,fill:string,extra='')=>parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`);
  const text=(x:number,y:number,value:string|number,size=15,fill=colors.ink,anchor='start',weight=400)=>parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${escape(value)}</text>`);
  const line=(x1:number,y1:number,x2:number,y2:number)=>parts.push(`<path d="M${x1} ${y1}H${x2}V${y2}" fill="none" stroke="${colors.line}"/>`);
  const period=data.weeks===2?'双周':'单周';
  text(left,44,`NBA Fantasy ${period}赛程`,28,colors.ink,'start',600);
  text(left,72,`${seasonLabel(season.year)} 常规赛 · ${data.weekStart} — ${dates.at(-1)} · 美东日期`,14,colors.muted);
  rect(left,91,12,12,colors.green);text(left+19,102,'背靠背',12,colors.muted);
  rect(left+112,91,12,12,colors.green);text(left+131,102,'最多场次',12,colors.muted);
  rect(left+238,91,12,12,colors.red);text(left+257,102,'最少场次',12,colors.muted);
  if(hasTotal)text(width-left,102,`按两周总场次${direction==='descending'?'从多到少':'从少到多'}排列`,12,colors.muted,'end');
  let y=132;
  const allTotals=rows.map(row=>row.total), minTotal=Math.min(...allTotals), maxTotal=Math.max(...allTotals);
  const countColor=(value:number,min:number,max:number)=>max===min?'#fff':value===max?colors.green:value===min?colors.red:'#fff';

  for(let panel=0;panel<data.weeks;panel++){
    const panelDates=dates.slice(panel*7,panel*7+7);
    text(left,y+20,`Week ${firstWeek+panel} · ${shortDate(panelDates[0])} — ${shortDate(panelDates[6])}`,18,colors.ink,'start',600);
    y+=34;
    const tableTop=y;
    rect(left,y,tableWidth,52,colors.pale);
    text(left+16,y+31,'球队',14,colors.ink,'start',600);
    if(hasTotal)text(left+teamWidth+countWidth/2,y+31,'两周',14,colors.ink,'middle',600);
    text(dayLeft-countWidth/2,y+31,hasTotal?'本周':'场次',14,colors.ink,'middle',600);
    panelDates.forEach((date,i)=>{
      const x=dayLeft+dayWidth*(i+.5);
      text(x,y+22,weekday(date),14,colors.ink,'middle',600);
      text(x,y+40,shortDate(date),12,colors.muted,'middle');
    });
    y+=52;
    const panelTotals=rows.map(row=>row.days.slice(panel*7,panel*7+7).flat().filter(countsAsGame).length);
    const minWeek=Math.min(...panelTotals), maxWeek=Math.max(...panelTotals);
    rows.forEach((row,index)=>{
      const days=row.days.slice(panel*7,panel*7+7);
      const rowHeight=Math.max(40,...days.map(games=>games.length*30+10));
      rect(left,y,tableWidth,rowHeight,index%2===0?'#fff':'#fcfdff');
      text(left+16,y+18,row.team.name,14,colors.ink,'start',500);
      text(left+16,y+33,row.team.abbreviation,10,colors.muted);
      if(hasTotal){
        rect(left+teamWidth,y,countWidth,rowHeight,countColor(row.total,minTotal,maxTotal));
        text(left+teamWidth+countWidth/2,y+rowHeight/2+6,row.total,19,colors.ink,'middle',600);
      }
      rect(dayLeft-countWidth,y,countWidth,rowHeight,countColor(panelTotals[index],minWeek,maxWeek));
      text(dayLeft-countWidth/2,y+rowHeight/2+6,panelTotals[index],19,colors.ink,'middle',600);
      days.forEach((games,day)=>{
        const x=dayLeft+day*dayWidth;
        if(!games.length)text(x+dayWidth/2,y+rowHeight/2+5,'—',14,'#bcc8d6','middle');
        games.forEach((game:TeamGame,slot)=>{
          const top=y+(rowHeight-games.length*30)/2+slot*30;
          const canceled=!countsAsGame(game);
          if(game.backToBack||canceled){
            rect(x+5,top+1,dayWidth-10,28,canceled?'#faf4f3':colors.green,'rx="4"');
            if(game.backToBack)rect(x+5,top+4,3,22,'#66a58a');
          }
          const location=game.neutral?'中立':game.home?'主':'客';
          const status=canceled?(game.status==='canceled'?'取消':'延期'):'';
          text(x+dayWidth/2,top+20,`${location} ${game.opponent}${status?` · ${status}`:''}`,status?11:14,canceled?colors.redInk:game.backToBack?colors.greenInk:colors.ink,'middle');
        });
      });
      y+=rowHeight;
      line(left,y,width-left,y);
    });
    const columns=[left,left+teamWidth,...(hasTotal?[left+teamWidth+countWidth]:[]),...Array.from({length:8},(_,i)=>dayLeft+dayWidth*i)];
    columns.forEach(x=>line(x,tableTop,x,y));
    line(left,tableTop,width-left,tableTop);
    y+=30;
  }
  const updated=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(data.fetchedAt));
  text(left,y+8,`来源：ESPN · 更新：${updated} 北京时间`,12,colors.muted);
  text(width-left,y+8,'Fantasy · All Timeline',12,colors.muted,'end');
  const height=y+32;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif">${parts.join('')}</g></svg>`;
  return {svg,width,height,filename:`NBA-Fantasy-${period}-W${firstWeek}${hasTotal?`-${firstWeek+1}`:''}-${data.weekStart}.png`};
}

export async function downloadSchedulePng(data:WeekSchedule,options:ExportOptions) {
  await document.fonts.ready;
  const {svg,width,height,filename}=createScheduleExport(data,options);
  const source=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{
      image.onload=()=>resolve();
      image.onerror=()=>reject(new Error('赛程图片生成失败，请重试。'));
      image.src=source;
    });
    const canvas=document.createElement('canvas');
    canvas.width=width*2;canvas.height=height*2;
    const context=canvas.getContext('2d');
    if(!context)throw new Error('当前浏览器无法生成图片。');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('图片保存失败，请重试。')),'image/png'));
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=filename;
    document.body.appendChild(link);link.click();link.remove();
    // Keep the URL alive while Safari/the download manager consumes it.
    setTimeout(()=>URL.revokeObjectURL(url),60_000);
    return filename;
  }finally{URL.revokeObjectURL(source);}
}
