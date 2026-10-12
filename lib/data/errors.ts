export class DataError extends Error {
  constructor(public code: 'UPSTREAM' | 'TIMEOUT' | 'SCHEMA' | 'NOT_FOUND' | 'MISMATCH', message: string, public status = 502) { super(message); }
}
export function publicError(error: unknown) {
  if (error instanceof DataError) return { error: error.message, code: error.code };
  return { error: '数据暂时无法读取，请稍后重试。', code: 'UPSTREAM' };
}
