import express from 'express';
import { handleUpload } from '@vercel/blob/client';
import { config } from '../config.js';

const router = express.Router();

// Route for handling direct client-side blob upload token issuance and callbacks
router.post('/upload', async (req, res, next) => {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Enforce maximum file size server-side
        return {
          maximumSizeInBytes: config.maxFileSizeBytes, // 500 MB
          tokenPayload: JSON.stringify({
            clientPayload: clientPayload || null,
            requestedAt: Date.now()
          })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Callback invoked by Vercel Blob once upload is complete
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
