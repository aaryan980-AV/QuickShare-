import express from 'express';
import { handleUpload } from '@vercel/blob/client';
import { config } from '../config.js';

const router = express.Router();

// Route for handling direct client-side blob upload token issuance and callbacks
router.post('/upload', async (req, res, next) => {
  const token = config.blobToken || process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error('[Blob Route Error] BLOB_READ_WRITE_TOKEN is missing! Please configure Vercel Blob in your dashboard.');
    return res.status(400).json({
      error: 'Vercel Blob storage is not configured. Please set the BLOB_READ_WRITE_TOKEN environment variable in your Vercel Project Settings.'
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
