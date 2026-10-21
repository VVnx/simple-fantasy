import palettes from '@/data/tools/poster-palettes.json';
import {wrapPosterText, type PosterCard, type PosterPlayer, type PosterReport} from '@/lib/poster-report';

const styles:Record<string,string[]> = palettes;
const white='#f5f7fc', muted='#aab9cd';
const images=new Map<string,Promise<HTMLCanvasElement>>();
function portrait(url:string) {
  let existing=images.get(url);
  if(existing)return existing;
  existing=new Promise<HTMLCanvasElement>((resolve,reject)=>{
    const image=new Image();
    const timeout=setTimeout(()=>{images.delete(url);reject(Error('头像加载超时'));},12000);
    image.onload=()=>{
      clearTimeout(timeout);
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
      try {
        const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
        let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        if(right>=left&&bottom>=top){const crop=document.createElement('canvas');crop.width=right-left+1;crop.height=bottom-top+1;crop.getContext('2d')!.drawImage(canvas,left,top,crop.width,crop.height,0,0,crop.width,crop.height);resolve(crop);}else resolve(canvas);
      }catch{resolve(canvas);}
    };
    image.onerror=()=>{clearTimeout(timeout);images.delete(url);reject(Error('头像加载失败'));};
    image.src=url;
  });
  images.set(url,existing);return existing;
}
function mix(a:string,b:string,ratio:number) {
  const color=(value:string)=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
  return '#'+color(a).map((v,i)=>Math.round(v*(1-ratio)+color(b)[i]*ratio).toString(16).padStart(2,'0')).join('');
}
const identity=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export async function renderPoster(report:PosterReport,card:PosterCard,paragraphs:string[]):Promise<{images:Blob[];warnings:string[]}> {
  await document.fonts.ready;
  const warnings:string[]=[],photos=new Map<string,HTMLCanvasElement>();
  const players=[...card.prediction.players,...card.actual.players];
  await Promise.all([...new Map(players.map(p=>[p.name,p])).values()].map(async p=>{
    if(!p.avatar){warnings.push(`${p.name} 缺少头像`);return;}
    try {photos.set(p.name,await portrait(p.avatar));}catch{warnings.push(`${p.name} 头像加载失败`);}
  }));
  const [bg,teamColor,accent]=styles[card.team.code]??['#0d1729','#1d466b','#7ed9ff'];
  let canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D;
  const pages:HTMLCanvasElement[]=[];
  function font(size:number,bold=false){ctx.font=`${bold?700:400} ${size}px "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;ctx.textBaseline='top';}
  function text(value:string,x:number,y:number,size:number,color=white,bold=false){font(size,bold);ctx.fillStyle=color;ctx.fillText(value,x,y);}
  function polygon(points:number[][],color:string,stroke?:string,width=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function line(x:number,y:number,end:number,color:string,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(end,y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function base(){
    canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;ctx=canvas.getContext('2d')!;
    const gradient=ctx.createLinearGradient(0,0,0,960);gradient.addColorStop(0,mix(bg,teamColor,.4));gradient.addColorStop(1,bg);ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1440);
    polygon([[610,0],[1080,0],[1080,447],[788,356],[518,0]],mix(bg,teamColor,.56));
    polygon([[1012,0],[1080,0],[1080,405],[1043,391],[952,0]],mix(bg,accent,.4));
    ctx.beginPath();ctx.arc(965,317,252,188*Math.PI/180,345*Math.PI/180);ctx.strokeStyle=mix(bg,accent,.22);ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle=accent;ctx.fillRect(54,47,7,31);text('季前赛观察',77,47,28,white,true);
    const date=report.reportDate.replaceAll('-','.');font(25);text(date,1026-ctx.measureText(date).width,49,25);
    let titleSize=88;font(titleSize,true);while(ctx.measureText(card.team.name).width>740&&titleSize>40)font(--titleSize,true);
    text(card.team.name,50,117,titleSize,white,true);
    font(100,true);text(card.team.code,1022-ctx.measureText(card.team.code).width,126,100,accent,true);
    polygon([[54,240],[335,240],[320,248],[54,248]],accent);line(350,244,1026,mix(bg,white,.2),2);
    polygon([[54,1385],[250,1385],[264,1392],[54,1392]],accent);line(284,1389,1026,mix(bg,white,.17));
  }
  function section(title:string,y:number,active=false){text(title,54,y,34,active?accent:white,true);font(34,true);line(84+ctx.measureText(title).width,y+21,1026,mix(bg,accent,active?.26:.12),2);}
  function lineup(list:PosterPlayer[],y:number,actual=false){
    if(!list.length){ctx.fillStyle=mix(bg,teamColor,.22);ctx.fillRect(54,y,972,244);text('待确认',90,y+96,32,muted);return;}
    const cell=(972-48)/5,predicted=new Set(card.prediction.players.map(p=>identity(p.name)));
    list.forEach((p,i)=>{
      const x=54+i*(cell+12),right=x+cell,changed=actual&&!predicted.has(identity(p.name)),panel=mix(bg,teamColor,actual?.7:.36);
      polygon([[x,y],[right-17,y],[right,y+17],[right,y+244],[x,y+244]],panel,changed?accent:mix(bg,white,actual?.29:.14),changed?3:1);
      polygon([[x+2,y+145],[right-2,y+55],[right-2,y+161],[x+2,y+161]],mix(panel,accent,actual?.13:.06));
      text(p.position,x+14,y+13,22,actual?accent:muted,true);
      if(changed){polygon([[right-71,y+2],[right-18,y+2],[right-2,y+18],[right-2,y+36],[right-71,y+36]],accent);text('替入',right-61,y+9,18,bg,true);}
      const photo=photos.get(p.name);
      if(photo){const scale=Math.min((cell-12)/photo.width,132/photo.height);ctx.drawImage(photo,x+(cell-photo.width*scale)/2,y+161-photo.height*scale,photo.width*scale,photo.height*scale);}
      else {text('待补头像',x+45,y+95,22,muted);}
      line(x+12,y+164,right-12,mix(panel,accent,.3));
      let size=23;font(size);let lines=wrapPosterText(p.name,cell-22,t=>ctx.measureText(t).width);
      while(lines.length>3&&size>14){font(--size);lines=wrapPosterText(p.name,cell-22,t=>ctx.measureText(t).width);}
      const leading=lines.length>=3?22:27;
      lines.forEach((value,n)=>{font(size);text(value,x+(cell-ctx.measureText(value).width)/2,y+(lines.length>=3?169:173)+n*leading,size);});
    });
  }
  base();section('预测首发',282);lineup(card.prediction.players,317);section(card.actual.status==='confirmed'?'实际首发':'实际首发 · 待确认',605,true);lineup(card.actual.players,650,true);section('个人观察',928,true);
  let y=986;
  for(const paragraph of paragraphs){
    font(29);const lines=wrapPosterText(paragraph,948,t=>ctx.measureText(t).width);let index=0;
    while(index<lines.length){
      let capacity=Math.floor((1356-y)/43);
      if(capacity<Math.min(2,lines.length-index)){
        if(pages.length>=11)throw Error('单队超过 12 页，请缩短短评或拆分报告。');
        pages.push(canvas!);base();section('个人观察 · 续',285,true);y=345;capacity=Math.floor((1356-y)/43);
      }
      const count=Math.min(capacity,lines.length-index);
      lines.slice(index,index+count).forEach((value,n)=>text(value,56,y+n*43,29));index+=count;y+=count*43+20;
    }
  }
  pages.push(canvas!);
  const blobs=await Promise.all(pages.map(page=>new Promise<Blob>((resolve,reject)=>page.toBlob(blob=>blob?resolve(blob):reject(Error('图片生成失败，请重试。')),'image/png'))));
  return {images:blobs,warnings:[...new Set(warnings)]};
}
