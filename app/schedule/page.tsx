import ScheduleTool from '@/components/schedule-tool';
export const dynamic='force-dynamic';
export default function SchedulePage(){return <ScheduleTool today={new Date().toISOString()}/>;}
