import ToolShell from '@/components/tool-shell';
import EmbeddedTool from '@/components/embedded-tool';
import {pageMetadata} from '@/lib/seo';
export const metadata = pageMetadata('NBA 首发与轮转工具', '调整 30 支球队的首发与轮转，交换球员、保存方案并导出单队图片或整套 ZIP。', '/rotation');
export default function RotationPage() {
  return <ToolShell active="rotation"><EmbeddedTool src="/tools/rotation/index.html" title="NBA 首发与轮转工具" note="预载：2026 年 10 月 9 日历史预测 · 旧工具的 JSON 配置可直接导入，修改自动保存在当前浏览器"/></ToolShell>;
}
