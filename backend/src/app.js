import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config.js';
import { storage } from './services/storage.js';
import blobRouter from './routes/blob.js';
import sharesRouter from './routes/shares.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1);

// Security Headers with Cross-Origin resource permissions
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const allowedOrigin = config.corsOrigin;
app.use(cors({
  origin: (origin, callback) => {
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'x-share-password']
}));

// Body Parsers (allow up to 50MB JSON payloads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    storage: storage.getType(),
    hasBlobToken: Boolean(config.blobToken || process.env.BLOB_READ_WRITE_TOKEN),
    environment: config.nodeEnv
  });
});

// API Routes mounted on both /api/* and /* for full Vercel rewrite compatibility
app.use('/api/blob', blobRouter);
app.use('/blob', blobRouter);

app.use('/api/shares', sharesRouter);
app.use('/shares', sharesRouter);

// Global Error Handler
app.use(errorHandler);

export default app;
