import { ExecutionContext } from '@nestjs/common';
import { ThrottlerOptions } from '@nestjs/throttler';

/** Routes that accept credentials or reset tokens: the targets of password guessing. */
const CREDENTIAL_ROUTE = /^\/(?:api\/)?auth\/(?:login|reset-password)(?:[/?#]|$)/i;

export function isCredentialRoute(url: string | undefined): boolean {
  return CREDENTIAL_ROUTE.test(url ?? '');
}

/**
 * Global rate limits (per client IP, per route).
 *  - default: 60 requests / minute for every route.
 *  - credential: an additional slow window on login / reset-password. The per-route
 *    10/min and 5/min limits stop bursts; this stops a patient password-spraying run
 *    (many usernames from one IP) that stays under the per-minute limit.
 *    Override with AUTH_THROTTLE_LIMIT (requests per 15 minutes, default 40).
 */
export function buildThrottlers(env: NodeJS.ProcessEnv = process.env): ThrottlerOptions[] {
  const configured = Number(env.AUTH_THROTTLE_LIMIT);
  const credentialLimit = Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : 40;
  return [
    { name: 'default', ttl: 60_000, limit: 60 },
    {
      name: 'credential',
      ttl: 15 * 60_000,
      limit: credentialLimit,
      skipIf: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{ originalUrl?: string; url?: string }>();
        return !isCredentialRoute(req.originalUrl ?? req.url);
      },
    },
  ];
}
