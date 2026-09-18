import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

function parseOrigins(raw: string | undefined): string[] | true {
  if (!raw || raw.trim() === '') {
    return [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ];
  }
  if (raw.trim() === '*') return true;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function applySecurity(app: Express): void {
  const origins = parseOrigins(process.env.CORS_ORIGINS);
  app.use(
    cors({
      origin: origins,
      methods: ['GET', 'HEAD', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept'],
      maxAge: 600,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60),
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
    if (/token|authorization|pool-auth/i.test(msg)) {
      return 'Upstream authentication error';
    }
    return msg;
  }
  return 'Internal server error';
}
