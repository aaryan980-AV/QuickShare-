import React, { useState } from 'react';
import { Copy, Check, QrCode, MoreHorizontal, RefreshCw, ArrowLeft } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export function ShareSuccessModal({ shareData, onReset, onGoHome, isUploading, uploadProgress, uploadFiles }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const { code, shareUrl, qrCode, filesCount = uploadFiles?.length || 0, totalSize = 0 } = shareData || {};

  const percentage = uploadProgress?.percentage ?? 100;
  const loadedBytes = uploadProgress?.loaded ?? totalSize;
  const formattedUploaded = formatBytes(loadedBytes);
  const filesCountDisplay = filesCount || uploadFiles?.length || 1;

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col items-center space-y-6 pt-2 pb-6 animate-fade-in relative">
      {/* Top right 3-dots menu button */}
      <div className="w-full flex justify-end relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          aria-label="More options"
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-8 bg-[#141824] border border-[#242c3d] rounded-xl p-1.5 shadow-2xl z-20 w-44 space-y-1 animate-fade-in">
            <button
              onClick={() => {
                setShowMenu(false);
                onReset();
              }}
              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Send more files</span>
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onGoHome();
              }}
              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress header & bar */}
      <div className="w-full space-y-3">
        {/* Status text: "3 files · 640MB uploaded" */}
        <p className="text-center text-[13px] text-[#9aa3b8] font-normal tracking-wide">
          {filesCountDisplay} file{filesCountDisplay > 1 ? 's' : ''} &middot; {formattedUploaded} uploaded
        </p>

        {/* Progress bar with blue fill */}
        <div className="w-full bg-[#1c2230] h-[6px] rounded-full overflow-hidden">
          <div
            className="bg-[#2563eb] h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(isUploading ? percentage : 100, 5))}%` }}
          />
        </div>
      </div>

      {/* Center QR Card (Squircle dark container) */}
      <div className="w-[146px] h-[146px] bg-[#141824] border border-[#242c3d] rounded-[22px] p-3.5 flex items-center justify-center shadow-lg">
        {qrCode ? (
          <img
            src={qrCode}
            alt={`QuickShare QR ${code}`}
            className="w-full h-full object-contain rounded-[10px]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <QrCode className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-[10px]">Generating...</span>
          </div>
        )}
      </div>

      {/* 6-Digit Code Section */}
      <div className="text-center space-y-1 pt-1">
        <p className="text-[13px] text-[#8a92a5] font-normal">
          Or share this code
        </p>
        <p className="text-[34px] sm:text-[38px] font-bold text-white font-mono tracking-[0.25em] select-all leading-tight">
          {code || '••••••'}
        </p>
      </div>

      {/* Full-width "Copy link" button */}
      <div className="w-full pt-2">
        <button
          onClick={copyToClipboard}
          disabled={!shareUrl}
          aria-label="Copy link"
          className="w-full py-3 px-4 bg-[#1a202c] hover:bg-[#222a3a] border border-[#2d3748] text-white text-[14px] font-medium rounded-[12px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50"
        >
          {copiedLink ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Copied link!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-slate-300" />
              <span>Copy link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
