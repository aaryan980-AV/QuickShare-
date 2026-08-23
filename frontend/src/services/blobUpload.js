import { upload } from '@vercel/blob/client';

/**
 * Upload a single file with automatic retry logic
 */
async function uploadWithRetry(file, onProgress, maxRetries = 3) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      // Unique pathname to avoid collisions
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
      };
    } catch (error) {
      attempt++;
      lastError = error;
      console.warn(`[Upload] Attempt ${attempt} failed for ${file.name}:`, error.message);
      
      // If token retrieval explicitly fails due to missing server config, no need to endlessly retry
      if (error.message && error.message.includes('retrieve the client token')) {
        break;
      }

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }

  let finalMessage = lastError?.message || 'Network error';
  if (finalMessage.includes('retrieve the client token')) {
    finalMessage = 'Vercel Blob token missing. Please ensure Vercel Blob storage is created in your Vercel Dashboard (Storage tab) and BLOB_READ_WRITE_TOKEN is added to Environment Variables.';
  }

  throw new Error(`Failed to upload ${file.name}: ${finalMessage}`);
}

/**
 * Upload multiple files with controlled concurrency (e.g. 3 files in parallel)
 * and detailed per-file and total progress updates.
 */
export async function uploadFilesBatch(files, options = {}) {
  const {
    concurrency = 3,
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
