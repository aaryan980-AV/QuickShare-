import React, { useState, useEffect } from 'react';
import { Upload, Download, QrCode, KeyRound, Image as ImageIcon, Lock, Clock, FileText, Zap, ArrowLeft, ArrowRight } from 'lucide-react';
import { Header } from './components/Header';
import { Card } from './components/UI/Card';
import { Alert } from './components/UI/Alert';
import { FileDropzone, MAX_TOTAL_SIZE } from './components/Sender/FileDropzone';
import { UploadProgress } from './components/Sender/UploadProgress';
import { ShareSuccessModal } from './components/Sender/ShareSuccessModal';
import { CodeInput } from './components/Receiver/CodeInput';
import { CameraScanner } from './components/Receiver/CameraScanner';
import { ImageScanner } from './components/Receiver/ImageScanner';
import { FileDownloadList } from './components/Receiver/FileDownloadList';
import { uploadFilesBatch } from './services/blobUpload';
import { createShareBatch, getShareByCode } from './services/api';
import { formatBytes } from './utils/formatters';

export function App() {
  // Navigation: 'home' | 'send' | 'receive'
  const [currentView, setCurrentView] = useState('home');
  const [receiveMode, setReceiveMode] = useState('code'); // 'code' | 'camera' | 'image'

  // Sender state
  const [senderFiles, setSenderFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ percentage: 0, loaded: 0, total: 0, completedFiles: 0 });
  const [uploadStep, setUploadStep] = useState('blob'); // 'blob' | 'code'
  const [senderResult, setSenderResult] = useState(null);
  const [senderError, setSenderError] = useState(null);

  // Receiver state
  const [initialCode, setInitialCode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [receivedShare, setReceivedShare] = useState(null);
  const [receiverError, setReceiverError] = useState(null);

  // Handle URL query parameter ?code=XXXXXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && /^\d{6}$/.test(codeParam.trim())) {
      setCurrentView('receive');
      setReceiveMode('code');
      setInitialCode(codeParam.trim());
    }
  }, []);

  // SENDER FLOW: Upload to Blob directly, then register share
  const handleStartUpload = async () => {
    if (senderFiles.length === 0) return;
    setIsUploading(true);
    setSenderError(null);
    setUploadStep('blob');
    setUploadProgress({ percentage: 0, loaded: 0, total: 0, completedFiles: 0 });

    try {
      // Step 1: Client-to-Blob chunked upload with concurrency & retries
      const uploadedBlobs = await uploadFilesBatch(senderFiles, {
        concurrency: 3,
        onTotalProgress: (prog) => {
          setUploadProgress(prog);
        },
      });

      // Step 2: Register batch and generate 6-digit code & server-side QR
      setUploadStep('code');
      const shareData = await createShareBatch(uploadedBlobs);

      // Step 3: Success state
      setSenderResult(shareData);
    } catch (err) {
      console.error('[Upload Pipeline Error]', err);
      setSenderError(err.message || 'Failed to upload files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetSender = () => {
    setSenderFiles([]);
    setSenderResult(null);
    setSenderError(null);
    setUploadProgress({ percentage: 0, loaded: 0, total: 0, completedFiles: 0 });
  };

  const handleGoHome = () => {
    setCurrentView('home');
    setSenderError(null);
    setReceiverError(null);
  };

  // RECEIVER FLOW: Lookup code
  const handleLookupCode = async (code) => {
    setIsLookingUp(true);
    setReceiverError(null);
    try {
      const data = await getShareByCode(code);
      setReceivedShare(data);
    } catch (err) {
      console.error('[Lookup Error]', err);
      setReceiverError(err.message || 'Share code not found or expired.');
      setReceivedShare(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleResetReceiver = () => {
    setReceivedShare(null);
    setReceiverError(null);
    setInitialCode('');
  };

  return (
    <div className="min-h-full flex flex-col justify-between bg-slate-950 text-slate-100">
      <Header currentView={currentView} onGoHome={handleGoHome} />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:py-12">
        {/* ==================================================================== */}
        {/* SCREEN 1: LANDING / HOME SCREEN (SPLIT SEND / RECEIVE)                */}
        {/* ==================================================================== */}
        {currentView === 'home' && (
          <div className="space-y-8 text-center animate-fade-in">
            {/* Top: App Name / Logo Centered */}
            <div className="space-y-3 pt-2">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-blue-950/40 border border-blue-900/50 flex items-center justify-center text-blue-400">
                <Zap className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  QuickShare
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Fast, persistent, peer-to-peer file sharing
                </p>
              </div>
            </div>

            {/* Split Send / Receive Cards (Side-by-side on desktop, stacked on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Send Card: Cool Blue-ish tint, flat fill */}
              <div
                onClick={() => setCurrentView('send')}
                className="p-6 rounded-2xl bg-blue-950/20 border border-blue-900/40 hover:border-blue-700/60 transition-colors flex flex-col items-center justify-between text-center space-y-5 cursor-pointer group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setCurrentView('send')}
                aria-label="Send files"
              >
                <div className="space-y-3 flex flex-col items-center">
                  <div className="h-12 w-12 rounded-xl bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400 group-hover:text-blue-300 transition-colors">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Send</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Upload and get a code</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView('send');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Select Files</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Receive Card: Green-ish tint, flat fill */}
              <div
                onClick={() => setCurrentView('receive')}
                className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 hover:border-emerald-700/60 transition-colors flex flex-col items-center justify-between text-center space-y-5 cursor-pointer group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setCurrentView('receive')}
                aria-label="Receive files"
              >
                <div className="space-y-3 flex flex-col items-center">
                  <div className="h-12 w-12 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400 group-hover:text-emerald-300 transition-colors">
                    <Download className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Receive</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Enter a code or scan</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView('receive');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Enter Code / Scan</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Row of Trust Indicators */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-300" />
                <span>Encrypted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-300" />
                <span>Auto-expires</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-300" />
                <span>Up to {formatBytes(MAX_TOTAL_SIZE, 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN 2 / SEND VIEW: Upload dropzone, progress, & post-upload screen */}
        {/* ==================================================================== */}
        {currentView === 'send' && (
          <Card className="animate-fade-in">
            {senderResult ? (
              <ShareSuccessModal
                shareData={senderResult}
                onReset={handleResetSender}
                onGoHome={handleGoHome}
              />
            ) : (
              <div className="space-y-6">
                {senderError && (
                  <Alert
                    type="error"
                    title="Upload Failed"
                    message={senderError}
                    onClose={() => setSenderError(null)}
                  />
                )}

                {isUploading ? (
                  <UploadProgress
                    progress={uploadProgress}
                    files={senderFiles}
                    currentStep={uploadStep}
                  />
                ) : (
                  <FileDropzone
                    files={senderFiles}
                    onFilesChange={setSenderFiles}
                    onStartUpload={handleStartUpload}
                    isUploading={isUploading}
                    onGoHome={handleGoHome}
                  />
                )}
              </div>
            )}
          </Card>
        )}

        {/* ==================================================================== */}
        {/* RECEIVE VIEW: Code input, QR camera scanner, image upload            */}
        {/* ==================================================================== */}
        {currentView === 'receive' && (
          <Card className="animate-fade-in">
            {receivedShare ? (
              <FileDownloadList
                shareData={receivedShare}
                onReset={handleResetReceiver}
                onGoHome={handleGoHome}
              />
            ) : (
              <div className="space-y-6">
                {/* Header with Back button */}
                <div className="flex items-center justify-between pb-1">
                  <button
                    onClick={handleGoHome}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Home</span>
                  </button>
                  <span className="text-xs text-slate-500 font-medium">Receive Files</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-white tracking-tight">Receive Files</h2>
                  <p className="text-xs text-slate-400">
                    Enter a 6-digit share code or scan a QR code to download files.
                  </p>
                </div>

                {/* Receiver Sub-Mode Toggle */}
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    onClick={() => {
                      setReceiveMode('code');
                      setReceiverError(null);
                    }}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                      receiveMode === 'code'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>6-Digit Code</span>
                  </button>

                  <button
                    onClick={() => {
                      setReceiveMode('camera');
                      setReceiverError(null);
                    }}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                      receiveMode === 'camera'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Camera Scan</span>
                  </button>

                  <button
                    onClick={() => {
                      setReceiveMode('image');
                      setReceiverError(null);
                    }}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                      receiveMode === 'image'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>QR Image</span>
                  </button>
                </div>

                {receiverError && (
                  <Alert
                    type="error"
                    title="Lookup Error"
                    message={receiverError}
                    onClose={() => setReceiverError(null)}
                  />
                )}

                {/* Sub-mode views */}
                {receiveMode === 'code' && (
                  <CodeInput
                    onLookup={handleLookupCode}
                    isLoading={isLookingUp}
                    initialCode={initialCode}
                  />
                )}

                {receiveMode === 'camera' && (
                  <CameraScanner
                    onScanSuccess={(code) => handleLookupCode(code)}
                    onScanError={(err) => setReceiverError(err)}
                  />
                )}

                {receiveMode === 'image' && (
                  <ImageScanner
                    onScanSuccess={(code) => handleLookupCode(code)}
                    onScanError={(err) => setReceiverError(err)}
                  />
                )}
              </div>
            )}
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-500">
        <p>QuickShare &middot; Built on Vercel Services</p>
      </footer>
    </div>
  );
}
