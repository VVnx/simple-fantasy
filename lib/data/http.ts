import { DataError } from './errors';
export async function fetchJson(url: string, timeoutMs = 8_000): Promise<unknown> {
  // Hosts and paths are assembled by the adapter, never taken from user input.
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store', credentials:'omit', headers: { Accept: 'application/json' } });
    if (response.status === 404) throw new DataError('NOT_FOUND','该数据源没有这项记录。',404);
    if (!response.ok) {
      const endpoint=new URL(url);
      const body=(await response.text()).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,400);
      // Public upstream diagnostics only; omit queries, cookies and request headers.
      console.error('[data:upstream]',JSON.stringify({host:endpoint.hostname,path:endpoint.pathname,status:response.status,contentType:response.headers.get('content-type'),server:response.headers.get('server'),body}));
      throw new DataError(response.status===403?'UPSTREAM_DENIED':'UPSTREAM', `ESPN 暂时拒绝或无法响应请求（HTTP ${response.status}）。请稍后重试。`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof DataError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new DataError('TIMEOUT','ESPN 响应超时（8 秒），请稍后重试。',504);
    throw new DataError('UPSTREAM','无法连接 ESPN 或响应不是有效 JSON，请稍后重试。');
  }
}
