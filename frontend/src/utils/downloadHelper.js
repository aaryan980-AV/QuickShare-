/**
 * Reliable cross-browser file download trigger
 * Handles Blob URLs, relative paths, mixed origin, and enforces clean filenames.
 */
export async function triggerFileDownload(rawUrl, filename) {
  try {
    let url = rawUrl;

    // Resolve relative URLs to the current page origin
    if (url.startsWith('/')) {
      url = `${window.location.origin}${url}`;
    } else if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        try {
          const parsed = new URL(url);
          url = `${window.location.origin}${parsed.pathname}${parsed.search}`;
        } catch {
          // ignore
        }
      }
    }

    // Append download hint and original filename query parameter
    const separator = url.includes('?') ? '&' : '?';
    const downloadUrl = `${url}${separator}download=1&name=${encodeURIComponent(filename || 'download')}`;

    // Primary: Try In-Memory Blob Fetch for 100% reliable local/browser saving
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

    // Fallback: Direct hidden anchor tag
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
