import React, { useState, useEffect } from 'react';
import { Copy, Check, QrCode, Share2, Download, RefreshCw, Clock, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatBytes, formatTimeRemaining } from '../../utils/formatters';

export function ShareSuccessModal({ shareData, onReset }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const { code, shareUrl, qrCode, expiresAt, filesCount, totalSize } = shareData;

  useEffect(() => {
    // Fire confetti once
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#10b981', '#34d399', '#38bdf8']
      });
    } catch {
      // ignore
    }

    // Update countdown timer
    const updateTimer = () => {
      if (expiresAt) {
        setTimeLeft(formatTimeRemaining(expiresAt));
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'QuickShare Files',
          text: `Use QuickShare code ${code} to download ${filesCount} file(s):`,
          url: shareUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      copyToClipboard(shareUrl, 'link');
    }
  };

  const downloadQrImage = () => {
    if (!qrCode) return;
    const a = document.createElement('a');
    a.href = qrCode;
    a.download = `QuickShare-QR-${code}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header Banner */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Upload Persisted to Blob</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Ready to Share!</h2>
        <p className="text-xs text-slate-400">
          {filesCount} file{filesCount > 1 ? 's' : ''} ({formatBytes(totalSize)}) ready for download
        </p>
      </div>

      {/* Code & QR container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: 6-Digit Share Code */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-4 text-center">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">6-Digit Code</span>
            <div className="my-3 flex items-center justify-center gap-1.5">
              {code.split('').map((char, i) => (
                <span
                  key={i}
                  className="w-10 h-14 sm:w-11 sm:h-16 flex items-center justify-center text-2xl sm:text-3xl font-extrabold font-mono bg-slate-950 border border-slate-700/80 rounded-xl text-brand-400 shadow-inner"
                >
                  {char}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400">Receiver enters this code on their device</p>
          </div>

          <button
            onClick={() => copyToClipboard(code, 'code')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {copiedCode ? (
              <>
                <Check className="h-4 w-4 text-brand-400" />
                <span className="text-brand-400">Copied Code!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-slate-400" />
                <span>Copy 6-Digit Code</span>
              </>
            )}
          </button>
        </div>

        {/* Right: QR Code */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-between space-y-4 text-center">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scan with Phone</span>
            <div className="my-3 flex items-center justify-center">
              <div className="p-3 bg-white rounded-2xl shadow-xl">
                {qrCode ? (
                  <img
                    src={qrCode}
                    alt={`QuickShare QR Code ${code}`}
                    className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center text-slate-400">
                    <QrCode className="h-10 w-10 animate-spin" />
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400">Scan using camera or receiver tab</p>
          </div>

          <button
            onClick={downloadQrImage}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Save QR Image</span>
          </button>
        </div>
      </div>

      {/* Share Link & Actions */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>Expires in: <strong className="text-amber-300">{timeLeft}</strong></span>
          </div>
          <span>Automatic cloud cleanup</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 font-mono select-all focus:outline-none focus:border-brand-500"
          />
          <button
            onClick={() => copyToClipboard(shareUrl, 'link')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 transition-colors"
            title="Copy URL"
          >
            {copiedLink ? <Check className="h-4 w-4 text-brand-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={handleNativeShare}
            className="p-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-white transition-colors"
            title="Share URL"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Reset button */}
      <div className="text-center pt-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Upload another file batch</span>
        </button>
      </div>
    </div>
  );
}
