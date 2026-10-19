import { NextRequest, NextResponse } from 'next/server';
import { getSeason } from '@/lib/data/espn';
import { currentEndYear } from '@/lib/seasons';
import { publicError, DataError } from '@/lib/data/errors';
import { API_ROBOTS_HEADERS } from '@/lib/seo';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const id = p.get('player') ?? '', year = Number(p.get('year')), type = p.get('type');
  if (!/^\d{1,10}$/.test(id) || !Number.isInteger(year) || year < 2001 || year > currentEndYear() || !['regular','preseason'].includes(type ?? '')) return NextResponse.json({error:'球员 ID、赛季或赛事无效。'},{status:400,headers:API_ROBOTS_HEADERS});
  try {
    const row = await getSeason(id,{year,type:type as 'regular'|'preseason'});
    // CDN TTL is deliberately short even for historical data; fetchedAt survives cache hits.
    return NextResponse.json({row},{headers:{...API_ROBOTS_HEADERS,'Cache-Control':'public, max-age=0, s-maxage=300'}});
  } catch(error) {
    return NextResponse.json(publicError(error),{status:error instanceof DataError ? error.status : 502,headers:{...API_ROBOTS_HEADERS,'Cache-Control':'no-store'}});
  }
}
