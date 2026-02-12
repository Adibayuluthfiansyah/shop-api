import { Request, Response, NextFunction } from 'express';
import csurf from 'csurf';

// Initialize CSRF protection with cookie-based tokens
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

const CSRF_SKIP_PATHS = [
  '/api/auth/google-login',
  // '/api/auth/facebook-login',
];

export function conditionalCsrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const path = req.path;

  // Check if current path should skip CSRF protection
  const shouldSkipCsrf = CSRF_SKIP_PATHS.some((skipPath) =>
    path.startsWith(skipPath),
  );

  if (shouldSkipCsrf) {
    // Skip CSRF protection for this path
    console.log(`[CSRF] Skipping CSRF protection for: ${path}`);
    return next();
  }

  // Apply CSRF protection for all other paths
  return csrfProtection(req, res, next);
}
