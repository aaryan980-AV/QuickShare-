import express from 'express';
import { handleUpload } from '@vercel/blob/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { config } from '../config.js';

const router = express.Router();

// On Vercel serverless, root directory is read-only, so use OS temp directory
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isServerless ? path.join(os.tmpdir(), 'quickshare_uploads') : path.resolve('uploads');

function ensureUploadsDir() {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('[Blob Service] Notice on uploads dir creation:', err.message);
  }
}
ensureUploadsDir();

// In-memory registry for chunked upload sessions
const chunkSessions = new Map();

// Periodic cleanup of abandoned chunk sessions (> 2 hours inactive)
setInterval(() => {
  const now = Date.now();
  for (const [uploadId, session] of chunkSessions.entries()) {
    if (now - session.lastActivity > 2 * 60 * 60 * 1000) {
      try {
        if (fs.existsSync(session.targetPath)) {
          fs.unlinkSync(session.targetPath);
        }
      } catch (e) {
        // ignore
      }
      chunkSessions.delete(uploadId);
    }
  }
}, 15 * 60 * 1000);

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDir();
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${cleanName}`);
  }
});

const uploadMiddleware = multer({
  storage: diskStorage,
  limits: { fileSize: config.maxFileSizeBytes }
});

const chunkMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============================================================================
// FILE DOWNLOAD / SERVING ROUTE (Supports direct browser download & streaming)
// ============================================================================
router.get('/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on server.' });
  }

  const originalName = req.query.name || filename.replace(/^\d+-/, '');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
  return res.sendFile(filePath);
});

// ============================================================================
// CHUNKED UPLOAD PIPELINE
// ============================================================================

// 1. Initialize Chunked Upload Session
router.post('/chunk/init', (req, res) => {
  try {
    ensureUploadsDir();
    const { filename, totalSize, mimeType } = req.body;

    if (!filename || !totalSize) {
      return res.status(400).json({ error: 'Filename and totalSize are required.' });
    }

    const uploadId = crypto.randomUUID();
    const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const targetFilename = `${Date.now()}-${cleanName}`;
    const targetPath = path.join(uploadsDir, targetFilename);

    try {
      fs.writeFileSync(targetPath, Buffer.alloc(0));
    } catch (err) {
      console.error('[Chunk Init] File write error:', err.message);
      return res.status(500).json({ error: `Failed to initialize file on disk: ${err.message}` });
    }

    chunkSessions.set(uploadId, {
      uploadId,
      originalName: filename,
      targetFilename,
      targetPath,
      totalSize: Number(totalSize),
      mimeType: mimeType || 'application/octet-stream',
      writtenBytes: 0,
      lastActivity: Date.now()
    });

    console.log(`[Chunked Upload] Initialized session #${uploadId} for "${filename}" (Total: ${totalSize} bytes)`);

    return res.status(200).json({
      uploadId,
      targetFilename,
      chunkSize: 10 * 1024 * 1024
    });
  } catch (error) {
    console.error('[Chunk Init Fatal Error]:', error);
    return res.status(500).json({ error: error.message || 'Initialization failed' });
  }
});

// 2. Append Chunk Slice Directly to File on Disk
router.post('/chunk/upload', chunkMulter.single('chunk'), (req, res) => {
  try {
    const { uploadId } = req.body;
    const chunkFile = req.file;

    if (!uploadId || !chunkFile) {
      return res.status(400).json({ error: 'Missing uploadId or chunk data.' });
    }

    let session = chunkSessions.get(uploadId);
    if (!session) {
      // In serverless multi-instance fallback, if session is not in memory, attempt re-linking to file
      const targetFilename = req.body.targetFilename;
      if (targetFilename) {
        const targetPath = path.join(uploadsDir, path.basename(targetFilename));
        session = { targetPath, writtenBytes: 0, lastActivity: Date.now() };
      } else {
        return res.status(404).json({ error: 'Upload session not found or expired.' });
      }
    }

    fs.appendFileSync(session.targetPath, chunkFile.buffer);
    session.writtenBytes = (session.writtenBytes || 0) + chunkFile.buffer.length;
    session.lastActivity = Date.now();

    return res.status(200).json({
      success: true,
      writtenBytes: session.writtenBytes
    });
  } catch (err) {
    console.error(`[Chunked Upload] Error writing chunk:`, err);
    return res.status(500).json({ error: `Disk write error: ${err.message}` });
  }
});

// 3. Finalize & Complete Chunked Upload
router.post('/chunk/complete', (req, res) => {
  try {
    const { uploadId } = req.body;

    if (!uploadId) {
      return res.status(400).json({ error: 'Missing uploadId.' });
    }

    const session = chunkSessions.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found or expired.' });
    }

    const fileUrl = `/api/blob/files/${session.targetFilename}`;

    console.log(`[Chunked Upload] Completed: ${session.originalName} (${session.writtenBytes} bytes written) -> ${fileUrl}`);

    const result = {
      url: fileUrl,
      downloadUrl: fileUrl,
      pathname: `quickshare/${session.targetFilename}`,
      originalName: session.originalName,
      size: session.writtenBytes,
      mimeType: session.mimeType
    };

    chunkSessions.delete(uploadId);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Chunk Complete Error]:', error);
    return res.status(500).json({ error: error.message || 'Complete assembly failed' });
  }
});

// ============================================================================
// SINGLE-REQUEST LOCAL UPLOAD (Standard smaller files fallback)
// ============================================================================
router.post('/local-upload', uploadMiddleware.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const fileUrl = `/api/blob/files/${req.file.filename}`;
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
          maximumSizeInBytes: config.maxFileSizeBytes,
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
