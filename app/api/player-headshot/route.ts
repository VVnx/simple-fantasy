import {NextRequest} from 'next/server';
import {API_ROBOTS_HEADERS} from '@/lib/seo';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  const id=request.nextUrl.searchParams.get('id')||'';
  if(!/^\d{1,12}$/.test(id))return new Response('无效球员',{status:400,headers:API_ROBOTS_HEADERS});
  try{
    // Fixed public image host and numeric athlete IDs; this is not an arbitrary URL proxy.
    const upstream=await fetch(`https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`,{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(8000)});
    if(!upstream.ok)return new Response('头像暂不可用',{status:upstream.status===404?404:502,headers:API_ROBOTS_HEADERS});
    if(!upstream.headers.get('content-type')?.startsWith('image/png'))throw new Error('Unexpected image type');
    const length=Number(upstream.headers.get('content-length')||0);if(length>5_000_000)throw new Error('Image too large');
    const bytes=await upstream.arrayBuffer();if(bytes.byteLength>5_000_000)throw new Error('Image too large');
    return new Response(bytes,{headers:{...API_ROBOTS_HEADERS,'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
  }catch(error){console.error('Headshot request failed',error instanceof Error?error.message:'Unknown error');return new Response('头像暂不可用',{status:502,headers:API_ROBOTS_HEADERS});}
}
