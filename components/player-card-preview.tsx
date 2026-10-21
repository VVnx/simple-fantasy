'use client';
/* eslint-disable @next/next/no-img-element -- The preview is the exact downloadable PNG. */
import {useEffect,useRef,useState} from 'react';
import {CARD_WIDTH,CARD_HEIGHT,cardStatLine,type PlayerCardContent} from '@/lib/player-cards';
import {downloadPlayerCard,loadCardPortrait,renderPlayerCard} from '@/lib/player-card-image';

type Preview={key:string;src?:string;canvas?:HTMLCanvasElement;error?:string};
export default function PlayerCardPreview({player,pasted=false}:{player:PlayerCardContent;pasted?:boolean}){
  const [name,setName]=useState(player.chineseName||player.name),[monochrome,setMonochrome]=useState(false);
  const [revision,setRevision]=useState(0),[portrait,setPortrait]=useState<{key:string;image?:HTMLImageElement;error?:string}>();
  const [uploaded,setUploaded]=useState<HTMLImageElement>(),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState('');
  const [preview,setPreview]=useState<Preview>(),[message,setMessage]=useState(''),[exporting,setExporting]=useState(false);
  const uploadSequence=useRef(0),exportBusy=useRef(false);
  const photoKey=`${player.id||''}:${revision}`;
  useEffect(()=>{
    if(!player.id)return;
    const controller=new AbortController();
    loadCardPortrait(player.id,controller.signal).then(image=>{if(!controller.signal.aborted)setPortrait({key:photoKey,image});})
      .catch(()=>{if(!controller.signal.aborted)setPortrait({key:photoKey,error:'头像暂时未能读取，可重试或上传自己的图片。'});});
    return ()=>controller.abort();
  },[player.id,photoKey]);
  useEffect(()=>()=>{uploadSequence.current++;},[]);
  const picture=uploaded?{image:uploaded}:!player.id?{}:portrait?.key===photoKey?portrait:undefined;
  const renderKey=JSON.stringify([player,name,monochrome,photoKey,uploaded?.src,!!picture?.image,picture&&'error' in picture?picture.error:undefined,uploading]);
  useEffect(()=>{
    if(!picture||uploading)return;
    try{const canvas=renderPlayerCard(player,{name,monochrome,portrait:picture.image});setPreview({key:renderKey,canvas,src:canvas.toDataURL('image/png')});}
    catch(error){setPreview({key:renderKey,error:error instanceof Error?error.message:'卡片生成失败。'});}
    // renderKey captures the complete image inputs; a mismatched preview is never downloadable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[renderKey]);
  const current=preview?.key===renderKey?preview:undefined;
  async function upload(file:File|undefined){
    const sequence=++uploadSequence.current;setUploadError('');setMessage('');setUploading(false);
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){setUploadError('请选择 8 MB 以内的 PNG、JPG 或 WebP 图片。');return;}
    setUploading(true);const url=URL.createObjectURL(file);
    try{const image=new Image();image.src=url;await image.decode();if(sequence===uploadSequence.current)setUploaded(image);}
    catch{if(sequence===uploadSequence.current)setUploadError('这张图片无法读取，请换一张。');}
    finally{URL.revokeObjectURL(url);if(sequence===uploadSequence.current)setUploading(false);}
  }
  async function download(){
    if(!current?.canvas||exportBusy.current)return;
    exportBusy.current=true;setExporting(true);setMessage('');
    try{await downloadPlayerCard(current.canvas,{...player,name:name.trim()||player.name});setMessage('PNG 已生成，可在下载中查看。');}
    catch(error){setMessage(error instanceof Error?error.message:'下载失败，请重试。');}
    finally{exportBusy.current=false;setExporting(false);}
  }
  return <section className="card-preview-section row-preview" aria-label="卡片预览">
    <div className="card-preview-toolbar"><div><h2>横条预览</h2><span>头像在左 · 全部数据同一行 · 预览即导出效果</span></div><button type="button" className="card-download" disabled={!current?.canvas||exporting||uploading} onClick={download}>{exporting?'正在保存…':'下载高清 PNG ↓'}</button></div>
    {picture&&'error' in picture&&picture.error&&<p className="card-notice" role="status">{picture.error} <button type="button" onClick={()=>setRevision(v=>v+1)}>重试头像</button></p>}
    {current?.error&&<p className="error" role="alert">{current.error}</p>}
    <div className="card-preview-stage row-preview-stage">{current?.src?<img className="player-card-image row-card-image" src={current.src} width={CARD_WIDTH} height={CARD_HEIGHT} alt={`${name}横向数据卡：${cardStatLine(player,name)}`}/>:<div className="card-preview-empty" role="status">正在准备头像和卡片…</div>}</div>
    <p className="card-export-message" role="status">{message}</p>
    <p className="card-readable-stats">{cardStatLine(player,name)}</p>
    <div className="row-card-options">
      <label className="card-field" htmlFor="card-name">显示名称<input id="card-name" value={name} maxLength={30} onChange={e=>{setName(e.target.value);setMessage('');}}/></label>
      <fieldset className="card-palette"><legend>配色</legend><label><input type="radio" name="palette" checked={!monochrome} onChange={()=>setMonochrome(false)}/>{pasted?'深蓝':'球队配色'}</label><label><input type="radio" name="palette" checked={monochrome} onChange={()=>setMonochrome(true)}/>灰蓝</label></fieldset>
      <div className="row-upload"><label className="card-field" htmlFor="card-photo">{uploaded?'已使用上传头像':'上传头像（可选）'}<input id="card-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>{uploaded&&<button type="button" onClick={()=>{uploadSequence.current++;setUploaded(undefined);setUploading(false);}}>恢复默认头像</button>}{uploadError&&<p className="error" role="alert">{uploadError}</p>}</div>
    </div>
    <p className="card-source-note">{pasted?'使用你粘贴的数据，生成图片不会写入每日简报。':'数据来自 ESPN 已完赛记录，球队以该场比赛为准。'} 头像可能仍为此前赛季照片。</p>
    {player.gameId&&<a className="card-source-link" href={`https://www.espn.com/nba/boxscore/_/gameId/${player.gameId}`} target="_blank" rel="noreferrer">查看原始比赛数据 ↗</a>}
  </section>;
}
