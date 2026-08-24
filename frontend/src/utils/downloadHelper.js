/**
 * Reliable cross-browser file download trigger
 * Handles Data URLs, Blob URLs, relative paths, and direct downloads.
 */
export async function triggerFileDownload(rawUrl, filename) {
  try {
    const url = rawUrl;

    // 1. Data URLs: Instant zero-network client download
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
      }, 1500);
      return;
    }

    // 2. Relative URLs: Prefix current origin
    let targetUrl = url;
    if (targetUrl.startsWith('/')) {
      targetUrl = `${window.location.origin}${targetUrl}`;
    } else if (targetUrl.startsWith('http://localhost') || targetUrl.startsWith('http://127.0.0.1')) {
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        try {
          const parsed = new URL(targetUrl);
          targetUrl = `${window.location.origin}${parsed.pathname}${parsed.search}`;
        } catch {
          // ignore
        }
      }
    }

    const separator = targetUrl.includes('?') ? '&' : '?';
    const downloadUrl = `${targetUrl}${separator}download=1&name=${encodeURIComponent(filename || 'download')}`;

    // 3. Try In-Memory Blob Fetch
    try {
      const response = await fetch(downloadUrl);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        }, 1500);
        return;
      }
    } catch (fetchErr) {
      console.warn('[Download] In-memory blob fetch fallback to direct anchor:', fetchErr);
    }

    // 4. Direct Anchor Fallback
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 1500);
  } catch (error) {
    console.error('Download trigger error:', error);
    window.open(rawUrl, '_blank');
  }
}
