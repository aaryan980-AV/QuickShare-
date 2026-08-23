import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isVercel: Boolean(process.env.VERCEL),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  corsOrigin: process.env.CORS_ORIGIN || process.env.APP_URL || '*',
  
  // Expiry defaults to 24 hours (86,400 seconds)
  codeExpirySeconds: parseInt(process.env.CODE_EXPIRY_SECONDS || '86400', 10),
  
  // Storage constraints
  maxFileSizeBytes: 500 * 1024 * 1024, // 500 MB per file
  maxBatchSizeBytes: 1000 * 1024 * 1024, // 1000 MB total per share batch
  
  // Vercel credentials
  blobToken: process.env.BLOB_READ_WRITE_TOKEN,
  kvRestApiUrl: process.env.KV_REST_API_URL,
  kvRestApiToken: process.env.KV_REST_API_TOKEN,
};
