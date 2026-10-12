// Bounded per-instance cache. No filesystem/database required on Vercel.
// In-flight coalescing prevents duplicate upstream work; failures get a short cooldown.
export class RequestCache {
  private entries = new Map<string, { value?: unknown; error?: unknown; expires: number }>();
  private pending = new Map<string, Promise<unknown>>();
  constructor(private max = 256, private now = () => Date.now()) {}
  async get<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.expires > this.now()) {
      if (entry.error) throw entry.error;
      return entry.value as T;
    }
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;
    const request = loader().then(value => {
      this.put(key, { value, expires: this.now() + ttlMs });
      return value;
    }).catch(error => {
      this.put(key, { error, expires: this.now() + 15_000 });
      throw error;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
  private put(key: string, entry: { value?: unknown; error?: unknown; expires: number }) {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value!);
  }
}
export const requestCache = new RequestCache();
