import { upload } from '@vercel/blob/client';
import { calculateFileHash } from '../utils/cryptoHelper';

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per slice (fast streaming while strictly within Vercel 4.5MB limit)
const DIRECT_UPLOAD_MAX_SIZE = 100 * 1024 * 1024; // 100 MB direct high-speed single-request streaming

// Cache whether Vercel Blob cloud storage token is active on server
let isBlobConfigured = null;

async function checkBlobConfigured() {
  if (isBlobConfigured !== null) return isBlobConfigured;
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      isBlobConfigured = Boolean(data.hasBlobToken);
      return isBlobConfigured;
    }
  } catch {
    // fallback to false
  }
  isBlobConfigured = false;
  return false;
}

/**
 * Zero-Overhead Raw Stream Upload (Direct Binary Pipe from SSD/RAM to Socket, Fastest for 1GB+ files)
 */
function uploadRawStream(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const encodedName = encodeURIComponent(file.name);

    xhr.open('POST', `/api/blob/raw-upload?name=${encodedName}`, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-filename', encodedName);

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
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          const error = new Error(errData.error || `HTTP ${xhr.status}`);
          error.status = xhr.status;
          reject(error);
        } catch {
          const error = new Error(`HTTP ${xhr.status}`);
          error.status = xhr.status;
          reject(error);
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network connection error during raw stream upload.'));
    xhr.send(file);
  });
}

/**
 * Direct Single-Request Upload (High-Speed Multipart Stream)
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
          const error = new Error(errData.error || `Upload failed with HTTP ${xhr.status}`);
          error.status = xhr.status;
          reject(error);
        } catch {
          const error = new Error(`Upload failed with HTTP ${xhr.status}`);
          error.status = xhr.status;
          reject(error);
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
 * Upload a single chunk slice (4MB) with optional byte offset
 */
async function uploadSingleChunk(uploadId, chunkBlob, targetFilename, offset) {
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunk', chunkBlob);
  if (targetFilename) {
    formData.append('targetFilename', targetFilename);
  }
  if (offset !== undefined && offset !== null) {
    formData.append('offset', String(offset));
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
 * High-performance Parallel Chunked Stream Upload (4MB slices, 3x parallel streams, up to 1 TB)
 */
async function uploadViaChunkedStream(file, onProgress, chunkConcurrency = 3) {
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
  const effectiveChunkSize = Math.max(1 * 1024 * 1024, Math.min(chunkSize, CHUNK_SIZE));

  // Step 2: Slice into 4MB chunks
  const totalSize = file.size;
  const chunks = [];
  let offset = 0;
  while (offset < totalSize) {
    const end = Math.min(offset + effectiveChunkSize, totalSize);
    chunks.push({
      offset,
      blob: file.slice(offset, end),
      size: end - offset,
    });
    offset = end;
  }

  // Step 3: Stream chunks concurrently with worker pool
  let uploadedBytes = 0;
  let nextChunkIndex = 0;
  let activeWorkers = 0;

  await new Promise((resolve, reject) => {
    let hasError = false;

    function launchNextChunk() {
      if (hasError) return;

      if (uploadedBytes >= totalSize || (nextChunkIndex >= chunks.length && activeWorkers === 0)) {
        return resolve();
      }

      while (activeWorkers < chunkConcurrency && nextChunkIndex < chunks.length) {
        const chunkIndex = nextChunkIndex++;
        const { offset: chunkOffset, blob, size } = chunks[chunkIndex];
        activeWorkers++;

        uploadSingleChunk(uploadId, blob, targetFilename, chunkOffset)
          .then(() => {
            activeWorkers--;
            uploadedBytes += size;

            if (onProgress) {
              const pct = totalSize > 0 ? Math.min(100, Math.round((uploadedBytes / totalSize) * 100)) : 100;
              onProgress({
                loaded: uploadedBytes,
                total: totalSize,
                percentage: pct,
              });
            }

            launchNextChunk();
          })
          .catch((err) => {
            hasError = true;
            reject(err);
          });
      }
    }

    launchNextChunk();
  });

  // Step 4: Complete and assemble file descriptor
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
async function uploadWithRetry(file, onProgress) {
  // Compute SHA-256 fingerprint concurrently with the upload stream for zero initial latency
  const hashPromise = calculateFileHash(file);

  // Strategy 1: Zero-Overhead Direct Raw Stream (Fastest possible transfer without multipart buffering)
  try {
    const result = await uploadRawStream(file, onProgress);
    result.sha256 = await hashPromise;
    return result;
  } catch (rawErr) {
    console.warn('[Upload] Raw stream failed, trying multipart direct upload:', rawErr.message);
  }

  // Strategy 2: High-Speed Multipart Stream Fallback
  try {
    const result = await uploadDirectLocal(file, onProgress);
    result.sha256 = await hashPromise;
    return result;
  } catch (directErr) {
    console.warn('[Upload] Direct upload failed, falling back to 6-stream chunked upload:', directErr.message);
  }

  // Strategy 3: Multi-stream parallel chunked upload (For serverless / proxy / 413 limits)
  try {
    const streamResult = await uploadViaChunkedStream(file, onProgress, 6);
    streamResult.sha256 = await hashPromise;
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
    concurrency = 6,
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
