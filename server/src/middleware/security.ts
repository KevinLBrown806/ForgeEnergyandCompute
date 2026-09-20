import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env.js';

export function applySecurity(app: Express): void {
  const env = getEnv();

  app.use(
    cors({
      origin: env.corsOrigins,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept'],
      credentials: env.corsAllowCredentials,
      maxAge: 600,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: env.rateLimitPerMinute,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests' },
    }),
  );

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
}

/** Never leak secrets or upstream bodies in API errors. */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (/token|authorization|pool-auth|password|secret|cookie/i.test(msg)) {
      return 'Upstream authentication error';
    }
    return msg;
  }
  return 'Internal server error';
}
