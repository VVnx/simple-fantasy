'use client';
import {useEffect, useRef, useState} from 'react';
import archive from '@/data/tools/poster-reports.json';
import {normalizePosterReport, parsePosterImport, posterKey, type PosterReport} from '@/lib/poster-report';
import {downloadBlob, zipFiles} from '@/lib/download';

const STORAGE_KEY='alltimeline-posters:v1';
const initialReports=archive.map(normalizePosterReport);
const toParagraphs=(value:string)=>value.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
const backup=(reports:PosterReport[])=>JSON.stringify({version:1,reports},null,2);
export default function PosterTool() {
  const [reports,setReports]=useState(initialReports);
  const [date,setDate]=useState(initialReports[0].reportDate);
  const [id,setId]=useState(initialReports[0].cards[0].id);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [ready,setReady]=useState(false);
  const [preview,setPreview]=useState<{url:string;blob:Blob}[]>([]);
  const [rendering,setRendering]=useState(false);
  const [warnings,setWarnings]=useState<string[]>([]);
  const [previewError,setPreviewError]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState<PosterReport[]|null>(null);
  const file=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDialogElement>(null);
  const report=reports.find(r=>r.reportDate===date)??reports[0];
  const card=report.cards.find(c=>c.id===id)??report.cards[0];
  const key=posterKey(report.reportDate,card.id);
  const saved=card.poster.paragraphs.join('\n\n');
  const comment=drafts[key]??saved;
  const dirty=comment!==saved;
  const hasDrafts=reports.some(r=>r.cards.some(c=>{const draft=drafts[posterKey(r.reportDate,c.id)];return draft!==undefined&&draft!==c.poster.paragraphs.join('\n\n');}));
  useEffect(()=>{
    try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const stored=parsePosterImport(raw);setReports(stored);setDate(stored[0].reportDate);setId(stored[0].cards[0].id);}}
    catch(e){setError(`本机存档读取失败，当前展示原始报告。${e instanceof Error?e.message:''}`);}
    setReady(true);
  },[]);
  useEffect(()=>{
    if(!hasDrafts)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[hasDrafts]);
  useEffect(()=>{if(pending)dialog.current?.showModal();else dialog.current?.close();},[pending]);
  useEffect(()=>{
    if(!ready)return;
    let cancelled=false;const urls:string[]=[];
    setRendering(true);setPreview([]);setPreviewError('');setWarnings([]);
    const timer=setTimeout(async()=>{
      try{
        const {renderPoster}=await import('@/lib/poster-render');
        const result=await renderPoster(report,card,toParagraphs(comment));
        if(cancelled)return;
        setPreview(result.images.map(blob=>{const url=URL.createObjectURL(blob);urls.push(url);return{url,blob};}));setWarnings(result.warnings);
      }catch(e){if(!cancelled)setPreviewError(e instanceof Error?e.message:'生成失败。');}
      finally{if(!cancelled)setRendering(false);}
    },350);
    return()=>{cancelled=true;clearTimeout(timer);urls.forEach(url=>URL.revokeObjectURL(url));};
  },[ready,report,card,comment]);
  function persist(next:PosterReport[]){
    try{localStorage.setItem(STORAGE_KEY,backup(next));setReports(next);setError('');return true;}
    catch{setError('浏览器无法保存，请先导出草稿备份。');return false;}
  }
  function save(){
    const next=reports.map(r=>r.reportDate!==report.reportDate?r:{...r,cards:r.cards.map(c=>c.id!==card.id?c:{...c,poster:{paragraphs:toParagraphs(comment)}})});
    if(persist(next)){setDrafts(current=>{const copy={...current};delete copy[key];return copy;});setMessage(`${card.team.name}短评已保存到当前浏览器。`);}
  }
  function allDrafts(){return reports.map(r=>({...r,cards:r.cards.map(c=>({...c,poster:{paragraphs:toParagraphs(drafts[posterKey(r.reportDate,c.id)]??c.poster.paragraphs.join('\n\n'))}}))}));}
  async function importFile(input?:File){
    if(!input)return;
    try{if(input.size>20*1024*1024)throw Error('报告文件不能超过 20 MB。');setPending(parsePosterImport(await input.text()));setError('');}
    catch(e){setError(e instanceof Error?e.message:'导入失败。');}
    if(file.current)file.current.value='';
  }
  async function exportAll(){
    setBusy(true);setError('');
    try{
      const {renderPoster}=await import('@/lib/poster-render');
      const entries:{name:string;bytes:Uint8Array<ArrayBuffer>}[]=[];
      for(const [index,team] of report.cards.entries()){
        setMessage(`正在生成 ${index+1}/${report.cards.length}：${team.team.name}`);
        const result=await renderPoster(report,team,toParagraphs(drafts[posterKey(report.reportDate,team.id)]??team.poster.paragraphs.join('\n\n')));
        if(result.warnings.length)throw Error(`${team.team.name}头像未完整加载，请检查预览后重试。${result.warnings.join('；')}`);
        for(const [page,blob] of result.images.entries())entries.push({name:`${report.reportDate}-${team.id}-${page+1}.png`,bytes:new Uint8Array(await blob.arrayBuffer())});
      }
      downloadBlob(zipFiles(entries),`NBA季前赛观察-${report.reportDate}.zip`);setMessage(`已下载 ${entries.length} 张海报，包含本期各队当前草稿。`);
    }catch(e){setError(e instanceof Error?e.message:'打包失败。');setMessage('');}
    finally{setBusy(false);}
  }
  return <section className="poster-tool">
    <div className="media-heading"><div><p className="eyebrow">SEASON NOTES / 海报工作台</p><h1>把观察，放进一张海报。</h1><p className="muted">保留原稿首发和配色。编辑短评，导出 1080 × 1440 高清图片。</p></div><div className="media-actions"><button disabled={!ready||busy} onClick={()=>file.current?.click()}>导入报告</button><button disabled={!ready||busy} onClick={()=>downloadBlob(new Blob([backup(allDrafts())],{type:'application/json'}),'nba-poster-drafts.json')}>导出全部草稿</button><input ref={file} type="file" accept=".json,application/json" hidden aria-label="导入海报报告" onChange={e=>void importFile(e.target.files?.[0])}/></div></div>
    {error&&<p role="alert" className="media-error">{error}</p>}{message&&<p role="status" className="media-message">{message}</p>}
    <div className="poster-workspace">
      <aside className="poster-controls media-form">
        <label>选择日期<select disabled={!ready||busy} value={report.reportDate} onChange={e=>{const next=reports.find(r=>r.reportDate===e.target.value)!;setDate(next.reportDate);setId(next.cards[0].id);setMessage('');}}>{reports.map(r=><option key={r.reportDate} value={r.reportDate}>{r.reportDate} · {r.cards.length} 队</option>)}</select></label>
        <label>选择球队<select disabled={!ready||busy} value={card.id} onChange={e=>{setId(e.target.value);setMessage('');}}>{report.cards.map(c=><option value={c.id} key={c.id}>{c.team.name}</option>)}</select></label>
        <p className="poster-game">{card.game?.opponent?`对阵 ${card.game.opponent}`:''} {card.game?.score??''}<br/><span>预测基准：{card.prediction.version??'原稿首发'}</span></p>
        <label>个人观察<textarea rows={12} disabled={!ready||busy} maxLength={20000} value={comment} onChange={e=>setDrafts({...drafts,[key]:e.target.value})} placeholder="空行分段，写下你的短评…"/></label>
        <p className="muted">输入后自动更新，长文会生成续页。下载使用当前草稿，保存后可下次继续。</p>
        <div className="media-actions"><button className="media-primary" disabled={!ready||busy||rendering||!!previewError} onClick={save}>保存短评</button><button disabled={!dirty||busy} onClick={()=>setDrafts(current=>{const copy={...current};delete copy[key];return copy;})}>恢复已保存内容</button></div>
        <p className="poster-save-state" role="status">{dirty?'有未保存的短评':'与已保存内容一致'}</p>
        <button className="poster-export" disabled={!ready||busy} onClick={()=>void exportAll()}>{busy?'正在打包…':'下载整期 PNG（ZIP）'}</button>
        <p className="media-footnote">历史报告：2026 年 10 月 5–8 日。可导入原工具的 cards.json 或这里导出的备份，增加其他日期。</p>
      </aside>
      <section className="poster-preview" aria-label="海报预览"><div className="poster-preview-heading"><strong>实时预览</strong><span role="status">{rendering?'正在生成…':previewError?'生成失败':`${preview.length} 页 · 1080 × 1440`}</span></div>
        {previewError&&<p role="alert" className="media-error">{previewError}</p>}
        {warnings.length>0&&<p role="status" className="media-error">{warnings.join('；')}。图片会标明待补头像。</p>}
        <div className="poster-pages">{preview.map((page,index)=><figure key={page.url}><img src={page.url} width={1080} height={1440} alt={`${card.team.name}季前赛观察，第 ${index+1} 页`}/><figcaption><span>第 {index+1} 页</span><button disabled={busy} onClick={()=>downloadBlob(page.blob,`${report.reportDate}-${card.id}-${index+1}.png`)}>下载 PNG</button></figcaption></figure>)}</div>
      </section>
    </div>
    <dialog ref={dialog} className="media-dialog media-dialog-small" onCancel={()=>setPending(null)} onClose={()=>setPending(null)} aria-labelledby="poster-import-title"><h2 id="poster-import-title">导入海报报告</h2><p>将导入 {pending?.length??0} 个日期。相同日期的已保存内容和草稿会被替换，其余日期保留。</p><div className="media-actions"><button onClick={()=>setPending(null)}>取消</button><button className="media-primary" onClick={()=>{
      if(!pending)return;
      const dates=new Set(pending.map(r=>r.reportDate));const next=[...reports.filter(r=>!dates.has(r.reportDate)),...pending].sort((a,b)=>b.reportDate.localeCompare(a.reportDate));
      if(persist(next)){setDrafts(current=>Object.fromEntries(Object.entries(current).filter(([key])=>!dates.has(key.split('/')[0]))));setDate(pending[0].reportDate);setId(pending[0].cards[0].id);setPending(null);setMessage('报告已导入并保存到当前浏览器。');}
    }}>导入并保存</button></div>{error&&<p role="alert" className="media-error">{error}</p>}</dialog>
  </section>;
}
