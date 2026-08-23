import React, { useState } from 'react';
import { Download, Check, FileCheck, ArrowLeft, Clock, ShieldCheck } from 'lucide-react';
import { formatBytes, formatTimeRemaining, getFileTypeInfo } from '../../utils/formatters';
import { triggerFileDownload } from '../../utils/downloadHelper';

export function FileDownloadList({ shareData, onReset, onGoHome }) {
  const [downloadedIndices, setDownloadedIndices] = useState(new Set());
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { code, files = [], totalSize, expiresAt } = shareData;

  const handleDownloadSingle = (file, index) => {
    triggerFileDownload(file.downloadUrl || file.url, file.originalName);
    setDownloadedIndices((prev) => new Set([...prev, index]));
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Enter another code</span>
        </button>

        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-emerald-400">
          #{code}
        </div>
      </div>

      {/* Overview Card */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Files Ready for Download</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {files.length} file{files.length > 1 ? 's' : ''} &middot; Total size: {formatBytes(totalSize)}
            </p>
          </div>

          {files.length > 1 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>{downloadingAll ? 'Starting Downloads...' : 'Download All Files'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-900">
          <div className="flex items-center gap-1 text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Valid for: {formatTimeRemaining(expiresAt)}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Direct Blob Download</span>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-2.5">
        {files.map((file, index) => {
          const fileType = getFileTypeInfo(file.originalName, file.mimeType);
          const isDownloaded = downloadedIndices.has(index);

          return (
            <div
              key={`${file.originalName}-${index}`}
              className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className={`p-2.5 rounded-lg border font-semibold text-xs ${fileType.color}`}>
                  <FileCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">
                    {file.originalName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{formatBytes(file.size)}</span>
                    <span>&middot;</span>
                    <span className="capitalize">{fileType.label}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDownloadSingle(file, index)}
                aria-label={`Download ${file.originalName}`}
                className={`shrink-0 py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isDownloaded
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-900'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
