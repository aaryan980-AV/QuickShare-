/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format countdown / remaining time until timestamp
 */
export function formatTimeRemaining(expiryTimestamp) {
  const diff = expiryTimestamp - Date.now();
  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Return file category and color badge
 */
export function getFileTypeInfo(filename, mimeType = '') {
  const ext = filename.split('.').pop().toLowerCase();
  
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)) {
    return { type: 'image', label: 'Image', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
  }
  if (mimeType.startsWith('video/') || ['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) {
    return { type: 'video', label: 'Video', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return { type: 'audio', label: 'Audio', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'xlsx', 'pptx'].includes(ext)) {
    return { type: 'document', label: 'Document', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { type: 'archive', label: 'Archive', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
  }
  return { type: 'file', label: ext.toUpperCase() || 'File', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
}
