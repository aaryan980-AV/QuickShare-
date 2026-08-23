import express from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { storage } from '../services/storage.js';
import { generateQRCode } from '../services/qr.js';
import { codeLookupLimiter, createShareLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Generate a cryptographically random 6-digit code
 */
function generateRandomCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

// POST /api/shares/create
router.post('/create', createShareLimiter, async (req, res, next) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided in share batch.' });
    }

    // Validate files array
    let totalSize = 0;
    const sanitizedFiles = [];

    for (const file of files) {
      if (!file.url || !file.originalName) {
        return res.status(400).json({ error: 'Invalid file object structure.' });
      }

      const size = Number(file.size) || 0;
      if (size > config.maxFileSizeBytes) {
        return res.status(400).json({
          error: `File "${file.originalName}" exceeds the maximum allowed size of 500MB.`
        });
      }

      totalSize += size;
      sanitizedFiles.push({
        url: file.url,
        downloadUrl: file.downloadUrl || file.url,
        pathname: file.pathname || '',
        originalName: String(file.originalName).replace(/[^\w\s.-]/gi, '_'),
        size: size,
        mimeType: file.mimeType || 'application/octet-stream'
      });
    }

    if (totalSize > config.maxBatchSizeBytes) {
      return res.status(400).json({
        error: 'Total batch size exceeds maximum limit of 1000MB.'
      });
    }

    // Generate unique 6-digit code with collision check
    let code = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const candidateCode = generateRandomCode();
      const exists = await storage.codeExists(candidateCode);
      if (!exists) {
        code = candidateCode;
        break;
      }
      attempts++;
    }

    if (!code) {
      return res.status(500).json({ error: 'Could not generate unique share code. Please try again.' });
    }

    // Calculate expiration
    const now = Date.now();
    const expiresAt = now + config.codeExpirySeconds * 1000;

    // Determine domain for QR URL
    const hostHeader = req.get('x-forwarded-host') || req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const baseUrl = config.appUrl && !config.appUrl.includes('localhost')
      ? config.appUrl.replace(/\/$/, '')
      : `${protocol}://${hostHeader}`;
    
    const shareUrl = `${baseUrl}/receive?code=${code}`;

    // Generate QR Code data URL
    const qrCode = await generateQRCode(shareUrl);

    // Save record to persistent storage (Vercel KV or Memory fallback)
    const shareData = {
      code,
      shareUrl,
      files: sanitizedFiles,
      filesCount: sanitizedFiles.length,
      totalSize,
      createdAt: now,
      expiresAt
    };

    await storage.saveShare(code, shareData, config.codeExpirySeconds);

    console.log(`[Shares] Created share batch #${code} with ${sanitizedFiles.length} file(s), total ${totalSize} bytes.`);

    return res.status(201).json({
      success: true,
      code,
      shareUrl,
      qrCode,
      expiresAt,
      filesCount: sanitizedFiles.length,
      totalSize
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shares/:code
router.get('/:code', codeLookupLimiter, async (req, res, next) => {
  try {
    const rawCode = req.params.code;
    const code = String(rawCode).trim();

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid share code format. Expected a 6-digit code.' });
    }

    const share = await storage.getShare(code);

    if (!share) {
      return res.status(404).json({ error: 'Share code not found or has expired.' });
    }

    // Check if expired
    if (Date.now() > share.expiresAt) {
      await storage.deleteShare(code);
      return res.status(410).json({ error: 'This share link has expired.' });
    }

    return res.status(200).json({
      success: true,
      code: share.code,
      shareUrl: share.shareUrl,
      files: share.files,
      filesCount: share.filesCount,
      totalSize: share.totalSize,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt
    });
  } catch (error) {
    next(error);
  }
});

export default router;
