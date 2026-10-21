import {CARD_WIDTH,CARD_HEIGHT,cardFilename,formatMinutes,type PlayerGameCard} from './player-cards';
const FONT='Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
export async function loadCardPortrait(id:string,signal:AbortSignal):Promise<HTMLImageElement>{
  const response=await fetch(`/api/player-headshot?id=${id}`,{signal});
  if(!response.ok)throw new Error('头像暂时未能读取');
  const url=URL.createObjectURL(await response.blob());
  try{
    const image=new Image();image.src=url;await image.decode();return image;
  }finally{URL.revokeObjectURL(url);}
}
export function renderPlayerCard(player:PlayerGameCard,options:{name:string;caption:string;portrait?:HTMLImageElement;monochrome?:boolean}):HTMLCanvasElement{
  const canvas=document.createElement('canvas');canvas.width=CARD_WIDTH;canvas.height=CARD_HEIGHT;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器暂不支持图片生成，请换个浏览器重试。');
  const accent=options.monochrome?'#536375':player.color;
  const rect=(x:number,y:number,w:number,h:number,fill:string,r=0)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
  const text=(value:string,x:number,y:number,size:number,color:string,weight=400,align:CanvasTextAlign='left',max=1000)=>{
    let fit=size;ctx.font=`${weight} ${fit}px ${FONT}`;while(ctx.measureText(value).width>max&&fit>12){fit--;ctx.font=`${weight} ${fit}px ${FONT}`;}
    ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(value,x,y);ctx.textAlign='left';
  };
  rect(0,0,1080,1350,'#f2f3f1');rect(0,0,1080,650,'#11212b');
  const gradient=ctx.createLinearGradient(350,0,1080,620);gradient.addColorStop(0,'#11212b');gradient.addColorStop(1,accent);ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,650);
  ctx.save();ctx.globalAlpha=.1;ctx.strokeStyle='#ffffff';ctx.lineWidth=2;for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(960,390,145+i*70,0,Math.PI*2);ctx.stroke();}ctx.restore();
  rect(58,58,7,32,'#c8ef89');text('NBA FANTASY',82,84,27,'#ffffff',700);text(player.beijingDate.replaceAll('-','.'),1016,82,23,'#c7d6da',400,'right');
  rect(64,162,60,5,'#c8ef89');text(player.team,64,212,26,'#c7d6da',600);
  text(options.name.trim()||player.chineseName||player.name,64,300,66,'#ffffff',700,'left',470);
  text(player.name,66,348,24,'#b6c8d1',400,'left',455);
  const caption=options.caption.trim();if(caption){rect(64,394,Math.min(440,Math.max(154,caption.length*29+40)),58,'#ffffff15',8);text(caption,84,433,27,'#d8f3ae',600,'left',400);}
  text('出场时间',64,492,20,'#b6c8d1',500);
  text(formatMinutes(player.minutes),64,541,36,'#ffffff',700,'left',290);
  text(`本场${player.result==='胜'?'获胜':'失利'}`,395,538,21,'#c7d6da',400);
  if(options.portrait){
    const image=options.portrait;const width=650,height=width*image.naturalHeight/image.naturalWidth;
    ctx.save();ctx.beginPath();ctx.rect(530,120,550,530);ctx.clip();ctx.drawImage(image,470,650-height,width,height);ctx.restore();
  }else{
    ctx.save();ctx.globalAlpha=.16;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(817,315,93,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(817,605,175,183,0,Math.PI,Math.PI*2);ctx.fill();ctx.restore();text('头像暂不可用',817,580,22,'#c7d6da',400,'center');
  }
  rect(0,588,1080,62,'#07101988');text(player.matchup,64,629,24,'#ffffff',500,'left',952);
  rect(44,682,992,247,'#ffffff',20);
  const s=player.stats;
  [[s.pts,'得分','PTS'],[s.reb,'篮板','REB'],[s.ast,'助攻','AST']].forEach(([value,label,en],i)=>{
    const x=210+i*330;text(String(value),x,825,120,'#132b37',700,'center',290);text(`${label}  ${en}`,x,882,24,'#667b83',500,'center');
    if(i<2)rect(374+i*330,730,1,150,'#e8eded');
  });
  const rows=[{label:'三分',value:String(s.three),sub:`${s.three}/${s.threeAttempted}`},{label:'投篮',value:`${s.fgm}/${s.fga}`,sub:s.fga?`${(100*s.fgm/s.fga).toFixed(1)}%`:'未出手'},{label:'罚球',value:`${s.ftm}/${s.fta}`,sub:s.fta?`${(100*s.ftm/s.fta).toFixed(1)}%`:'未出手'},{label:'抢断',value:String(s.st),sub:'STL'},{label:'盖帽',value:String(s.blk),sub:'BLK'},{label:'失误',value:String(s.to),sub:'TO'}];
  rows.forEach((item,i)=>{const x=64+(i%3)*330,y=976+Math.floor(i/3)*145;text(item.label,x,y,23,'#60767f',500);text(item.value,x,y+61,48,'#193541',700);text(item.sub,x+275,y+58,21,'#768c92',400,'right',115);});
  rect(64,1258,952,1,'#d7e0df');text('单场表现 · 北京时间',64,1304,18,'#798d92');text('ESPN  /  ALL TIMELINE',1016,1304,18,'#798d92',500,'right');
  return canvas;
}
export async function downloadPlayerCard(canvas:HTMLCanvasElement,player:PlayerGameCard){
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('图片生成失败，请重试。')),'image/png'));
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=cardFilename(player);document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
