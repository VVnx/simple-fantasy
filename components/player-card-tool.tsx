'use client';
/* eslint-disable @next/next/no-img-element -- Preview is the exact locally generated PNG downloaded by the user. */
import {useEffect,useMemo,useRef,useState} from 'react';
import ToolNavigation from './tool-navigation';
import {normalize,resolveSearch} from '@/lib/aliases';
import {cardStatLine,type CardDay,type PlayerGameCard} from '@/lib/player-cards';
import {downloadPlayerCard,loadCardPortrait,renderPlayerCard} from '@/lib/player-card-image';
import {validDate} from '@/lib/schedule';
type Preview={key:string;src:string;canvas:HTMLCanvasElement;error?:string};
export default function PlayerCardTool({initialDate}:{initialDate:string}){
  const [date,setDate]=useState(initialDate),[revision,setRevision]=useState(0),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
  const [state,setState]=useState<{key:string;data?:CardDay;error?:string}>();
  const [customName,setCustomName]=useState<{id:string;value:string}>(),[caption,setCaption]=useState('单场表现'),[monochrome,setMonochrome]=useState(false);
  const [portrait,setPortrait]=useState<{key:string;image?:HTMLImageElement;error?:string}>(),[portraitRevision,setPortraitRevision]=useState(0),[preview,setPreview]=useState<Preview>();
  const [message,setMessage]=useState(''),[exporting,setExporting]=useState(false);const exportBusy=useRef(false);
  const key=`${date}:${revision}`,data=state?.key===key?state.data:undefined,error=state?.key===key?state.error:undefined;
  useEffect(()=>{
    if(!validDate(date))return;
    const controller=new AbortController();fetch(`/api/player-cards?date=${date}`,{signal:controller.signal}).then(async response=>{
      const body=await response.json() as CardDay&{error?:string};if(!response.ok)throw new Error(body.error||'比赛数据暂时无法读取。');if(body.date!==date||!Array.isArray(body.players))throw new Error('返回的比赛日期不一致。');
      if(!controller.signal.aborted)setState({key,data:body});
    }).catch(error=>{if(!controller.signal.aborted)setState({key,error:error instanceof Error?error.message:'读取失败，请重试。'});});return ()=>controller.abort();
  },[date,key]);
  const player=data?.players.find(p=>`${p.gameId}:${p.id}`===selected)||data?.players[0];
  const playerKey=player?`${player.gameId}:${player.id}`:'';const photoKey=`${player?.id||''}:${portraitRevision}`;
  const displayName=customName?.id===playerKey?customName.value:player?.chineseName||player?.name||'';
  useEffect(()=>{
    if(!player)return;const controller=new AbortController();loadCardPortrait(player.id,controller.signal).then(image=>{if(!controller.signal.aborted)setPortrait({key:photoKey,image});}).catch(()=>{if(!controller.signal.aborted)setPortrait({key:photoKey,error:'头像暂时未能读取，卡片会使用占位轮廓。'});});return ()=>controller.abort();
  },[player?.id,photoKey]);
  const picture=portrait?.key===photoKey?portrait:undefined;
  const renderKey=JSON.stringify([player,displayName,caption,monochrome,photoKey,!!picture?.image,picture?.error]);
  useEffect(()=>{
    if(!player||!picture)return;
    try{const canvas=renderPlayerCard(player,{name:displayName,caption,monochrome,portrait:picture.image});setPreview({key:renderKey,canvas,src:canvas.toDataURL('image/png')});}
    catch(error){setPreview(undefined);setMessage(error instanceof Error?error.message:'卡片生成失败。');}
  },[renderKey]);
  const currentPreview=preview?.key===renderKey?preview:undefined;
  const filtered=useMemo(()=>{const q=normalize(query),resolved=normalize(resolveSearch(query));return data?.players.filter(p=>!q||[p.name,p.chineseName||'',p.team].some(value=>normalize(value).includes(q))||normalize(p.name).includes(resolved))||[];},[data,query]);
  function choose(p:PlayerGameCard){setSelected(`${p.gameId}:${p.id}`);setCaption('单场表现');setMessage('');}
  async function download(){if(!player||!currentPreview||exportBusy.current)return;exportBusy.current=true;setExporting(true);setMessage('');try{await downloadPlayerCard(currentPreview.canvas,player);setMessage('高清 PNG 已生成，可以在下载中查看。');}catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}finally{exportBusy.current=false;setExporting(false);}}
  return <main className="card-tool-page">
    <header className="site-header"><a className="site-brand" href="/">Fantasy - All Timeline</a><ToolNavigation active="cards"/></header>
    <div className="card-tool-heading"><div><p className="eyebrow">PLAYER CARD STUDIO</p><h1>球员数据卡片</h1><p>选一位球员，把这一场的表现做成图片。</p></div><span className="card-format">单人卡 · 1080 × 1350</span></div>
    <div className="card-tool-layout">
      <section className="card-controls" aria-label="卡片设置">
        <div className="card-control-section"><h2><span>01</span> 选择比赛与球员</h2>
          <label className="card-field" htmlFor="card-date">比赛日（美东）<input id="card-date" type="date" value={date} min="2002-01-01" max="2100-12-31" onChange={event=>{setDate(event.target.value);setSelected('');setQuery('');setMessage('');}}/></label>
          <div className="card-data-status"><span>{data?`${data.completedGames} 场已完赛 · ${data.players.length} 位球员`:'读取当日比赛'}</span><button type="button" onClick={()=>setRevision(value=>value+1)}>刷新数据</button></div>
          {!validDate(date)?<p className="error" role="alert">请选择有效的比赛日期。</p>:error?<p className="error" role="alert">{error}</p>:!data?<p role="status">正在读取比赛数据…</p>:<>
            {!!data.pendingGames&&<p className="card-notice">另有 {data.pendingGames} 场尚未完赛，完赛后可刷新。</p>}
            {data.warnings.map(warning=><p className="error" key={warning}>{warning}</p>)}
            {data.players.length?<><label className="sr-only" htmlFor="card-search">查找当日球员</label><input id="card-search" className="card-search" placeholder="中文、英文姓名或球队" value={query} onChange={event=>setQuery(event.target.value)}/>
            <div className="card-player-list" aria-label="当日球员">{filtered.map(p=><button type="button" aria-pressed={playerKey===`${p.gameId}:${p.id}`} key={`${p.gameId}:${p.id}`} onClick={()=>choose(p)}><span className="card-player-dot" style={{background:p.color}}/><span><strong>{p.chineseName||p.name}</strong><small>{p.team} · {p.name}</small></span><b>{p.stats.pts}<small>分</small></b></button>)}{!filtered.length&&<p>没有找到这位球员，试试英文姓名。</p>}</div></>:<p className="card-notice">这一天还没有已完赛的 NBA 比赛。试试前一个比赛日。</p>}
          </>}
        </div>
        {player&&<div className="card-control-section"><h2><span>02</span> 调整卡片</h2>
          <label className="card-field" htmlFor="card-name">显示名称<input id="card-name" maxLength={30} value={displayName} onChange={event=>setCustomName({id:playerKey,value:event.target.value})}/></label>
          <label className="card-field" htmlFor="card-caption">一句短评<input id="card-caption" maxLength={14} value={caption} onChange={event=>setCaption(event.target.value)} placeholder="例如：开局就夯"/></label>
          <div className="card-caption-picks" aria-label="快捷短评">{['夯','顶','香','有好有坏','偏拉','拉'].map(label=><button type="button" key={label} onClick={()=>setCaption(label)}>{label}</button>)}</div>
          <fieldset className="card-palette"><legend>配色</legend><label><input type="radio" name="palette" checked={!monochrome} onChange={()=>setMonochrome(false)}/> 球队配色</label><label><input type="radio" name="palette" checked={monochrome} onChange={()=>setMonochrome(true)}/> 灰蓝</label></fieldset>
          <p className="card-source-note">数据来自 ESPN 已完赛记录；头像可能仍为此前赛季照片。卡片显示该场实际球队。</p>
          <a className="card-source-link" href={`https://www.espn.com/nba/boxscore/_/gameId/${player.gameId}`} target="_blank" rel="noreferrer">查看原始比赛数据 ↗</a>
        </div>}
      </section>
      <section className="card-preview-section" aria-label="卡片预览"><div className="card-preview-toolbar"><div><h2>图片预览</h2><span>预览即导出效果</span></div><button type="button" className="card-download" disabled={!currentPreview||exporting||!validDate(date)} onClick={download}>{exporting?'正在保存…':'下载高清 PNG ↓'}</button></div>
        {picture?.error&&<p className="card-notice" role="status">{picture.error} <button type="button" onClick={()=>setPortraitRevision(value=>value+1)}>重试头像</button></p>}
        <div className="card-preview-stage">{currentPreview?<img className="player-card-image" src={currentPreview.src} width={1080} height={1350} alt={`${displayName}单场数据卡：${player?cardStatLine(player,displayName):''}`}/>:<div className="card-preview-empty" role="status">{player?'正在准备头像和卡片…':'选择比赛日期，生成你的第一张球员卡。'}</div>}</div>
        <p className="card-export-message" role="status">{message}</p>
        {player&&<p className="card-readable-stats">{cardStatLine(player,displayName)}</p>}
      </section>
    </div>
  </main>;
}
