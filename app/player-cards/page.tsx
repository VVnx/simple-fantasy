import PlayerCardTool from '@/components/player-card-tool';
import {pageMetadata} from '@/lib/seo';
import {addDays,validDate} from '@/lib/schedule';
import {localDate} from '@/lib/player-cards';
export const metadata=pageMetadata('NBA 球员数据卡片','粘贴一行球员数据，或按比赛选择球员，生成头像在左、出场时间和完整表现横向排列的高清图片。','/player-cards');
export const dynamic='force-dynamic';
export default async function PlayerCardsPage({searchParams}:{searchParams:Promise<{date?:string}>}){
  const params=await searchParams;const date=typeof params.date==='string'&&validDate(params.date)?params.date:addDays(localDate(new Date()),-1);
  return <PlayerCardTool initialDate={date}/>;
}
