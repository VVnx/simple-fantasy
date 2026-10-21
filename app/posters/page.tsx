import PosterTool from '@/components/poster-tool';
import ToolShell from '@/components/tool-shell';
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('季前赛海报工作台','编辑球队观察，预览预测与实际首发，导出高清海报、整期 ZIP 和草稿备份。','/posters');
export default function PostersPage(){return <ToolShell active="posters"><PosterTool/></ToolShell>;}
