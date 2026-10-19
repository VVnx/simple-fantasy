import { createHash, timingSafeEqual } from 'node:crypto';
import { BriefingError } from './briefings';
import { getBriefingEnv } from './briefing-runtime';

export function authorizeBriefingPublish(request: Request): void {
  const expected = getBriefingEnv().BRIEFING_PUBLISH_TOKEN_SHA256;
  if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) {
    throw new BriefingError('简报发布暂未配置。', 503);
  }
  // Browser cookies, identity headers and URL parameters never grant write access.
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match || match[1].length > 4096) throw new BriefingError('无权发布简报。', 401);
  const actual = createHash('sha256').update(match[1]).digest();
  if (!timingSafeEqual(actual, Buffer.from(expected, 'hex'))) {
    throw new BriefingError('无权发布简报。', 401);
  }
}
