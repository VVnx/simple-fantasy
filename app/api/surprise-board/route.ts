import {getBriefingView} from '@/lib/data/briefings';
import {getCardDay} from '@/lib/data/player-cards';
import {BriefingError,validateBriefingDate} from '@/lib/briefings';
import {addDays} from '@/lib/schedule';
import {matchSurprisePlayers} from '@/lib/surprise-board';
import {API_ROBOTS_HEADERS} from '@/lib/seo';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={...API_ROBOTS_HEADERS,'Cache-Control':'no-store'};
export async function GET(request:Request){
  try{
    const date=validateBriefingDate(new URL(request.url).searchParams.get('date')||'');
    const {briefing}=await getBriefingView(date);
    if(!briefing)return Response.json({date,players:[],total:0,warnings:[],message:'这一天还没有已发布的简报。'},{headers});
    if(!/附录[：:]\s*惊喜球员表现明细/.test(briefing.content))return Response.json({date,players:[],total:0,warnings:[],message:'这篇简报没有惊喜球员表现明细。'},{headers});
    const day=await getCardDay(addDays(date,-1));
    const matched=matchSurprisePlayers(briefing.content,day.players);
    return Response.json({date,...matched,warnings:[...day.warnings,...matched.warnings]},{headers});
  }catch(error){return Response.json({error:error instanceof BriefingError?error.message:'惊喜球员暂时无法读取，请稍后重试。'},{status:error instanceof BriefingError?error.status:502,headers});}
}
