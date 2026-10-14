import ScheduleTool from '@/components/schedule-tool';
import { getScheduleSeason } from '@/lib/data/schedule';
import { currentEndYear } from '@/lib/seasons';
export const dynamic='force-dynamic';
export default async function SchedulePage(){
  const today=new Date();
  try{
    const season=await getScheduleSeason(currentEndYear(today));
    return <ScheduleTool today={today.toISOString()} season={season}/>;
  }catch{
    return <ScheduleTool today={today.toISOString()}/>;
  }
}
