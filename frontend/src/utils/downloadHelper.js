/**
 * Trigger direct download for a file
 */
export async function triggerFileDownload(url, filename) {
  try {
    // For Vercel Blob URLs with ?download=1 or direct links
    const downloadUrl = url.includes('?') ? `${url}&download=1` : `${url}?download=1`;
    
    // Create hidden anchor
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download error, opening directly:', error);
    window.open(url, '_blank');
  }
}
