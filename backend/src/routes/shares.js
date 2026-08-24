import express from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { storage } from '../services/storage.js';
import { generateQRCode } from '../services/qr.js';
import { getLocalIpAddress } from '../services/network.js';
import { codeLookupLimiter, createShareLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Generate a cryptographically random 6-digit code
 */
function generateRandomCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash password with salt using PBKDF2
 */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

// POST /api/shares/create
router.post('/create', createShareLimiter, async (req, res, next) => {
  try {
    const { files, clientOrigin, password, selfDestruct, expirySeconds } = req.body;

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
          error: `File "${file.originalName}" exceeds the maximum allowed size of 1TB.`
        });
      }

      totalSize += size;
      sanitizedFiles.push({
        url: file.url,
        downloadUrl: file.downloadUrl || file.url,
        pathname: file.pathname || '',
        originalName: String(file.originalName).replace(/[^\w\s.-]/gi, '_'),
        size: size,
        mimeType: file.mimeType || 'application/octet-stream',
        sha256: file.sha256 || null
      });
    }

    if (totalSize > config.maxBatchSizeBytes) {
      return res.status(400).json({
        error: 'Total batch size exceeds maximum limit of 1TB.'
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

    // Calculate expiration (custom or default)
    const validExpiry = expirySeconds && Number(expirySeconds) > 0
      ? Math.min(Number(expirySeconds), 7 * 24 * 3600) // Max 7 days
      : config.codeExpirySeconds;

    const now = Date.now();
    const expiresAt = now + validExpiry * 1000;

    // Security: Handle Password Protection
    let passwordData = null;
    if (password && String(password).trim().length > 0) {
      const { hash, salt } = hashPassword(String(password).trim());
      passwordData = { hash, salt, failedAttempts: 0 };
    }

    // Determine domain for QR URL
    let baseUrl = '';
    if (config.isVercel || (config.appUrl && !config.appUrl.includes('localhost'))) {
      baseUrl = config.appUrl.replace(/\/$/, '');
    } else {
      const lanIp = getLocalIpAddress();
      const origin = clientOrigin || req.get('origin') || req.get('referer');
      
      if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        try {
          const parsed = new URL(origin);
          baseUrl = parsed.origin;
        } catch {
          baseUrl = `https://${lanIp}:5173`;
        }
      } else {
        baseUrl = `https://${lanIp}:5173`;
      }
    }
    
    const shareUrl = `${baseUrl}/?code=${code}`;
    const qrCode = await generateQRCode(shareUrl);

    // Save record to persistent storage
    const shareData = {
      code,
      shareUrl,
      files: sanitizedFiles,
      filesCount: sanitizedFiles.length,
      totalSize,
      createdAt: now,
      expiresAt,
      isPasswordProtected: Boolean(passwordData),
      passwordData,
      selfDestruct: Boolean(selfDestruct),
      downloadCount: 0
    };

    await storage.saveShare(code, shareData, validExpiry);

    console.log(`[Shares] Created secure share batch #${code} (URL: ${shareUrl}) with ${sanitizedFiles.length} file(s)`);

    return res.status(201).json({
      success: true,
      code,
      shareUrl,
      qrCode,
      expiresAt,
      filesCount: sanitizedFiles.length,
      totalSize,
      isPasswordProtected: Boolean(passwordData),
      selfDestruct: Boolean(selfDestruct)
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shares/:code
router.get('/:code', codeLookupLimiter, async (req, res, next) => {
  try {
    const rawCode = req.params.code;
    const code = String(rawCode).replace(/\D/g, '');
    const providedPassword = req.query.password || req.headers['x-share-password'];

    if (code.length !== 6) {
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

    // Check Password Protection
    if (share.isPasswordProtected && share.passwordData) {
      // Check for account lockout (5 failed attempts)
      if (share.passwordData.failedAttempts >= 5) {
        return res.status(403).json({
          error: 'Too many incorrect password attempts. This share has been locked for security.'
        });
      }

      if (!providedPassword) {
        // Return prompt response without exposing file list
        return res.status(200).json({
          success: true,
          code: share.code,
          isPasswordProtected: true,
          requiresPassword: true,
          filesCount: share.filesCount,
          totalSize: share.totalSize,
          expiresAt: share.expiresAt,
          selfDestruct: share.selfDestruct
        });
      }

      const isValid = verifyPassword(String(providedPassword).trim(), share.passwordData.salt, share.passwordData.hash);
      if (!isValid) {
        share.passwordData.failedAttempts += 1;
        await storage.saveShare(code, share, Math.max(60, Math.round((share.expiresAt - Date.now()) / 1000)));

        const remaining = 5 - share.passwordData.failedAttempts;
        return res.status(401).json({
          error: `Incorrect password. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Share locked.'}`,
          isPasswordProtected: true,
          requiresPassword: true
        });
      }
    }

    return res.status(200).json({
      success: true,
      code: share.code,
      shareUrl: share.shareUrl,
      files: share.files,
      filesCount: share.filesCount,
      totalSize: share.totalSize,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      isPasswordProtected: share.isPasswordProtected,
      selfDestruct: share.selfDestruct
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/shares/:code/downloaded (Notify download completion for self-destruct)
router.post('/:code/downloaded', async (req, res, next) => {
  try {
    const code = String(req.params.code).replace(/\D/g, '');
    const share = await storage.getShare(code);

    if (share && share.selfDestruct) {
      console.log(`[Security] Self-destruct triggered for share #${code}. Deleting files & share record.`);
      await storage.deleteShare(code);
      return res.status(200).json({ success: true, selfDestructed: true });
    }

    return res.status(200).json({ success: true, selfDestructed: false });
  } catch (error) {
    next(error);
  }
});

export default router;
