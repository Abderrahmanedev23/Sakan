import type { Request } from 'express';

/** Client IP and user agent recorded on sessions and audit logs. */
export function requestMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
  };
}
