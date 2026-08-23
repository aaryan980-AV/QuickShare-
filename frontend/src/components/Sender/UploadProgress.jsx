import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export function UploadProgress({ progress, files, currentStep }) {
  const { percentage = 0, loaded = 0, total = 0, completedFiles = 0 } = progress;

  const totalFilesCount = files.length;
  const currentLoadedFormatted = formatBytes(loaded);
  const totalFormatted = formatBytes(total);

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-left">
      {/* Live Text Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
            <h3 className="text-sm font-semibold text-white">
              {currentStep === 'code' ? 'Generating Share Code...' : 'Uploading Files...'}
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {totalFilesCount} file{totalFilesCount > 1 ? 's' : ''} &middot; {currentLoadedFormatted} of {totalFormatted} uploaded
          </p>
        </div>

        <span className="text-base font-bold text-blue-400 font-mono">
          {percentage}%
        </span>
      </div>

      {/* Progress Bar - Flat */}
      <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
        <div
          className="bg-blue-500 h-full rounded-full transition-all duration-200 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {completedFiles} of {totalFilesCount} file{totalFilesCount > 1 ? 's' : ''} completed
        </span>
        <span>Parallel chunked upload</span>
      </div>
    </div>
  );
}
