import { NextRequest, NextResponse } from 'next/server';
import { getWeekSchedule } from '@/lib/data/schedule';
import { mondayOf, validDate } from '@/lib/schedule';
import { DataError, publicError } from '@/lib/data/errors';

export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:NextRequest){
  const start=request.nextUrl.searchParams.get('week')??'';
  if(!validDate(start)||start<'2002-01-01'||start>'2100-12-31'||mondayOf(start)!==start){
    return NextResponse.json({error:'请选择有效的周一日期。'},{status:400});
  }
  try{
    return NextResponse.json(await getWeekSchedule(start),{headers:{'Cache-Control':'public, max-age=0, s-maxage=300'}});
  }catch(error){
    return NextResponse.json(publicError(error),{status:error instanceof DataError?error.status:502,headers:{'Cache-Control':'no-store'}});
  }
}
