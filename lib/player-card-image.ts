import {CARD_WIDTH,CARD_HEIGHT,cardFilename,type PlayerCardContent} from './player-cards';
const FONT='Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
type PortraitBounds={x:number;y:number;width:number;height:number};
const portraitBoundsCache=new WeakMap<HTMLImageElement,PortraitBounds>();
function portraitBounds(image:HTMLImageElement):PortraitBounds{
  const cached=portraitBoundsCache.get(image);if(cached)return cached;
  const full={x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
  // ESPN headshots contain transparent margins; remove those before fitting the photo.
  try{
    const sample=document.createElement('canvas'),scale=Math.min(1,256/Math.max(full.width,full.height));
    sample.width=Math.max(1,Math.round(full.width*scale));sample.height=Math.max(1,Math.round(full.height*scale));
    const ctx=sample.getContext('2d',{willReadFrequently:true});if(!ctx)return full;
    ctx.drawImage(image,0,0,sample.width,sample.height);
    const pixels=ctx.getImageData(0,0,sample.width,sample.height).data;
    let left=sample.width,top=sample.height,right=-1,bottom=-1;
    for(let y=0;y<sample.height;y++)for(let x=0;x<sample.width;x++){
      if(pixels[(y*sample.width+x)*4+3]<16)continue;
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    if(right<left)return full;
    const bounds={x:left*full.width/sample.width,y:top*full.height/sample.height,width:(right-left+1)*full.width/sample.width,height:(bottom-top+1)*full.height/sample.height};
    portraitBoundsCache.set(image,bounds);return bounds;
  }catch{return full;}
}
export async function loadCardPortrait(id:string,signal:AbortSignal):Promise<HTMLImageElement>{
  const response=await fetch(`/api/player-headshot?id=${id}`,{signal});
  if(!response.ok)throw new Error('头像暂时未能读取');
  const url=URL.createObjectURL(await response.blob());
  try{
    const image=new Image();image.src=url;await image.decode();return image;
  }finally{URL.revokeObjectURL(url);}
}
export function renderPlayerCard(player:PlayerCardContent,options:{name:string;portrait?:HTMLImageElement;monochrome?:boolean}):HTMLCanvasElement{
  const canvas=document.createElement('canvas');canvas.width=CARD_WIDTH;canvas.height=CARD_HEIGHT;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器暂不支持图片生成，请换个浏览器重试。');
  const accent=options.monochrome?'#536375':player.color;
  const rect=(x:number,y:number,w:number,h:number,fill:string)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);};
  const text=(value:string,x:number,y:number,size:number,color:string,weight=400,align:CanvasTextAlign='left',max=1000)=>{
    let fit=size;ctx.font=`${weight} ${fit}px ${FONT}`;while(ctx.measureText(value).width>max&&fit>12){fit--;ctx.font=`${weight} ${fit}px ${FONT}`;}
    ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(value,x,y,max);ctx.textAlign='left';
  };
  rect(0,0,CARD_WIDTH,CARD_HEIGHT,'#ffffff');
  rect(0,0,240,CARD_HEIGHT,accent);rect(240,0,300,CARD_HEIGHT,'#f1f5f5');
  if(options.portrait){
    const image=options.portrait,bounds=portraitBounds(image),scale=Math.max(240/bounds.width,(CARD_HEIGHT-2)/bounds.height);
    const width=bounds.width*scale,height=bounds.height*scale;
    ctx.save();ctx.beginPath();ctx.rect(0,0,240,CARD_HEIGHT);ctx.clip();
    ctx.drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height,(240-width)/2,2,width,height);ctx.restore();
  }else{
    ctx.save();ctx.globalAlpha=.25;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(120,60,36,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(120,CARD_HEIGHT,80,90,0,Math.PI,Math.PI*2);ctx.fill();ctx.restore();
  }
  text(player.team,272,42,26,'#647d86',500,'left',238);
  text(options.name.trim()||player.chineseName||player.name,272,112,46,'#193541',700,'left',238);
  if(player.date)text(player.date.replaceAll('-','.'),272,164,22,'#8a9ba2',400);
  const s=player.stats;
  const columns=[
    {label:'出场时间',value:player.minutes,sub:player.minutes.includes(':')?'分 : 秒':'分钟'},
    {label:'得分',value:String(s.pts),sub:'PTS'},
    {label:'篮板',value:String(s.reb),sub:'REB'},
    {label:'助攻',value:String(s.ast),sub:'AST'},
    {label:'三分',value:String(s.three),sub:s.threeAttempted===undefined?'命中':`${s.three}/${s.threeAttempted}`},
    {label:'投篮',value:`${s.fgm}/${s.fga}`,sub:'命中 / 出手'},
    {label:'罚球',value:`${s.ftm}/${s.fta}`,sub:'命中 / 出手'},
    {label:'抢断',value:String(s.st),sub:'STL'},
    {label:'盖帽',value:String(s.blk),sub:'BLK'},
    {label:'失误',value:String(s.to),sub:'TO'},
  ];
  const width=(CARD_WIDTH-560)/columns.length;
  columns.forEach((item,i)=>{
    const x=550+(i+.5)*width;
    if(i)rect(550+i*width,18,1,158,'#e5ebed');
    text(item.label,x,42,25,'#6c818a',500,'center',width-18);
    text(item.value,x,112,53,i===1?accent:'#193541',700,'center',width-18);
    text(item.sub,x,164,19,'#93a3aa',400,'center',width-18);
  });
  rect(240,CARD_HEIGHT-5,CARD_WIDTH-240,5,accent);
  return canvas;
}
export async function downloadPlayerCard(canvas:HTMLCanvasElement,player:PlayerCardContent){
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('图片生成失败，请重试。')),'image/png'));
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=cardFilename(player);document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
