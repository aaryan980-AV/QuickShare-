/**
 * Fast cross-browser native file download trigger
 * Uses native browser download streaming directly to disk with zero in-memory buffering.
 */
export function triggerFileDownload(rawUrl, filename) {
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
      }, 1000);
      return;
    }

    // 2. Normalize URLs
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

    // 3. Instant Native Browser Download (Direct stream to disk, native browser speed & download manager)
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = downloadUrl;
    link.download = filename || 'download';
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 1000);
  } catch (error) {
    console.error('Download trigger error:', error);
    window.open(rawUrl, '_blank');
  }
}
