'use client';
/* eslint-disable @next/next/no-img-element -- The fixed same-origin portrait endpoint also supplies canvas export. */
import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type MouseEvent,type KeyboardEvent} from 'react';
import ToolNavigation from './tool-navigation';
import {validDate} from '@/lib/schedule';
import {cardStatLine} from '@/lib/player-cards';
import {normalize,resolveSearch} from '@/lib/aliases';
import {loadCardPortrait} from '@/lib/player-card-image';
import {BOARD_WIDTH,BOARD_HEIGHT,BOARD_PADDING,boardKey,boardRoster,clampPoint,emptyBoard,pointerOnBoard,readBoardLayout,type BoardDay,type BoardLayout,type Point} from '@/lib/surprise-board';
import {downloadBoard,loadBoardBackground,paintBoard} from '@/lib/surprise-board-image';

export default function SurpriseBoard({initialDate}:{initialDate:string}){
  const [date,setDate]=useState(initialDate),[revision,setRevision]=useState(0);
  const [response,setResponse]=useState<{key:string;data?:BoardDay;error?:string}>();
  const key=`${date}:${revision}`,current=response?.key===key?response:undefined;
  useEffect(()=>{
    if(!validDate(date))return;
    const controller=new AbortController();
    fetch(`/api/surprise-board?date=${date}`,{signal:controller.signal}).then(async r=>{
      const body=await r.json() as BoardDay&{error?:string};if(!r.ok)throw new Error(body.error||'读取失败，请重试。');
      if(body.date!==date||!Array.isArray(body.players))throw new Error('返回的日期不一致，请刷新。');
      if(!controller.signal.aborted)setResponse({key,data:body});
    }).catch(error=>{if(!controller.signal.aborted)setResponse({key,error:error instanceof Error?error.message:'读取失败，请重试。'});});
    return ()=>controller.abort();
  },[date,key]);
  return <main className="surprise-page">
    <header className="site-header"><a className="site-brand" href="/">Fantasy - All Timeline</a><ToolNavigation active="board"/></header>
    <div className="board-heading"><div><p className="eyebrow">DAILY SURPRISE BOARD</p><h1>今天谁夯，谁拉？</h1><p>把头像拖到任何位置。夯的上面，还可以更夯。</p></div>
      <div className="board-date"><label htmlFor="board-date">简报日期（北京时间）</label><input id="board-date" type="date" min="2002-01-01" max="2100-12-31" value={date} onChange={e=>setDate(e.target.value)}/><button type="button" onClick={()=>setRevision(n=>n+1)}>刷新名单</button></div>
    </div>
    {!validDate(date)?<p role="alert" className="error">请选择有效日期。</p>:current?.error?<p className="error" role="alert">{current.error}</p>:!current?.data?<p className="board-loading" role="status">正在读取当天惊喜球员…</p>:<>
      {current.data.warnings.map(w=><p className="error" key={w}>{w}</p>)}
      <BoardEditor key={date} date={date} data={current.data}/>
    </>}
  </main>;
}
type Drag={id:string;pointerId:number;client:Point;start:Point;offset:Point;fromBoard:boolean;moved:boolean;point:Point|null};
function BoardEditor({date,data}:{date:string;data:BoardDay}){
  const players=useMemo(()=>boardRoster(data),[data]);
  const [showAll,setShowAll]=useState(false),[search,setSearch]=useState('');
  const board=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),tray=useRef<HTMLElement>(null),dragRef=useRef<Drag|null>(null);
  const [layout,setLayout]=useState<BoardLayout>(emptyBoard),[ready,setReady]=useState(false),[selected,setSelected]=useState('');
  const [background,setBackground]=useState<HTMLImageElement>(),[backgroundError,setBackgroundError]=useState('');
  const [photos,setPhotos]=useState<Record<string,HTMLImageElement>>({}),[photosReady,setPhotosReady]=useState(false),[failed,setFailed]=useState<string[]>([]),[photoRevision,setPhotoRevision]=useState(0);
  const [drag,setDrag]=useState<Drag|null>(null),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[storageError,setStorageError]=useState(false);
  const exporting=useRef(false),ids=players.map(p=>p.id).join(',');
  const photoIds=Object.keys(layout.positions).sort().join(',');
  useEffect(()=>{
    try{setLayout(readBoardLayout(localStorage.getItem(boardKey(date)),ids.split(',')));}catch{setStorageError(true);}
    setReady(true);setSelected('');
  },[date,ids]);
  useEffect(()=>{
    if(!ready)return;
    try{localStorage.setItem(boardKey(date),JSON.stringify({version:1,...layout}));}catch{setStorageError(true);}
  },[date,layout,ready]);
  useEffect(()=>{let active=true;loadBoardBackground().then(image=>{if(active)setBackground(image);}).catch(()=>{if(active)setBackgroundError('背景暂时未能读取，请刷新页面重试。');});return ()=>{active=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();setPhotosReady(false);
    const requested=photoIds.split(',').filter(Boolean);
    Promise.allSettled(requested.map(async id=>({id,image:await loadCardPortrait(id,controller.signal)}))).then(results=>{
      if(controller.signal.aborted)return;
      const loaded:Record<string,HTMLImageElement>={},missing:string[]=[];
      results.forEach((r,i)=>{if(r.status==='fulfilled')loaded[r.value.id]=r.value.image;else missing.push(requested[i]);});
      setPhotos(loaded);setFailed(missing);setPhotosReady(true);
    });return ()=>controller.abort();
  },[photoIds,photoRevision]);
  const paintedLayout=drag?.point?{...layout,positions:{...layout.positions,[drag.id]:clampPoint(drag.point,layout.size)}}:layout;
  useEffect(()=>{
    if(!canvas.current||!background||!ready)return;
    const frame=requestAnimationFrame(()=>{if(canvas.current)paintBoard(canvas.current,background,players,photos,paintedLayout);});
    return ()=>cancelAnimationFrame(frame);
  },[background,players,photos,paintedLayout,ready]);
  function put(id:string,point:Point){setLayout(previous=>({...previous,positions:{...previous.positions,[id]:clampPoint(point,previous.size)}}));setSelected(id);}
  function remove(id:string){setLayout(previous=>{const positions={...previous.positions};delete positions[id];return {...previous,positions};});if(selected===id)setSelected('');}
  function start(event:ReactPointerEvent<HTMLButtonElement>,id:string,fromBoard:boolean){
    if(event.button!==0||!board.current)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setSelected(id);setMessage('');
    const rect=board.current.getBoundingClientRect(),client={x:event.clientX,y:event.clientY};
    const point=pointerOnBoard(client,rect),old=layout.positions[id];
    const offset=fromBoard&&point&&old?{x:point.x-old.x,y:point.y-old.y}:{x:0,y:0};
    const next:Drag={id,pointerId:event.pointerId,client,start:client,offset,fromBoard,moved:false,point:null};dragRef.current=next;setDrag(next);
  }
  function move(event:ReactPointerEvent){
    const active=dragRef.current;if(!active||active.pointerId!==event.pointerId||!board.current)return;
    const client={x:event.clientX,y:event.clientY};const next={...active,client,moved:active.moved||Math.hypot(client.x-active.start.x,client.y-active.start.y)>4,point:pointerOnBoard(client,board.current.getBoundingClientRect(),active.offset)};
    dragRef.current=next;setDrag(next);
  }
  function end(event:ReactPointerEvent){
    const active=dragRef.current;if(!active||active.pointerId!==event.pointerId)return;
    if(active.moved&&board.current){
      const client={x:event.clientX,y:event.clientY},point=pointerOnBoard(client,board.current.getBoundingClientRect(),active.offset),rect=tray.current?.getBoundingClientRect();
      if(point)put(active.id,point);
      else if(rect&&client.x>=rect.left&&client.x<=rect.right&&client.y>=rect.top&&client.y<=rect.bottom)remove(active.id);
    }
    dragRef.current=null;setDrag(null);
  }
  function cancel(){dragRef.current=null;setDrag(null);}
  function keyboard(event:KeyboardEvent<HTMLButtonElement>,id:string){
    const point=layout.positions[id],step=event.shiftKey?20:4;
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove(id);return;}
    if(event.key==='Escape'){cancel();return;}
    if((event.key==='Enter'||event.key===' ')&&!point){event.preventDefault();put(id,{x:BOARD_WIDTH/2,y:BOARD_PADDING+70});return;}
    const delta:Record<string,Point>={ArrowLeft:{x:-step,y:0},ArrowRight:{x:step,y:0},ArrowUp:{x:0,y:-step},ArrowDown:{x:0,y:step}};
    if(point&&delta[event.key]){event.preventDefault();put(id,{x:point.x+delta[event.key].x,y:point.y+delta[event.key].y});}
  }
  function tapBoard(event:MouseEvent<HTMLDivElement>){
    if(dragRef.current||!selected||!board.current||event.target!==canvas.current)return;
    const point=pointerOnBoard({x:event.clientX,y:event.clientY},board.current.getBoundingClientRect());if(point)put(selected,point);
  }
  async function download(){
    if(!canvas.current||!background||exporting.current||!photosReady)return;
    exporting.current=true;setSaving(true);setMessage('');
    try{paintBoard(canvas.current,background,players,photos,layout);await downloadBoard(canvas.current,date);setMessage('高清 PNG 已生成，下载图片不包含侧栏和选中框。');}catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}
    finally{exporting.current=false;setSaving(false);}
  }
  const selectedPlayer=players.find(p=>p.id===selected),placed=Object.keys(layout.positions).length;
  const query=normalize(search),resolved=normalize(resolveSearch(search));
  const roster=players.filter(player=>(showAll||query||data.players.some(p=>p.id===player.id)||layout.positions[player.id])&&(!query||normalize(player.boardName+player.team).includes(query)||normalize(player.name).includes(resolved)||normalize(player.chineseName||'').includes(query)));
  return <div onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel} className="board-editor">
    <div className="board-toolbar">
      <div className="board-tools"><label>头像大小 <input aria-label="头像大小" type="range" min="72" max="160" step="4" value={layout.size} onChange={e=>{const size=+e.target.value;setLayout(l=>({...l,size,positions:Object.fromEntries(Object.entries(l.positions).map(([id,p])=>[id,clampPoint(p,size)]))}));}}/></label><label><input type="checkbox" checked={layout.showNames} onChange={e=>setLayout(l=>({...l,showNames:e.target.checked}))}/> 显示名字</label><button type="button" disabled={!selected||!layout.positions[selected]} onClick={()=>remove(selected)}>移回侧栏</button><button type="button" disabled={!placed} onClick={()=>{setLayout(l=>({...l,positions:{}}));setSelected('');}}>全部移回</button></div>
      <button type="button" className="board-export" onClick={download} disabled={!ready||!background||!photosReady||saving||!!drag}>{saving?'正在保存…':'下载高清 PNG ↓'}</button>
    </div>
    <div className="board-workspace">
      <section className="board-stage" aria-label="自由摆放画布">
        <div className="board-stage-caption"><span>上下留白均可摆放 · 自由拖动，不吸附</span><span>{placed}/{players.length} 已上榜</span></div>
        {backgroundError&&<p className="error" role="alert">{backgroundError}</p>}
        <div ref={board} className="tier-board" style={{aspectRatio:`${BOARD_WIDTH}/${BOARD_HEIGHT}`}} onClick={tapBoard}>
          <canvas ref={canvas} aria-label="夯、顶级、人上人、NPC、拉五档背景，上下各有额外留白"/>
          {!ready||!background?<p className="board-canvas-loading">正在准备画布…</p>:Object.entries(layout.positions).map(([id,point])=>{
            const player=players.find(p=>p.id===id);if(!player)return null;
            return <button type="button" key={id} className={`board-hit ${selected===id?'is-selected':''}`} aria-label={`移动${player.boardName}`} aria-pressed={selected===id} style={{left:`${100*point.x/BOARD_WIDTH}%`,top:`${100*point.y/BOARD_HEIGHT}%`,width:`${100*layout.size/BOARD_WIDTH}%`,height:`${100*layout.size/BOARD_HEIGHT}%`,visibility:drag?.id===id&&drag.moved?'hidden':undefined}} onPointerDown={e=>start(e,id,true)} onFocus={()=>setSelected(id)} onKeyDown={e=>keyboard(e,id)}/>;
          })}
        </div>
        <p className="board-hint">也可以先点头像，再点画布放置。选中后用方向键微调，Delete 移回侧栏。</p>
        <p className="board-save-note">{storageError?'当前浏览器无法保存布局，请及时下载图片。':'布局自动保存在此浏览器，重新打开同一天可继续。'} · PNG 2530 × 1972</p>
        <p className="board-feedback" role="status">{message||(!photosReady?'正在准备球员头像…':'')}</p>
        {!!failed.length&&<p className="card-notice" role="status">{failed.map(id=>players.find(p=>p.id===id)?.boardName).join('、')}的头像暂不可用，将显示轮廓。<button type="button" onClick={()=>setPhotoRevision(n=>n+1)}>重试头像</button></p>}
      </section>
      <aside ref={tray} className="board-tray" aria-label="惊喜球员侧栏"><div className="board-tray-heading"><h2>当天球员 <span>{roster.length}</span></h2><p>拖到左边，自由排位。拖回来即可撤下。</p></div>
        <div className="board-roster-filter"><input type="search" aria-label="查找当天球员" placeholder="搜索姓名、昵称或球队" value={search} onChange={event=>setSearch(event.target.value)}/><label><input type="checkbox" checked={showAll} onChange={event=>setShowAll(event.target.checked)}/> 包含当天其他球员</label></div>
        {!roster.length?<p className="board-empty">{!players.length?(data.message||'这一天没有可用的球员。'):'没有找到这名球员。'}</p>:<div className="board-roster">{roster.map(player=><button key={player.id} type="button" className={`board-avatar ${layout.positions[player.id]?'is-placed':''} ${selected===player.id?'is-selected':''}`} aria-label={`${player.boardName}，${player.team}${layout.positions[player.id]?'，已上榜':''}`} aria-pressed={selected===player.id} onPointerDown={e=>start(e,player.id,false)} onClick={()=>setSelected(player.id)} onKeyDown={e=>keyboard(e,player.id)} title={cardStatLine(player,player.boardName)}>
          <span className="board-avatar-photo">{failed.includes(player.id)?<span className="board-photo-fallback">{player.boardName.slice(0,1)}</span>:<img src={`/api/player-headshot?id=${player.id}`} alt="" draggable={false}/>}</span><strong>{player.boardName}</strong><small>{layout.positions[player.id]?'✓ 已上榜':player.team}</small>
        </button>)}</div>}
        {selectedPlayer&&<div className="board-selection"><strong>{selectedPlayer.boardName}</strong><p>{cardStatLine(selectedPlayer,selectedPlayer.boardName)}</p></div>}
        <a className="board-briefing-link" href={`/briefings?date=${date}`}>查看当天简报 ↗</a>
      </aside>
    </div>
    {drag&&drag.moved&&!drag.point&&<div className="board-drag-ghost" style={{left:drag.client.x,top:drag.client.y}}><img src={`/api/player-headshot?id=${drag.id}`} alt=""/><span>{players.find(p=>p.id===drag.id)?.boardName}</span></div>}
  </div>;
}
