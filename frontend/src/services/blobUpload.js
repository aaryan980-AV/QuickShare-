import { upload } from '@vercel/blob/client';
import { calculateFileHash } from '../utils/cryptoHelper';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per slice for streaming 1TB+ files

/**
 * Upload a single chunk slice
 */
async function uploadSingleChunk(uploadId, chunkBlob) {
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunk', chunkBlob);

  const response = await fetch('/api/blob/chunk/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Chunk upload failed with HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * High-performance Chunked Stream Upload (Zero RAM buffering, supports up to 1 TB)
 */
async function uploadViaChunkedStream(file, onProgress) {
  // Step 1: Initialize session
  const initRes = await fetch('/api/blob/chunk/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      totalSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    }),
  });

  if (!initRes.ok) {
    const errData = await initRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to initialize chunked upload session.');
  }

  const { uploadId, chunkSize = CHUNK_SIZE } = await initRes.json();

  // Step 2: Slice and stream chunks sequentially
  let offset = 0;
  const totalSize = file.size;

  while (offset < totalSize) {
    const chunkBlob = file.slice(offset, Math.min(offset + chunkSize, totalSize));
    await uploadSingleChunk(uploadId, chunkBlob);

    offset += chunkBlob.size;

    if (onProgress) {
      const pct = totalSize > 0 ? Math.round((offset / totalSize) * 100) : 100;
      onProgress({
        loaded: offset,
        total: totalSize,
        percentage: pct,
      });
    }
  }

  // Step 3: Complete and assemble file descriptor
  const completeRes = await fetch('/api/blob/chunk/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId }),
  });

  if (!completeRes.ok) {
    const errData = await completeRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to finalize chunked file assembly.');
  }

  return await completeRes.json();
}

/**
 * Upload a single file: Tries Vercel Blob first; falls back to High-Speed Chunked Streaming
 */
async function uploadWithRetry(file, onProgress, maxRetries = 2) {
  let attempt = 0;
  let lastError = null;

  // Calculate memory-safe SHA-256 fingerprint in background
  const sha256Hash = await calculateFileHash(file);

  // Try direct Vercel Blob client upload first if token exists
  while (attempt < maxRetries) {
    try {
      const timestamp = Date.now();
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const pathname = `quickshare/${timestamp}-${cleanName}`;

      const newBlob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            onProgress({
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: progressEvent.percentage,
            });
          }
        },
      });

      return {
        url: newBlob.url,
        downloadUrl: newBlob.downloadUrl || newBlob.url,
        pathname: newBlob.pathname,
        originalName: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        sha256: sha256Hash,
      };
    } catch (error) {
      attempt++;
      lastError = error;

      if (error.message && error.message.includes('retrieve the client token')) {
        console.log(`[Upload] Streaming chunked upload for "${file.name}" (${file.size} bytes)`);
        const streamResult = await uploadViaChunkedStream(file, onProgress);
        streamResult.sha256 = sha256Hash;
        return streamResult;
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // Fallback to chunked streaming upload
  try {
    const streamResult = await uploadViaChunkedStream(file, onProgress);
    streamResult.sha256 = sha256Hash;
    return streamResult;
  } catch (localErr) {
    throw new Error(`Failed to upload ${file.name}: ${localErr.message || lastError?.message}`);
  }
}

/**
 * Upload multiple files with controlled concurrency and aggregate progress tracking
 */
export async function uploadFilesBatch(files, options = {}) {
  const {
    concurrency = 2,
    onFileProgress,
    onTotalProgress,
    onFileComplete,
  } = options;

  const results = new Array(files.length);
  const fileProgressMap = new Map();

  let completedFiles = 0;
  let runningCount = 0;
  let currentIndex = 0;

  return new Promise((resolve, reject) => {
    let hasError = false;

    function updateOverallProgress() {
      if (!onTotalProgress) return;
      let totalLoaded = 0;
      let totalSize = 0;

      for (let i = 0; i < files.length; i++) {
        const fSize = files[i].size;
        totalSize += fSize;
        const currentFileLoaded = fileProgressMap.get(i) || 0;
        totalLoaded += currentFileLoaded;
      }

      const percent = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;
      onTotalProgress({
        loaded: totalLoaded,
        total: totalSize,
        percentage: percent,
        completedFiles,
        totalFiles: files.length,
      });
    }

    function launchNext() {
      if (hasError) return;

      if (completedFiles === files.length) {
        return resolve(results);
      }

      while (runningCount < concurrency && currentIndex < files.length) {
        const fileIndex = currentIndex++;
        const file = files[fileIndex];
        runningCount++;

        uploadWithRetry(file, (prog) => {
          fileProgressMap.set(fileIndex, prog.loaded);
          if (onFileProgress) {
            onFileProgress(fileIndex, prog);
          }
          updateOverallProgress();
        })
          .then((blobResult) => {
            results[fileIndex] = blobResult;
            completedFiles++;
            runningCount--;
            fileProgressMap.set(fileIndex, file.size);

            if (onFileComplete) {
              onFileComplete(fileIndex, blobResult);
            }
            updateOverallProgress();

            launchNext();
          })
          .catch((err) => {
            hasError = true;
            reject(err);
          });
      }
    }

    launchNext();
  });
}
