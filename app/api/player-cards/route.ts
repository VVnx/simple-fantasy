import {NextRequest,NextResponse} from 'next/server';
import {getCardDay} from '@/lib/data/player-cards';
import {validDate} from '@/lib/schedule';
import {DataError,publicError} from '@/lib/data/errors';
import {API_ROBOTS_HEADERS} from '@/lib/seo';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:NextRequest){
  const date=request.nextUrl.searchParams.get('date')||'';
  if(!validDate(date)||date<'2002-01-01'||date>'2100-12-31')return NextResponse.json({error:'请选择有效的比赛日期。'},{status:400,headers:API_ROBOTS_HEADERS});
  try{return NextResponse.json(await getCardDay(date),{headers:{...API_ROBOTS_HEADERS,'Cache-Control':'no-store'}});}
  catch(error){return NextResponse.json(publicError(error),{status:error instanceof DataError?error.status:502,headers:{...API_ROBOTS_HEADERS,'Cache-Control':'no-store'}});}
}
