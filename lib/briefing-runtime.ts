import { AsyncLocalStorage } from 'node:async_hooks';

export interface BriefingEnv {
  DB?: D1Database;
  BRIEFING_PUBLISH_TOKEN_SHA256?: string;
}

// Bindings and secrets belong to the current request, never a shared global.
const runtime = new AsyncLocalStorage<BriefingEnv>();
export function runWithBriefingEnv<T>(env: BriefingEnv, run: () => T): T {
  return runtime.run(env, run);
}
export function getBriefingEnv(): BriefingEnv {
  return runtime.getStore() ?? {};
}
