import PublicationTool from '@/components/publication-tool';
import ToolShell from '@/components/tool-shell';
import {pageMetadata} from '@/lib/seo';
export const metadata = pageMetadata('球队发布手账', '管理 30 支球队的前瞻文章、发布登记和选秀计划图，支持本机保存与备份。', '/publications');
export default function PublicationsPage() {
  return <ToolShell active="publications"><PublicationTool/></ToolShell>;
}
