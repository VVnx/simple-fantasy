import ToolShell from '@/components/tool-shell';
import EmbeddedTool from '@/components/embedded-tool';
import {pageMetadata} from '@/lib/seo';
export const metadata = pageMetadata('Fantasy 图表生成器', '粘贴 Markdown，生成带球员头像的阵容表、重点与陷阱排名、轮次分层和位置分层图。', '/charts');
export default function ChartsPage() {
  return <ToolShell active="charts"><EmbeddedTool src="/tools/charts/index.html" title="Fantasy 图表生成器" note="阵容、排名、轮次、位置四种图表 · 示例保留原稿日期，粘贴内容即可重新生成"/></ToolShell>;
}
