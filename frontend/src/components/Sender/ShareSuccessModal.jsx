import React, { useState } from 'react';
import { Copy, Check, QrCode, ArrowLeft, RefreshCw } from 'lucide-react';

export function ShareSuccessModal({ shareData, onReset, onGoHome }) {
  const [copiedLink, setCopiedLink] = useState(false);

  const { code, shareUrl, qrCode } = shareData;

  // Format 6-digit code with spacing into two groups of three: "849 201"
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
    <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center space-y-5 py-4 animate-fade-in">
      {/* QR Code Container: ~140x140px, background #141a29, 1px border #262f45, 14px border-radius */}
      <div className="w-[140px] h-[140px] bg-[#141a29] border border-[#262f45] rounded-[14px] p-2.5 flex items-center justify-center">
        {qrCode ? (
          <img
            src={qrCode}
            alt={`QuickShare QR Code for ${code}`}
            className="w-full h-full object-contain rounded-[6px]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <QrCode className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        )}
      </div>

      {/* Code Section */}
      <div className="space-y-1 w-full">
        {/* Muted label "Or share this code" — #8b93a7, 12px, centered */}
        <p className="text-[12px] text-[#8b93a7]">
          Or share this code
        </p>

        {/* The actual share code — white, 26px, medium weight, monospace font, letter-spacing ~4px */}
        <p className="text-[26px] font-medium text-white font-mono tracking-[4px] select-all leading-tight">
          {formattedCode}
        </p>
      </div>

      {/* Full-width "Copy link" button: background #1c2333, 1px border #2e3650, white text, 10px border-radius, ~11px vertical padding, copy icon on the left */}
      <div className="w-full space-y-4 pt-1">
        <button
          onClick={copyToClipboard}
          aria-label="Copy share link"
          className="w-full py-[11px] px-4 bg-[#1c2333] hover:bg-[#252e42] border border-[#2e3650] text-white text-sm rounded-[10px] flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
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

        {/* Auxiliary navigation */}
        <div className="flex items-center justify-center gap-4 text-xs text-[#8b93a7] pt-1">
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
