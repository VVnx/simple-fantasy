import {BriefingError,validateBriefingDate} from '@/lib/briefings';
import {getBriefingView} from '@/lib/data/briefings';
import {structureBriefing} from '@/lib/briefing-structure';
import {API_ROBOTS_HEADERS} from '@/lib/seo';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={...API_ROBOTS_HEADERS,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request){
  try{
    const date=new URL(request.url).searchParams.get('date');
    const view=await getBriefingView(date===null?undefined:validateBriefingDate(date));
    return Response.json({briefing:view.briefing?structureBriefing(view.briefing):null,previousDate:view.previousDate,nextDate:view.nextDate},{headers});
  }catch(error){return Response.json({error:error instanceof BriefingError?error.message:'简报比赛信息暂时无法读取，请稍后重试。'},{status:error instanceof BriefingError?error.status:503,headers});}
}
