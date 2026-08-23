import React from 'react';
import { formatBytes } from '../../utils/formatters';

export function UploadProgress({ progress, files, currentStep }) {
  const { percentage = 0, loaded = 0, total = 0, completedFiles = 0 } = progress;

  const totalFilesCount = files.length;
  const currentLoadedFormatted = formatBytes(loaded);
  const totalFormatted = formatBytes(total);

  return (
    <div className="w-full max-w-sm mx-auto space-y-2 text-center py-4 animate-fade-in">
      {/* Small status text above the progress bar, light gray (#9aa3b8), 13px */}
      <div className="flex items-center justify-between text-[13px] text-[#9aa3b8]">
        <span>
          {currentStep === 'code'
            ? 'Generating code & QR...'
            : `${totalFilesCount} file${totalFilesCount > 1 ? 's' : ''} \u00b7 ${currentLoadedFormatted} of ${totalFormatted} uploaded`}
        </span>
        <span className="font-mono font-medium text-white">{percentage}%</span>
      </div>

      {/* Progress bar: track color #1c2333, fill color #3b82f6 (blue), 8px height, 8px border-radius, full width */}
      <div className="w-full bg-[#1c2333] h-[8px] rounded-[8px] overflow-hidden">
        <div
          className="bg-[#3b82f6] h-full rounded-[8px] transition-all duration-200 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}
