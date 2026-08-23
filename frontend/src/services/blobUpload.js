import { upload } from '@vercel/blob/client';

/**
 * Upload a single file via local backend endpoint (fallback when Vercel Blob token is not set)
 */
function uploadViaLocalServer(file, onProgress) {
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
          reject(new Error(errData.error || 'Local upload failed'));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload'));
    };

    xhr.send(formData);
  });
}

/**
 * Upload a single file: Tries direct Vercel Blob first; if no token configured, falls back to local server
 */
async function uploadWithRetry(file, onProgress, maxRetries = 2) {
  let attempt = 0;
  let lastError = null;

  // Try direct Vercel Blob client upload first
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
      };
    } catch (error) {
      attempt++;
      lastError = error;

      // If token is missing, seamlessly fall back to local dev upload endpoint
      if (error.message && error.message.includes('retrieve the client token')) {
        console.log(`[Upload] Vercel Blob token not found, seamlessly using local dev server upload for ${file.name}`);
        return await uploadViaLocalServer(file, onProgress);
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // Fallback to local server upload if Vercel Blob failed
  try {
    return await uploadViaLocalServer(file, onProgress);
  } catch (localErr) {
    throw new Error(`Failed to upload ${file.name}: ${localErr.message || lastError?.message}`);
  }
}

/**
 * Upload multiple files with controlled concurrency and progress tracking
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
