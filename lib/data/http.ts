import { DataError } from './errors';
export async function fetchJson(url: string, timeoutMs = 8_000): Promise<unknown> {
  // Hosts and paths are assembled by the adapter, never taken from user input.
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store', headers: { Accept: 'application/json' } });
    if (response.status === 404) throw new DataError('NOT_FOUND','该数据源没有这项记录。',404);
    if (!response.ok) throw new DataError('UPSTREAM', `ESPN 暂时拒绝或无法响应请求（HTTP ${response.status}）。请稍后重试。`);
    return await response.json();
  } catch (error) {
    if (error instanceof DataError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new DataError('TIMEOUT','ESPN 响应超时（8 秒），请稍后重试。',504);
    throw new DataError('UPSTREAM','无法连接 ESPN 或响应不是有效 JSON，请稍后重试。');
  }
}
