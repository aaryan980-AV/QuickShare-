import React, { useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Image as ImageIcon, Upload, Loader2, AlertCircle } from 'lucide-react';

export function ImageScanner({ onScanSuccess, onScanError }) {
  const [isScanning, setIsScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  const processImageFile = async (file) => {
    if (!file) return;
    setErrorMsg(null);
    setIsScanning(true);
    setPreviewUrl(URL.createObjectURL(file));

    const html5QrCode = new Html5Qrcode('qr-image-temp-canvas');

    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      
      let code = null;
      const urlMatch = decodedText.match(/code=(\d{6})/i);
      if (urlMatch) {
        code = urlMatch[1];
      } else {
        const digitMatch = decodedText.match(/\b\d{6}\b/);
        if (digitMatch) {
          code = digitMatch[0];
        }
      }

      if (code) {
        onScanSuccess(code);
      } else {
        setErrorMsg(`No QuickShare 6-digit code found in image (found: "${decodedText.slice(0, 35)}...")`);
        if (onScanError) onScanError('Invalid QR code format.');
      }
    } catch (err) {
      console.warn('QR image decoding error:', err);
      setErrorMsg('Could not detect a QR code in this image. Please try another image or use manual code entry.');
      if (onScanError) onScanError('Failed to read QR image.');
    } finally {
      html5QrCode.clear();
      setIsScanning(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden element required by Html5Qrcode */}
      <div id="qr-image-temp-canvas" className="hidden" />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && processImageFile(e.target.files[0])}
          className="hidden"
          disabled={isScanning}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          {previewUrl ? (
            <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-700 shadow-md">
              <img src={previewUrl} alt="QR Preview" className="w-full h-full object-cover" />
              {isScanning && (
                <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-brand-400 animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-white">
              {isScanning ? 'Decoding QR Code...' : 'Upload QR Screenshot or Photo'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Drag and drop an image or click to select from files
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
