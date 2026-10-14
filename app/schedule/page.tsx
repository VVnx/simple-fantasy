import ScheduleTool from '@/components/schedule-tool';
import { getScheduleSeason } from '@/lib/data/schedule';
import { currentEndYear } from '@/lib/seasons';
import { publicError } from '@/lib/data/errors';
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
