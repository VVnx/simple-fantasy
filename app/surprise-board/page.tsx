import SurpriseBoard from '@/components/surprise-board';
import {pageMetadata} from '@/lib/seo';
import {validDate} from '@/lib/schedule';
import {localDate} from '@/lib/player-cards';
export const metadata=pageMetadata('惊喜球员拖拽榜','自由摆放每日惊喜球员头像，制作从夯到拉的排名图并下载高清图片。','/surprise-board');
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{date?:string}>}){
  const params=await searchParams;return <SurpriseBoard initialDate={typeof params.date==='string'&&validDate(params.date)?params.date:localDate(new Date())}/>;
}
