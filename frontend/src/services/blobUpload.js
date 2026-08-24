import { upload } from '@vercel/blob/client';
import { calculateFileHash } from '../utils/cryptoHelper';

const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB per slice (strictly avoids Vercel 413 limit)

/**
 * Direct Single-Request Upload (For small files <= 2MB)
 */
function uploadDirectLocal(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', '/api/blob/local-upload', true);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: percentage,
          });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch (e) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error || `Upload failed with HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network connection error during upload.'));
    };

    xhr.send(formData);
  });
}

/**
 * Upload a single chunk slice (1MB)
 */
async function uploadSingleChunk(uploadId, chunkBlob, targetFilename) {
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunk', chunkBlob);
  if (targetFilename) {
    formData.append('targetFilename', targetFilename);
  }

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
 * High-performance Chunked Stream Upload (1MB slices, supports up to 1 TB on Vercel)
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
    throw new Error(errData.error || 'Failed to initialize upload session on server.');
  }

  const { uploadId, chunkSize = CHUNK_SIZE, targetFilename } = await initRes.json();
  const effectiveChunkSize = Math.min(chunkSize, CHUNK_SIZE);

  // Step 2: Slice and stream 1MB chunks sequentially
  let offset = 0;
  const totalSize = file.size;

  while (offset < totalSize) {
    const chunkBlob = file.slice(offset, Math.min(offset + effectiveChunkSize, totalSize));
    await uploadSingleChunk(uploadId, chunkBlob, targetFilename);

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
 * Upload a single file: Auto-selects optimum strategy with multiple fail-safes
 */
async function uploadWithRetry(file, onProgress, maxRetries = 2) {
  // Calculate memory-safe SHA-256 fingerprint in background
  const sha256Hash = await calculateFileHash(file);

  // Strategy A: Try direct Vercel Blob cloud upload if token is configured
  let attempt = 0;
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
      break;
    }
  }

  // Strategy B: For files <= 2 MB, use fast single-request upload
  if (file.size <= 2 * 1024 * 1024) {
    try {
      const result = await uploadDirectLocal(file, onProgress);
      result.sha256 = sha256Hash;
      return result;
    } catch (directErr) {
      console.warn('[Upload] Direct upload failed, trying chunked stream:', directErr.message);
    }
  }

  // Strategy C: For large files (e.g. 700MB video up to 1 TB), use 1MB chunked streaming
  try {
    const streamResult = await uploadViaChunkedStream(file, onProgress);
    streamResult.sha256 = sha256Hash;
    return streamResult;
  } catch (chunkErr) {
    throw new Error(`Upload failed for ${file.name}: ${chunkErr.message}`);
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
