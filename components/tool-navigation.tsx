/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation also works in the Vinext runtime when a previous navigation is interrupted. */
export default function ToolNavigation({active}:{active:'players'|'schedule'|'briefings'}){
  return <nav className="tool-navigation" aria-label="Fantasy 工具">
    <a href="/" aria-current={active==='players'?'page':undefined}>球员数据</a>
    <a href="/schedule" aria-current={active==='schedule'?'page':undefined}>每周赛程</a>
    <a href="/briefings" aria-current={active==='briefings'?'page':undefined}>每日简报</a>
  </nav>;
}
