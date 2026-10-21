'use client';
/* eslint-disable @next/next/no-img-element -- Athlete thumbnails use the restricted same-origin image endpoint. */
import {useEffect,useMemo,useState} from 'react';
import ToolNavigation from './tool-navigation';
import PlayerCardPreview from './player-card-preview';
import {normalize,resolveSearch} from '@/lib/aliases';
import {CARD_WIDTH,CARD_HEIGHT,type CardDay,type PlayerCardContent} from '@/lib/player-cards';
import {CARD_PASTE_EXAMPLE,matchingPortrait,parsePlayerCardLine} from '@/lib/player-card-paste';
import {validDate} from '@/lib/schedule';
import type {Player} from '@/lib/types';

function PastedCard({player}:{player:PlayerCardContent}){
  const [query,setQuery]=useState(player.name),[search,setSearch]=useState({query:player.name,revision:0});
  const [state,setState]=useState<{key:string;players?:Player[];error?:string}>(),[selected,setSelected]=useState<Player>();
  const key=`${search.query}:${search.revision}`;
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`/api/players?q=${encodeURIComponent(search.query)}`,{signal:controller.signal}).then(async response=>{
      const body=await response.json() as {players?:Player[];error?:string};
      if(!response.ok||!Array.isArray(body.players))throw new Error(body.error||'头像查找暂时不可用，请重试或上传头像。');
      if(!controller.signal.aborted){setState({key,players:body.players});setSelected(matchingPortrait(body.players,search.query));}
    }).catch(error=>{if(!controller.signal.aborted)setState({key,error:error instanceof Error?error.message:'头像查找失败。'});});
    return ()=>controller.abort();
  },[search.query,key]);
  const current=state?.key===key?state:undefined;
  const entry=useMemo(()=>({...player,id:selected?.id}),[player,selected]);
  return <>
    <div className="row-avatar-picker">
      <div className="row-avatar-heading"><div><h2>球员头像</h2><p>{selected?`已选择 ${selected.chineseName||selected.name} · ${selected.name}`:current?.players?.length?'点选对应球员的头像。简称可能对应多名球员。':'可以用中文全名、英文名查找，也可以在下方上传头像。'}</p></div>
        <form className="row-avatar-search" onSubmit={event=>{event.preventDefault();setSelected(undefined);setSearch({query:query.trim(),revision:search.revision+1});}}><label className="sr-only" htmlFor="portrait-search">查找头像</label><input id="portrait-search" value={query} maxLength={80} onChange={e=>setQuery(e.target.value)} placeholder="输入球员全名"/><button type="submit" disabled={query.trim().length<2}>查找头像</button></form>
      </div>
      {!current?<p className="card-notice" role="status">正在查找球员头像，数据卡已在下方生成…</p>:current.error?<p className="card-notice" role="status">{current.error}</p>:current.players?.length?<div className="row-avatar-results" aria-label="选择球员头像">{current.players.map(p=><button type="button" key={p.id} aria-pressed={selected?.id===p.id} onClick={()=>setSelected(p)}><img src={`/api/player-headshot?id=${p.id}`} alt="" loading="lazy"/><span><strong>{p.chineseName||p.name}</strong><small>{p.name} · {p.team}</small></span></button>)}</div>:<p className="card-notice">没有找到头像，试试英文全名，或在下方上传图片。</p>}
    </div>
    <PlayerCardPreview player={entry} pasted/>
  </>;
}

function PasteSource(){
  const [text,setText]=useState(''),[error,setError]=useState(''),[submission,setSubmission]=useState<{text:string;player:PlayerCardContent;revision:number}>();
  const current=submission?.text===text?submission:undefined;
  function generate(){try{setSubmission({text,player:parsePlayerCardLine(text),revision:(submission?.revision??0)+1});setError('');}catch(error){setSubmission(undefined);setError(error instanceof Error?error.message:'数据无法识别。');}}
  return <>
    <section className="row-paste-panel" aria-label="粘贴数据">
      <label htmlFor="card-paste">粘贴一行球员数据</label>
      <textarea id="card-paste" rows={3} maxLength={1000} value={text} placeholder={CARD_PASTE_EXAMPLE} onChange={e=>{setText(e.target.value);setError('');}}/>
      <div className="row-paste-actions"><span>球队、姓名、出场时间及全部数据一起粘贴。<button type="button" onClick={()=>{setText(CARD_PASTE_EXAMPLE);setError('');}}>填入示例</button></span><button type="button" className="card-download" disabled={!text.trim()} onClick={generate}>生成卡片 →</button></div>
      {error&&<p className="error" role="alert">{error}</p>}
    </section>
    {current?<PastedCard key={current.revision} player={current.player}/>:<div className="row-card-empty"><span>01 / 粘贴数据</span><span>02 / 确认头像</span><span>03 / 下载横条</span><p>{submission?'数据已修改，点击「生成卡片」更新预览。':'不需要先发布简报，直接把一行表现做成图片。'}</p></div>}
  </>;
}

function GameSource({initialDate}:{initialDate:string}){
  const [date,setDate]=useState(initialDate),[revision,setRevision]=useState(0),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
  const [state,setState]=useState<{key:string;data?:CardDay;error?:string}>();
  const key=`${date}:${revision}`,data=state?.key===key?state.data:undefined,error=state?.key===key?state.error:undefined;
  useEffect(()=>{
    if(!validDate(date))return;
    const controller=new AbortController();fetch(`/api/player-cards?date=${date}`,{signal:controller.signal}).then(async response=>{
      const body=await response.json() as CardDay&{error?:string};if(!response.ok)throw new Error(body.error||'比赛数据暂时无法读取。');if(body.date!==date||!Array.isArray(body.players))throw new Error('返回的比赛日期不一致。');
      if(!controller.signal.aborted)setState({key,data:body});
    }).catch(error=>{if(!controller.signal.aborted)setState({key,error:error instanceof Error?error.message:'读取失败，请重试。'});});return ()=>controller.abort();
  },[date,key]);
  const player=data?.players.find(p=>`${p.gameId}:${p.id}`===selected)||data?.players[0];
  const filtered=useMemo(()=>{const q=normalize(query),resolved=normalize(resolveSearch(query));return data?.players.filter(p=>!q||[p.name,p.chineseName||'',p.team].some(value=>normalize(value).includes(q))||normalize(p.name).includes(resolved))||[];},[data,query]);
  return <>
    <section className="row-game-panel" aria-label="选择比赛与球员">
      <div className="row-game-filters"><label className="card-field" htmlFor="card-date">比赛日（美东）<input id="card-date" type="date" value={date} min="2002-01-01" max="2100-12-31" onChange={e=>{setDate(e.target.value);setSelected('');setQuery('');}}/></label>
        <label className="card-field" htmlFor="card-search">查找当日球员<input id="card-search" placeholder="中文、英文姓名或球队" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="card-data-status"><span>{data?`${data.completedGames} 场已完赛 · ${data.players.length} 位球员`:'读取当日比赛'}</span><button type="button" onClick={()=>setRevision(v=>v+1)}>刷新数据</button></div>
      </div>
      {!validDate(date)?<p className="error" role="alert">请选择有效的比赛日期。</p>:error?<p className="error" role="alert">{error}</p>:!data?<p role="status">正在读取比赛数据…</p>:<>
        {!!data.pendingGames&&<p className="card-notice">另有 {data.pendingGames} 场尚未完赛，完赛后可刷新。</p>}
        {data.warnings.map(warning=><p className="error" key={warning}>{warning}</p>)}
        <div className="card-player-list row-game-players" aria-label="当日球员">{filtered.map(p=><button type="button" aria-pressed={player?.gameId===p.gameId&&player?.id===p.id} key={`${p.gameId}:${p.id}`} onClick={()=>setSelected(`${p.gameId}:${p.id}`)}><span className="card-player-dot" style={{background:p.color}}/><span><strong>{p.chineseName||p.name}</strong><small>{p.team} · {p.name}</small></span><b>{p.stats.pts}<small>分</small></b></button>)}</div>
        {!filtered.length&&<p className="card-notice">{data.players.length?'没有找到这位球员，试试英文姓名。':'这一天还没有已完赛的 NBA 比赛，也可以直接粘贴数据生成。'}</p>}
      </>}
    </section>
    {player&&validDate(date)&&<PlayerCardPreview key={`${player.gameId}:${player.id}`} player={player}/>}
  </>;
}

export default function PlayerCardTool({initialDate}:{initialDate:string}){
  const [mode,setMode]=useState<'paste'|'game'>('paste');
  return <main className="card-tool-page row-card-tool">
    <header className="site-header"><a className="site-brand" href="/">Fantasy - All Timeline</a><ToolNavigation active="cards"/></header>
    <div className="card-tool-heading"><div><p className="eyebrow">PLAYER CARD STUDIO</p><h1>球员数据卡片</h1><p>粘贴一行表现，生成一张横条。</p></div><span className="card-format">单人横条 · {CARD_WIDTH} × {CARD_HEIGHT}</span></div>
    <div className="row-source-tabs" role="group" aria-label="数据来源"><button type="button" aria-pressed={mode==='paste'} onClick={()=>setMode('paste')}>粘贴一行数据</button><button type="button" aria-pressed={mode==='game'} onClick={()=>setMode('game')}>按比赛选择</button></div>
    {mode==='paste'?<PasteSource/>:<GameSource initialDate={initialDate}/>}
  </main>;
}
