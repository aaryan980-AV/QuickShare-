import React, { useState } from 'react';
import { Copy, Check, QrCode, ArrowLeft, RefreshCw } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export function ShareSuccessModal({ shareData, onReset, onGoHome }) {
  const [copiedLink, setCopiedLink] = useState(false);

  const { code, shareUrl, qrCode, filesCount, totalSize } = shareData;

  // Format 6-digit code with spacing: "849 201"
  const formattedCode = code && code.length === 6 
    ? `${code.slice(0, 3)} ${code.slice(3)}` 
    : code;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-2">
      {/* Upload Confirmation Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Files Ready to Share</h2>
        <p className="text-xs text-slate-400">
          {filesCount} file{filesCount > 1 ? 's' : ''} &middot; {formatBytes(totalSize)} uploaded
        </p>
      </div>

      {/* QR Code in bordered card (roughly 140x140px) */}
      <div className="p-3 bg-white border border-slate-700 rounded-2xl flex items-center justify-center">
        {qrCode ? (
          <img
            src={qrCode}
            alt={`QuickShare QR Code for ${code}`}
            className="w-[140px] h-[140px] object-contain rounded-lg"
          />
        ) : (
          <div className="w-[140px] h-[140px] flex items-center justify-center text-slate-400">
            <QrCode className="h-10 w-10 animate-spin text-slate-900" />
          </div>
        )}
      </div>

      {/* Code Section */}
      <div className="space-y-1.5 w-full max-w-sm">
        <span className="text-xs font-medium text-slate-400">
          Or share this code
        </span>
        <div className="py-2.5 px-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-3xl sm:text-4xl font-extrabold tracking-[0.2em] font-mono text-white select-all">
            {formattedCode}
          </p>
        </div>
      </div>

      {/* Full-width Secondary-Style Copy Link Button */}
      <div className="w-full max-w-sm space-y-3 pt-1">
        <button
          onClick={copyToClipboard}
          className={`w-full py-3 px-4 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition-colors ${
            copiedLink
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
          }`}
          aria-label="Copy share link to clipboard"
        >
          {copiedLink ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              <span>Copied link!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 text-slate-300" />
              <span>Copy link</span>
            </>
          )}
        </button>

        {/* Auxiliary actions */}
        <div className="flex items-center justify-center gap-4 text-xs pt-2 text-slate-400">
          <button
            onClick={onReset}
            className="hover:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Send more files</span>
          </button>
          <span>&middot;</span>
          <button
            onClick={onGoHome}
            className="hover:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
}
