import React from 'react';
import { Loader2, CheckCircle2, CloudUpload } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export function UploadProgress({ progress, files, currentStep }) {
  const { percentage = 0, loaded = 0, total = 0, completedFiles = 0 } = progress;

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {currentStep === 'blob' && 'Direct Cloud Upload to Blob...'}
              {currentStep === 'code' && 'Generating 6-Digit Code & QR...'}
              {currentStep === 'finalizing' && 'Finalizing Share Batch...'}
            </h3>
            <p className="text-xs text-slate-400">
              {completedFiles} of {files.length} file{files.length > 1 ? 's' : ''} uploaded ({formatBytes(loaded)} of {formatBytes(total)})
            </p>
          </div>
        </div>

        <span className="text-lg font-bold text-brand-400">{percentage}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/50">
        <div
          className="bg-gradient-to-r from-brand-500 via-emerald-400 to-teal-400 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Chunked parallel stream</span>
        <span>Auto-retry enabled</span>
      </div>
    </div>
  );
}
