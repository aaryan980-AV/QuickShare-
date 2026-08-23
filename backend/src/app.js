import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { storage } from './services/storage.js';
import blobRouter from './routes/blob.js';
import sharesRouter from './routes/shares.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Trust proxy for rate limiter & proto detection on Vercel
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
const allowedOrigin = config.corsOrigin;
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
    if (!origin || allowedOrigin === '*' || origin === allowedOrigin) {
      return callback(null, true);
    }
    // Allow local development and vercel previews
    if (origin.includes('localhost') || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Body Parsers (lightweight since files go directly to Blob)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    storage: storage.getType(),
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
