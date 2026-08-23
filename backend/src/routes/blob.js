import express from 'express';
import { handleUpload } from '@vercel/blob/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

const router = express.Router();

// Local uploads directory for local development fallback
const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.warn('Could not create uploads directory:', err.message);
  }
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${cleanName}`);
  }
});

const uploadMiddleware = multer({
  storage: diskStorage,
  limits: { fileSize: config.maxFileSizeBytes }
});

// Local upload fallback endpoint (active when running locally without Vercel Blob token)
router.post('/local-upload', uploadMiddleware.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const hostHeader = req.get('x-forwarded-host') || req.get('host');
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const baseUrl = `${protocol}://${hostHeader}`;
  const fileUrl = `${baseUrl}/api/blob/files/${req.file.filename}`;

  console.log(`[Local Upload] Received: ${req.file.originalname} (${req.file.size} bytes) -> ${fileUrl}`);

  return res.status(200).json({
    url: fileUrl,
    downloadUrl: fileUrl,
    pathname: `quickshare/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype || 'application/octet-stream'
  });
});

// Route for handling Vercel Blob client token generation (Production mode)
router.post('/upload', async (req, res, next) => {
  const token = config.blobToken || process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    // Report that token is missing so client falls back to local upload seamlessly
    return res.status(400).json({
      error: 'Vercel Blob token missing',
      code: 'BLOB_TOKEN_MISSING',
      isLocalFallbackAvailable: true
    });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return {
          maximumSizeInBytes: config.maxFileSizeBytes, // 500 MB
          tokenPayload: JSON.stringify({
            clientPayload: clientPayload || null,
            requestedAt: Date.now()
          })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log(`[Blob Service] File uploaded successfully: ${blob.pathname} (${blob.size} bytes)`);
      }
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('[Blob Route Error]', error.message);
    return res.status(400).json({ error: error.message });
  }
});

export default router;
