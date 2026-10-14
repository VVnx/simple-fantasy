import type { Player, SeasonRow, Selection } from '../types';

// These ESPN endpoints explicitly allow public cross-origin reads (ACAO: *).
// If the hosted server is denied, use the browser's normal CORS request with the
// same validated adapter. No proxy, credentials, opaque response or fake data.
export async function readWithPublicFallback<T>(url:string,readPublic:()=>Promise<T>,signal:AbortSignal):Promise<T> {
  const response=await fetch(url,{signal});
  const body=await response.json();
  signal.throwIfAborted();
  if(response.ok)return body as T;
  if(body?.code==='UPSTREAM_DENIED'){
    const result=await readPublic();
    signal.throwIfAborted();
    return result;
  }
  throw new Error(typeof body?.error==='string'?body.error:'请求失败，请稍后重试。');
}
export function readPlayerSeason(id:string,selection:Selection,signal:AbortSignal) {
  const params=new URLSearchParams({player:id,year:String(selection.year),type:selection.type});
  return readWithPublicFallback<{row:SeasonRow}>(`/api/stats?${params}`,async()=>{
    const {getSeason}=await import('./espn');
    return {row:await getSeason(id,selection)};
  },signal);
}
export function readPlayerSearch(query:string,signal:AbortSignal) {
  return readWithPublicFallback<{players:Player[];resolvedQuery:string}>(`/api/players?q=${encodeURIComponent(query)}`,async()=>{
    const {searchPlayers}=await import('./espn');
    return searchPlayers(query);
  },signal);
}
