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

// Trust proxy for rate limiter & proto detection on Vercel
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
    if (!origin || allowedOrigin === '*' || origin === allowedOrigin) {
      return callback(null, true);
    }
    if (origin.includes('localhost') || origin.endsWith('.vercel.app') || origin.startsWith('http://192.168.') || origin.startsWith('https://192.168.') || origin.startsWith('http://10.') || origin.startsWith('https://10.') || origin.includes('loca.lt')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow during local dev for smooth LAN sharing
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'x-share-password']
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    storage: storage.getType(),
    hasBlobToken: Boolean(config.blobToken || process.env.BLOB_READ_WRITE_TOKEN),
    environment: config.nodeEnv
  });
});

// API Routes
app.use('/api/blob', blobRouter);
app.use('/api/shares', sharesRouter);

// Fallback 404 for unknown /api routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Global Error Handler
app.use(errorHandler);

export default app;
