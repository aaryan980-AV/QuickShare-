import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertTriangle, RefreshCw, Zap, ShieldAlert } from 'lucide-react';

export function CameraScanner({ onScanSuccess, onScanError }) {
  const [cameraState, setCameraState] = useState('idle'); // idle | starting | scanning | error
  const [errorMessage, setErrorMessage] = useState('');
  const [errorType, setErrorType] = useState(null); // permission | not_found | insecure | generic
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef(null);
  const readerElementId = 'qr-reader-viewport';

  useEffect(() => {
    // Check for Secure Context
    if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCameraState('error');
      setErrorType('insecure');
      setErrorMessage('Camera access requires HTTPS. Please access this application via HTTPS.');
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [selectedCameraId]);

  const startScanner = async () => {
    setCameraState('starting');
    setErrorMessage('');
    setErrorType(null);

    try {
      // Get list of available cameras
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setCameraState('error');
        setErrorType('not_found');
        setErrorMessage('No camera devices were detected on this device.');
        return;
      }

      setCameras(devices);

      // Prefer back camera on mobile
      let targetCameraId = selectedCameraId;
      if (!targetCameraId) {
        const backCamera = devices.find((d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        targetCameraId = backCamera ? backCamera.id : devices[0].id;
        setSelectedCameraId(targetCameraId);
      }

      // Stop any existing instance
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode(readerElementId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        targetCameraId,
        config,
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // Frame scan pass - normal, ignore
        }
      );

      setCameraState('scanning');

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
        if (capabilities && capabilities.torchFeature().isSupported()) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      console.error('[CameraScanner Error]', err);
      setCameraState('error');

      const errMsg = err.name || err.toString();
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission denied')) {
        setErrorType('permission');
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser address bar.');
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
        setErrorType('not_found');
        setErrorMessage('No camera hardware found on this system.');
      } else if (errMsg.includes('NotReadableError') || errMsg.includes('TrackStartError')) {
        setErrorType('in_use');
        setErrorMessage('Camera is currently in use by another application.');
      } else {
        setErrorType('generic');
        setErrorMessage(err.message || 'Failed to start camera scanner.');
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
    }
  };

  const handleDecodedText = (text) => {
    // Check if it is a QuickShare URL (e.g. ?code=123456) or raw 6-digit code
    let code = null;
    const urlMatch = text.match(/code=(\d{6})/i);
    if (urlMatch) {
      code = urlMatch[1];
    } else {
      const digitMatch = text.match(/\b\d{6}\b/);
      if (digitMatch) {
        code = digitMatch[0];
      }
    }

    if (code) {
      stopScanner();
      onScanSuccess(code);
    } else {
      if (onScanError) {
        onScanError(`Scanned QR code does not contain a valid QuickShare 6-digit code: ${text.slice(0, 30)}...`);
      }
    }
  };

  const toggleTorch = async () => {
    if (scannerRef.current && hasTorch) {
      try {
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: !torchOn }]
        });
        setTorchOn(!torchOn);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  const switchCamera = (deviceId) => {
    setSelectedCameraId(deviceId);
  };

  return (
    <div className="space-y-4">
      {/* Scanner Viewport */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[300px] flex items-center justify-center">
        <div id={readerElementId} className="w-full h-full max-w-sm mx-auto" />

        {cameraState === 'starting' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-10">
            <RefreshCw className="h-8 w-8 text-brand-400 animate-spin" />
            <p className="text-xs text-slate-300 font-medium">Requesting camera access...</p>
          </div>
        )}

        {cameraState === 'error' && (
          <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center space-y-3 z-10 animate-fade-in">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              {errorType === 'permission' ? <CameraOff className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {errorType === 'permission' ? 'Camera Permission Denied' : 'Camera Unavailable'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <button
              onClick={startScanner}
              className="mt-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Camera</span>
            </button>
          </div>
        )}

        {/* Floating Controls Overlay when scanning */}
        {cameraState === 'scanning' && (
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2 rounded-xl backdrop-blur-md border transition-colors ${
                  torchOn
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Toggle Torch / Flashlight"
              >
                <Zap className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Camera switcher */}
      {cameras.length > 1 && cameraState === 'scanning' && (
        <div className="flex items-center justify-center gap-2">
          <Camera className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedCameraId || ''}
            onChange={(e) => switchCamera(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-500"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || `Camera ${c.id.substring(0, 5)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-[11px] text-slate-500 text-center">
        Center the QuickShare QR code inside the viewfinder to scan automatically
      </p>
    </div>
  );
}
