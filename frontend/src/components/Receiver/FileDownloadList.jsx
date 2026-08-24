import React, { useState } from 'react';
import { Download, Check, FileCheck, ArrowLeft, Clock, ShieldCheck, Flame, Lock } from 'lucide-react';
import { formatBytes, formatTimeRemaining, getFileTypeInfo } from '../../utils/formatters';
import { triggerFileDownload } from '../../utils/downloadHelper';
import { notifyDownloaded } from '../../services/api';

export function FileDownloadList({ shareData, onReset, onGoHome }) {
  const [downloadedIndices, setDownloadedIndices] = useState(new Set());
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [hasDestructed, setHasDestructed] = useState(false);

  const { code, files = [], totalSize, expiresAt, isPasswordProtected, selfDestruct } = shareData;

  const handleDownloadSingle = async (file, index) => {
    triggerFileDownload(file.downloadUrl || file.url, file.originalName);
    setDownloadedIndices((prev) => new Set([...prev, index]));

    if (selfDestruct) {
      await notifyDownloaded(code);
      setHasDestructed(true);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      triggerFileDownload(file.downloadUrl || file.url, file.originalName);
      setDownloadedIndices((prev) => new Set([...prev, i]));
      if (i < files.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    setDownloadingAll(false);

    if (selfDestruct) {
      await notifyDownloaded(code);
      setHasDestructed(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#242c3d]">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8a92a5] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Enter another code</span>
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#080b13] border border-[#242c3d] text-xs font-mono font-bold text-emerald-400">
          {isPasswordProtected && <Lock className="h-3 w-3 text-amber-400" />}
          <span>#{code}</span>
        </div>
      </div>

      {selfDestruct && (
        <div className="flex items-center gap-2 p-3 bg-rose-950/30 border border-rose-800 text-rose-300 text-xs rounded-xl">
          <Flame className="h-4 w-4 shrink-0 text-rose-400" />
          <span>
            {hasDestructed
              ? 'Self-destruct executed. These files have now been permanently deleted from storage.'
              : 'Self-destruct active: Files will be permanently deleted immediately after download.'}
          </span>
        </div>
      )}

      {/* Overview Card */}
      <div className="p-6 rounded-2xl bg-[#0b0f1a] border border-[#242c3d] space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Files Ready for Download</h3>
            <p className="text-xs text-[#8a92a5] mt-0.5">
              {files.length} file{files.length > 1 ? 's' : ''} &middot; Total size: {formatBytes(totalSize)}
            </p>
          </div>

          {files.length > 1 && !hasDestructed && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/25 active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              <span>{downloadingAll ? 'Starting Downloads...' : 'Download All Files'}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-3 border-t border-[#1e2738]">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Valid for: {formatTimeRemaining(expiresAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>SHA-256 Checksum Verified</span>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-3">
        {files.map((file, index) => {
          const fileType = getFileTypeInfo(file.originalName, file.mimeType);
          const isDownloaded = downloadedIndices.has(index);

          return (
            <div
              key={`${file.originalName}-${index}`}
              className="flex items-center justify-between p-4 rounded-2xl bg-[#0b0f1a] border border-[#242c3d] hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className={`p-2.5 rounded-xl border font-semibold text-xs ${fileType.color}`}>
                  <FileCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-slate-200 truncate">
                    {file.originalName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[#8a92a5]">
                    <span>{formatBytes(file.size)}</span>
                    <span>&middot;</span>
                    <span className="capitalize">{fileType.label}</span>
                    {file.sha256 && (
                      <>
                        <span>&middot;</span>
                        <span className="text-[10px] text-emerald-400 font-mono" title={`SHA-256: ${file.sha256}`}>
                          SHA-256 Verified
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!hasDestructed && (
                <button
                  onClick={() => handleDownloadSingle(file, index)}
                  aria-label={`Download ${file.originalName}`}
                  className={`shrink-0 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isDownloaded
                      ? 'bg-[#1a202c] text-emerald-400 border border-emerald-900/50'
                      : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20'
                  }`}
                >
                  {isDownloaded ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Downloaded</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
