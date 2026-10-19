import { NextRequest, NextResponse } from 'next/server';
import { searchPlayers } from '@/lib/data/espn';
import { publicError, DataError } from '@/lib/data/errors';
import { API_ROBOTS_HEADERS } from '@/lib/seo';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2 || q.length > 80) return NextResponse.json({error:'请输入 2–80 个字符的球员姓名。'},{status:400,headers:API_ROBOTS_HEADERS});
  try {
    return NextResponse.json(await searchPlayers(q),{headers:{...API_ROBOTS_HEADERS,'Cache-Control':'public, max-age=0, s-maxage=3600'}});
  } catch(error) {
    return NextResponse.json(publicError(error),{status:error instanceof DataError ? error.status : 502,headers:{...API_ROBOTS_HEADERS,'Cache-Control':'no-store'}});
  }
}
