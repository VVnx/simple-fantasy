import ScheduleTool from '@/components/schedule-tool';
import { getScheduleSeason } from '@/lib/data/schedule';
import { currentEndYear } from '@/lib/seasons';
import { publicError } from '@/lib/data/errors';
import { pageMetadata } from '@/lib/seo';
export const metadata=pageMetadata('NBA 每周赛程与双周赛程', '查看 NBA 30 支球队的单周与双周赛程、比赛场次、主客场对手和背靠背，按场次排序并导出完整赛程图片，辅助 Fantasy 阵容安排。', '/schedule');
export const dynamic='force-dynamic';
export default async function SchedulePage(){
  const today=new Date();
  try{
    const season=await getScheduleSeason(currentEndYear(today));
    return <ScheduleTool today={today.toISOString()} season={season}/>;
  }catch(error){
    console.error('[schedule:season]',JSON.stringify(publicError(error)));
    return <ScheduleTool today={today.toISOString()}/>;
  }
}
