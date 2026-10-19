import { addDays, buildScheduleRows, countsAsGame, seasonWeekNumber, shortDate, weekday, weekDays, type ScheduleSeason, type TeamGame, type WeekSchedule } from './schedule';
import { seasonLabel } from './seasons';

type ExportOptions = {season:ScheduleSeason; direction?:'ascending'|'descending'; today?:string};
const colors = {ink:'#20344d', muted:'#768498', line:'#e2e9f0', pale:'#eaf2fc', green:'#e4f3ea', greenInk:'#28684d', red:'#fde8e7', redInk:'#9c6464'};
const escape = (value:string|number) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));

// Render from the same schedule model as the grid, never from its clipped viewport.
export function createScheduleExport(data:WeekSchedule, {season,direction='descending',today}:ExportOptions) {
  const firstWeek=seasonWeekNumber(data.weekStart,season);
  if(firstWeek===null || ![1,2].includes(data.weeks))throw new Error('请选择有效的赛程范围。');
  const dates=weekDays(data.weekStart,data.weeks);
  if(addDays(data.weekStart,7*(data.weeks-1))>season.lastWeek)throw new Error('导出范围超出了常规赛。');
  const rows=buildScheduleRows(data,'regular').sort((a,b)=>
    (direction==='ascending'?a.total-b.total:b.total-a.total)||a.team.abbreviation.localeCompare(b.team.abbreviation),
  );
  const fortnight=data.weeks===2;
  const width=fortnight?2200:1200, left=32, tableWidth=width-left*2, teamWidth=132, countWidth=64;
  const dayLeft=left+teamWidth+countWidth, dayWidth=(tableWidth-teamWidth-countWidth)/dates.length;
  const parts:string[]=[];
  const rect=(x:number,y:number,w:number,h:number,fill:string,extra='')=>parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`);
  const text=(x:number,y:number,value:string|number,size=15,fill=colors.ink,anchor='start',weight=400)=>parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${escape(value)}</text>`);
  const line=(x1:number,y1:number,x2:number,y2:number,color=colors.line,strokeWidth=1)=>parts.push(`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`);
  const period=fortnight?'双周':'单周';
  text(left,44,`NBA Fantasy ${period}赛程`,28,colors.ink,'start',600);
  text(left,72,`${seasonLabel(season.year)} 常规赛 · ${data.weekStart} — ${dates.at(-1)} · 美东日期`,14,colors.muted);
  rect(left,91,12,12,colors.green);text(left+19,102,'背靠背',12,colors.muted);
  rect(left+112,91,12,12,colors.green);text(left+131,102,'最多场次',12,colors.muted);
  rect(left+238,91,12,12,colors.red);text(left+257,102,'最少场次',12,colors.muted);
  if(fortnight)text(width-left,102,`按两周总场次${direction==='descending'?'从多到少':'从少到多'}排列`,12,colors.muted,'end');
  const tableTop=132, groupHeight=fortnight?32:0, headerHeight=groupHeight+56;
  const dateTop=tableTop+groupHeight;
  rect(left,tableTop,tableWidth,headerHeight,colors.pale);
  text(left+16,tableTop+headerHeight/2+5,'球队',14,'#355979','start',600);
  text(left+teamWidth+countWidth/2,tableTop+headerHeight/2+(fortnight?-3:5),`场次 ${direction==='ascending'?'↑':'↓'}`,14,'#355979','middle',600);
  if(fortnight){
    text(left+teamWidth+countWidth/2,tableTop+headerHeight/2+19,'两周',12,colors.muted,'middle');
    [0,1].forEach(week=>text(dayLeft+week*7*dayWidth+12,tableTop+21,`Week ${firstWeek+week}`,14,'#355979','start',600));
    line(dayLeft,dateTop,width-left,dateTop);
  }
  dates.forEach((date,i)=>{
    const x=dayLeft+dayWidth*i;
    if(date===today){
      rect(x,dateTop,dayWidth,56,'#dceafa');
      rect(x,dateTop,dayWidth,2,'#5794d0');
    }
    text(x+dayWidth/2,dateTop+23,weekday(date),14,'#355979','middle',600);
    text(x+dayWidth/2,dateTop+43,shortDate(date),12,colors.muted,'middle');
  });
  let y=tableTop+headerHeight;
  line(left,y,width-left,y);
  const totals=rows.map(row=>row.total), minTotal=Math.min(...totals), maxTotal=Math.max(...totals);
  rows.forEach(row=>{
    const rowHeight=Math.max(43,...row.days.map(games=>games.length*30+10));
    rect(left,y,tableWidth,rowHeight,'#fff');
    text(left+16,y+19,row.team.name,14,colors.ink,'start',500);
    text(left+16,y+35,row.team.abbreviation,10,colors.muted);
    const countColor=maxTotal===minTotal?'#fff':row.total===maxTotal?colors.green:row.total===minTotal?colors.red:'#fff';
    rect(left+teamWidth,y,countWidth,rowHeight,countColor);
    text(left+teamWidth+countWidth/2,y+rowHeight/2+6,row.total,19,colors.ink,'middle',600);
    row.days.forEach((games,day)=>{
      const x=dayLeft+day*dayWidth;
      if(dates[day]===today)rect(x,y,dayWidth,rowHeight,'#f5f9ff');
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
        const fill=canceled?colors.redInk:game.backToBack?colors.greenInk:colors.ink;
        parts.push(`<text x="${x+dayWidth/2}" y="${top+20}" text-anchor="middle" font-size="${status?11:14}" font-weight="500" fill="${fill}"${canceled?' text-decoration="line-through"':''}><tspan font-size="11" font-weight="400" fill="#7890a8">${location} </tspan><tspan>${escape(game.opponent)}${status?` · ${status}`:''}</tspan></text>`);
      });
    });
    y+=rowHeight;
    line(left,y,width-left,y);
  });
  [left,left+teamWidth,dayLeft,width-left].forEach(x=>line(x,tableTop,x,y));
  for(let day=1;day<dates.length;day++){
    const x=dayLeft+day*dayWidth;
    if(fortnight&&day===7)line(x,tableTop,x,y,'#c4d6e9',2);
    else line(x,dateTop,x,y);
  }
  line(left,tableTop,width-left,tableTop);
  y+=30;
  const updated=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(data.fetchedAt));
  text(left,y+8,`来源：ESPN · 更新：${updated} 北京时间`,12,colors.muted);
  text(width-left,y+8,'Fantasy · All Timeline',12,colors.muted,'end');
  const height=y+32;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif">${parts.join('')}</g></svg>`;
  return {svg,width,height,filename:`NBA-Fantasy-${period}-W${firstWeek}${fortnight?`-${firstWeek+1}`:''}-${data.weekStart}.png`};
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
