/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation also works in the Vinext runtime when a previous navigation is interrupted. */
export type ToolTab = 'players'|'schedule'|'briefings'|'cards'|'board'|'charts'|'rotation'|'posters'|'publications';
export default function ToolNavigation({active}:{active:ToolTab}){
  return <nav className="tool-navigation" aria-label="Fantasy 工具">
    <a href="/" aria-current={active==='players'?'page':undefined}>球员数据</a>
    <a href="/schedule" aria-current={active==='schedule'?'page':undefined}>每周赛程</a>
    <a href="/briefings" aria-current={active==='briefings'?'page':undefined}>每日简报</a>
    <a href="/player-cards" aria-current={active==='cards'?'page':undefined}>球员卡片</a>
    <a href="/surprise-board" aria-current={active==='board'?'page':undefined}>惊喜球员榜</a>
    <a href="/charts" aria-current={active==='charts'?'page':undefined}>图表生成</a>
    <a href="/rotation" aria-current={active==='rotation'?'page':undefined}>首发轮转</a>
    <a href="/posters" aria-current={active==='posters'?'page':undefined}>季前赛海报</a>
    <a href="/publications" aria-current={active==='publications'?'page':undefined}>发布手账</a>
  </nav>;
}
