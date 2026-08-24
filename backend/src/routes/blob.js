import express from 'express';
import { handleUpload } from '@vercel/blob/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
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

// In-memory registry for chunked upload sessions
const chunkSessions = new Map();

// Periodic cleanup of abandoned chunk sessions (> 2 hours inactive)
setInterval(() => {
  const now = Date.now();
  for (const [uploadId, session] of chunkSessions.entries()) {
    if (now - session.lastActivity > 2 * 60 * 60 * 1000) {
      console.log(`[Chunked Upload] Cleaning up abandoned upload session #${uploadId}`);
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

const chunkMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // Max 50MB per individual chunk
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
// CHUNKED UPLOAD PIPELINE (Supports 1TB+ files with minimal RAM consumption)
// ============================================================================

// 1. Initialize Chunked Upload Session
router.post('/chunk/init', (req, res) => {
  const { filename, totalSize, mimeType } = req.body;

  if (!filename || !totalSize) {
    return res.status(400).json({ error: 'Filename and totalSize are required.' });
  }

  const uploadId = crypto.randomUUID();
  const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const targetFilename = `${Date.now()}-${cleanName}`;
  const targetPath = path.join(uploadsDir, targetFilename);

  // Initialize empty target file
  try {
    fs.writeFileSync(targetPath, Buffer.alloc(0));
  } catch (err) {
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
    chunkSize: 10 * 1024 * 1024 // Recommended 10MB chunk size
  });
});

// 2. Append Chunk Slice Directly to File on Disk
router.post('/chunk/upload', chunkMulter.single('chunk'), (req, res) => {
  const { uploadId } = req.body;
  const chunkFile = req.file;

  if (!uploadId || !chunkFile) {
    return res.status(400).json({ error: 'Missing uploadId or chunk data.' });
  }

  const session = chunkSessions.get(uploadId);
  if (!session) {
    return res.status(404).json({ error: 'Upload session not found or expired.' });
  }

  try {
    // Append chunk buffer directly to the file on disk
    fs.appendFileSync(session.targetPath, chunkFile.buffer);
    session.writtenBytes += chunkFile.buffer.length;
    session.lastActivity = Date.now();

    return res.status(200).json({
      success: true,
      writtenBytes: session.writtenBytes,
      totalSize: session.totalSize
    });
  } catch (err) {
    console.error(`[Chunked Upload] Error writing chunk for session #${uploadId}:`, err);
    return res.status(500).json({ error: `Disk write error: ${err.message}` });
  }
});

// 3. Finalize & Complete Chunked Upload
router.post('/chunk/complete', (req, res) => {
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
});

// ============================================================================
// SINGLE-REQUEST LOCAL UPLOAD (For standard smaller files)
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
