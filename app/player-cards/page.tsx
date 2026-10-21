import PlayerCardTool from '@/components/player-card-tool';
import {pageMetadata} from '@/lib/seo';
import {addDays,validDate} from '@/lib/schedule';
import {localDate} from '@/lib/player-cards';
export const metadata=pageMetadata('NBA 球员数据卡片','选择 NBA 球员和比赛，生成带头像、得分、篮板、助攻、三分与完整单场数据的高清图片。','/player-cards');
export const dynamic='force-dynamic';
export default async function PlayerCardsPage({searchParams}:{searchParams:Promise<{date?:string}>}){
  const params=await searchParams;const date=typeof params.date==='string'&&validDate(params.date)?params.date:addDays(localDate(new Date()),-1);
  return <PlayerCardTool initialDate={date}/>;
}
