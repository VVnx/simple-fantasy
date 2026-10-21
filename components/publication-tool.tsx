'use client';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import seed from '@/data/tools/publications.json';
import {STATUS_LABELS, STORAGE_KEY, parseBackup, serializeBackup, summarize, validateTeam, type Team} from '@/lib/publication-records';
import {downloadBlob} from '@/lib/download';

const labels: Record<string,string> = STATUS_LABELS;
export default function PublicationTool() {
  const [teams, setTeams] = useState<Team[]>(seed.teams);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState<Team|null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Team[]|null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const importer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTeams(parseBackup(raw, seed.teams));
    } catch (e) { setError(`本机登记读取失败，当前展示初始登记。${e instanceof Error ? e.message : ''}`); }
    setReady(true);
  }, []);
  useEffect(() => { if (active) dialog.current?.showModal(); else dialog.current?.close(); }, [active]);
  useEffect(() => { if (pending) importer.current?.showModal(); else importer.current?.close(); }, [pending]);
  function persist(next:Team[]) {
    try { localStorage.setItem(STORAGE_KEY, serializeBackup(next)); }
    catch { setError('浏览器无法保存，请检查存储空间。原登记未被更改。'); return false; }
    setTeams(next); setError(''); setMessage('已保存到当前浏览器。'); return true;
  }
  async function importFile(input?:File) {
    if (!input) return;
    try {
      if (input.size > 1024 * 1024) throw Error('备份文件不能超过 1 MB。');
      setPending(parseBackup(await input.text(), seed.teams)); setError('');
    } catch(e) { setError(e instanceof Error ? e.message : '导入失败。'); }
    if (file.current) file.current.value = '';
  }
  const counts = summarize(teams);
  const visible = teams.filter(t => (filter === 'all' || t.status === filter || (filter === 'plans' && t.draftPlan) || (filter === 'lineups' && t.startingFive)) && `${t.name} ${t.english} ${t.id}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="publication-tool">
    <div className="media-heading"><div><p className="eyebrow">2026–27 / 球队前瞻</p><h1>30 支球队，写到哪里了？</h1><p className="muted">初始登记 {seed.asOf} · 修改保存在当前浏览器，可导入旧手账备份继续编辑。</p></div><div className="media-actions">
      <button disabled={!ready} onClick={()=>file.current?.click()}>导入备份</button>
      <button disabled={!ready} onClick={()=>downloadBlob(new Blob([serializeBackup(teams)],{type:'application/json'}),'fantasy-publications.json')}>导出登记</button>
      <input ref={file} type="file" accept=".json,application/json" hidden aria-label="导入发布登记备份" onChange={e=>void importFile(e.target.files?.[0])}/>
    </div></div>
    {error && <p className="media-error" role="alert">{error}</p>}
    {message && !error && <p className="media-message" role="status">{message}</p>}
    <div className="publication-summary" aria-label="发布概览"><div><strong>{counts.published}<small> / {counts.total}</small></strong><span>已确认发表</span></div><div><strong>{teams.filter(t=>t.draftPlan).length}</strong><span>选秀计划图</span></div><div><strong>{teams.filter(t=>t.startingFive).length}</strong><span>原预测首发</span></div><div><strong>{teams.filter(t=>t.publishedAt).length}</strong><span>已登记发表时间</span></div></div>
    <div className="publication-filters"><label>搜索球队<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="球队名 / 英文 / BOS"/></label><label>查看范围<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部球队</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="plans">有选秀计划</option><option value="lineups">有原预测首发</option></select></label><span className="muted">{visible.length} 支球队</span></div>
    <div className="publication-list">{visible.map(t=><button className="publication-row" key={t.id} onClick={()=>{setEditing(false);setActive(t);}}><span className="publication-code">{t.id}</span><span><strong>{t.name}</strong><small>{t.title || t.english}</small></span><span className="publication-status">{labels[t.status]}</span><span className="publication-date">{t.publishedAt ? t.publishedAt.slice(0,16).replace('T',' ') : '发表时间未登记'}</span><span aria-hidden="true">↗</span></button>)}</div>
    {!visible.length && <p className="tool-loading">没有匹配的球队，请调整搜索条件。</p>}
    <p className="media-footnote">原预测首发和选秀计划均保留原稿日期。手账只记录发布进度，不会向公众号发送内容。</p>
    <dialog className="media-dialog" ref={dialog} onCancel={()=>setActive(null)} onClose={()=>setActive(null)} aria-labelledby="publication-dialog-title">
      {active && <><div className="media-dialog-heading"><div><p className="eyebrow">{active.id} · {active.conference}</p><h2 id="publication-dialog-title">{active.name}</h2></div><button onClick={()=>setActive(null)} aria-label="关闭球队详情">✕</button></div>
      {editing ? <TeamEditor key={active.id} team={active} onCancel={()=>setEditing(false)} onSave={team=>{if(!persist(teams.map(t=>t.id===team.id?team:t)))return false;setActive(team);setEditing(false);return true;}}/> : <>
        <div className="publication-detail"><span className="publication-status">{labels[active.status]}</span><h3>{active.title || '文章标题尚未登记'}</h3><p>发表时间：{active.publishedAt ? `${active.publishedAt.slice(0,16).replace('T',' ')}（北京时间）` : '尚未登记'}</p><p>{active.note || '暂无备注'}</p>{active.url && <a href={active.url} target="_blank" rel="noreferrer">打开公众号文章 ↗</a>}<div className="media-actions"><button className="media-primary" disabled={!ready} onClick={()=>setEditing(true)}>编辑发布记录</button></div></div>
        {active.startingFive && <section className="publication-attachment"><h3>原预测首发 <small>{active.startingFive.receivedAt}</small></h3><div className="publication-lineup">{Object.entries(active.startingFive.players).map(([pos,name])=><div key={pos}><small>{pos}</small><strong>{name}</strong></div>)}</div>{active.startingFive.note && <p>{active.startingFive.note}</p>}<a href={active.startingFive.image} target="_blank" rel="noreferrer">查看完整阵容深度图 ↗</a></section>}
        {active.draftPlan && <section className="publication-attachment"><h3>我的选秀想法 <small>{active.draftPlan.receivedAt}</small></h3><a href={active.draftPlan.image} target="_blank" rel="noreferrer"><img src={active.draftPlan.image} width={active.draftPlan.width} height={active.draftPlan.height} loading="lazy" alt={`${active.name}选秀计划原图`}/></a><p className="muted">点击图片可查看原尺寸</p></section>}
      </>}</>}
    </dialog>
    <dialog className="media-dialog media-dialog-small" ref={importer} onCancel={()=>setPending(null)} onClose={()=>setPending(null)} aria-labelledby="import-dialog-title"><h2 id="import-dialog-title">导入 30 队登记</h2><p>新备份将替换当前浏览器中的登记。球队配图和原预测首发会保留。</p><div className="media-actions"><button onClick={()=>setPending(null)}>取消</button><button className="media-primary" onClick={()=>{if(pending&&persist(pending)){setPending(null);setMessage('已导入 30 队登记。');}}}>导入并替换</button></div>{error&&<p role="alert" className="media-error">{error}</p>}</dialog>
  </section>;
}

function TeamEditor({team,onSave,onCancel}:{team:Team;onSave:(team:Team)=>boolean;onCancel:()=>void}) {
  const [draft,setDraft] = useState({...team,publishedAt:team.publishedAt.slice(0,16)});
  const [error,setError] = useState('');
  function save(event:FormEvent) {
    event.preventDefault();
    try { if(!onSave(validateTeam({...draft,source:'手动登记'},team)))setError('浏览器保存失败，请重试。'); }
    catch(e){setError(e instanceof Error?e.message:'保存失败。');}
  }
  return <form className="media-form" onSubmit={save}>
    <label>发布状态<select value={draft.status} disabled={!!team.draftPlan} onChange={e=>setDraft({...draft,status:e.target.value,publishedAt:e.target.value==='published'?draft.publishedAt:''})}>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    {team.draftPlan && <p className="muted">已按你提供的选秀计划确认发表。</p>}
    <label>文章标题<input value={draft.title} maxLength={300} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label>发表时间（北京时间）<input type="datetime-local" disabled={draft.status!=='published'} value={draft.publishedAt} onChange={e=>setDraft({...draft,publishedAt:e.target.value})}/></label>
    <label>公众号文章链接<input type="url" value={draft.url} maxLength={8000} placeholder="https://mp.weixin.qq.com/…" onChange={e=>setDraft({...draft,url:e.target.value})}/></label>
    <label>备注<textarea rows={4} value={draft.note} maxLength={2000} onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
    {error&&<p role="alert" className="media-error">{error}</p>}
    <div className="media-actions"><button type="submit" className="media-primary">保存登记</button><button type="button" onClick={onCancel}>取消</button></div>
  </form>;
}
