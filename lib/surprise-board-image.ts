import {BOARD_WIDTH,BOARD_HEIGHT,BOARD_PADDING,BACKGROUND_HEIGHT,type BoardLayout,type BoardPlayer} from './surprise-board';
const FONT='Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
export async function loadBoardBackground(){const image=new Image();image.src='/player-board/tier-background.png';await image.decode();return image;}
export function paintBoard(canvas:HTMLCanvasElement,background:HTMLImageElement,players:BoardPlayer[],portraits:Record<string,HTMLImageElement>,layout:BoardLayout){
  if(canvas.width!==BOARD_WIDTH*2||canvas.height!==BOARD_HEIGHT*2){canvas.width=BOARD_WIDTH*2;canvas.height=BOARD_HEIGHT*2;}
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器暂不支持图片生成。');
  ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,BOARD_WIDTH,BOARD_HEIGHT);
  ctx.fillStyle='#1a1a18';ctx.fillRect(9,10,BOARD_WIDTH-19,BOARD_HEIGHT-20);
  ctx.drawImage(background,0,BOARD_PADDING,BOARD_WIDTH,BACKGROUND_HEIGHT);
  const byId=new Map(players.map(p=>[p.id,p]));
  for(const [id,point] of Object.entries(layout.positions)){
    const player=byId.get(id);if(!player)continue;
    const s=layout.size,x=point.x-s/2,y=point.y-s/2,photo=portraits[id],photoHeight=layout.showNames?s*.77:s;
    ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=5;
    if(photo){const factor=Math.min(s/photo.naturalWidth,photoHeight/photo.naturalHeight),w=photo.naturalWidth*factor,h=photo.naturalHeight*factor;ctx.drawImage(photo,x+(s-w)/2,y+photoHeight-h,w,h);}
    else{ctx.fillStyle='#72828c';ctx.beginPath();ctx.arc(point.x,y+photoHeight*.33,s*.18,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(point.x,y+photoHeight*.93,s*.33,photoHeight*.36,0,Math.PI,Math.PI*2);ctx.fill();}
    if(layout.showNames){let size=Math.round(s*.15);ctx.font=`600 ${size}px ${FONT}`;while(ctx.measureText(player.boardName).width>s-4&&size>9){ctx.font=`600 ${--size}px ${FONT}`;}ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillText(player.boardName,point.x,y+s*.9);}
    ctx.restore();
  }
}
export async function downloadBoard(canvas:HTMLCanvasElement,date:string){
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败，请重试。')),'image/png'));
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`惊喜球员从夯到拉-${date}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
