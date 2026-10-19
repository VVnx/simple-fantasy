/* eslint-disable @next/next/no-html-link-for-pages -- Keep full navigation on the Sites runtime. */
import ToolNavigation from '@/components/tool-navigation';

export default function BriefingNotFound() {
  return <main className="briefings-page">
    <header className="site-header"><a className="site-brand" href="/">Fantasy - All Timeline</a><ToolNavigation active="briefings"/></header>
    <div className="briefings-body briefings-empty"><h1>暂无这篇简报</h1><a href="/briefings">返回每日简报列表</a></div>
  </main>;
}
