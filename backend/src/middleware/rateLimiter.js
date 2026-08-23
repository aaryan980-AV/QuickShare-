import rateLimit from 'express-rate-limit';

// Rate limiter for looking up share codes (protects against brute-forcing 6-digit codes)
export const codeLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 lookup requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: 'Too many lookup attempts. Please try again in a few minutes.'
  }
});

// Rate limiter for creating new shares
export const createShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Max 60 batches created per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many share creation requests. Please try again later.'
  }
});
