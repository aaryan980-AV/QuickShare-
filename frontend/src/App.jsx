import React, { useState, useEffect } from 'react';
import { Upload, Download, QrCode, KeyRound, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { Alert } from './components/UI/Alert';
import { FileDropzone } from './components/Sender/FileDropzone';
import { ShareSuccessModal } from './components/Sender/ShareSuccessModal';
import { CodeInput } from './components/Receiver/CodeInput';
import { CameraScanner } from './components/Receiver/CameraScanner';
import { ImageScanner } from './components/Receiver/ImageScanner';
import { FileDownloadList } from './components/Receiver/FileDownloadList';
import { PasswordUnlockModal } from './components/Receiver/PasswordUnlockModal';
import { uploadFilesBatch } from './services/blobUpload';
import { createShareBatch, getShareByCode } from './services/api';

export function App() {
  // Navigation: 'home' | 'send' | 'receive'
  const [currentView, setCurrentView] = useState('home');
  const [receiveMode, setReceiveMode] = useState('code'); // 'code' | 'camera' | 'image'

  // Sender state
  const [senderFiles, setSenderFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ percentage: 0, loaded: 0, total: 0, completedFiles: 0 });
  const [senderResult, setSenderResult] = useState(null);
  const [senderError, setSenderError] = useState(null);

  // Receiver state
  const [initialCode, setInitialCode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [receivedShare, setReceivedShare] = useState(null);
  const [receiverError, setReceiverError] = useState(null);
  const [pendingPasswordCode, setPendingPasswordCode] = useState(null);

  // RECEIVER FLOW: Lookup code
  const handleLookupCode = async (code, password) => {
    const cleanCode = String(code).replace(/\D/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setReceiverError('Please enter a valid 6-digit share code.');
      return;
    }

    setIsLookingUp(true);
    setReceiverError(null);
    try {
      const data = await getShareByCode(cleanCode, password);

      if (data.requiresPassword) {
        setPendingPasswordCode(cleanCode);
        setCurrentView('receive');
        return;
      }

      setPendingPasswordCode(null);
      setReceivedShare(data);
      setCurrentView('receive');
    } catch (err) {
      console.error('[Lookup Error]', err);
      if (err.requiresPassword) {
        setPendingPasswordCode(cleanCode);
      }
      setReceiverError(err.message || 'Share code not found or expired.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Handle URL query parameter ?code=XXXXXX (e.g. from mobile camera QR scan)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      const cleanCode = codeParam.replace(/\D/g, '');
      if (cleanCode.length === 6) {
        setCurrentView('receive');
        setReceiveMode('code');
        setInitialCode(cleanCode);
        handleLookupCode(cleanCode);
      }
    }
  }, []);

  // Upload pipeline with security options
  const handleStartUpload = async (securityOptions = {}) => {
    if (senderFiles.length === 0) return;
    setIsUploading(true);
    setSenderError(null);
    setSenderResult(null);
    setUploadProgress({ percentage: 0, loaded: 0, total: 0, completedFiles: 0 });

    try {
      // Step 1: Upload to Blob / Local storage with SHA-256 calculation
      const uploadedBlobs = await uploadFilesBatch(senderFiles, {
        concurrency: 3,
        onTotalProgress: (prog) => {
          setUploadProgress(prog);
        },
      });

      // Step 2: Register batch with password & expiry options
      const shareData = await createShareBatch(uploadedBlobs, securityOptions);

      // Step 3: Set completed result
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
    setSenderFiles([]);
    setSenderResult(null);
    setSenderError(null);
    setReceiverError(null);
    setPendingPasswordCode(null);
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleResetReceiver = () => {
    setReceivedShare(null);
    setReceiverError(null);
    setPendingPasswordCode(null);
    setInitialCode('');
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#0b0f1a] text-slate-100 selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-emerald-600/5 blur-[120px] pointer-events-none rounded-full" />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 flex flex-col justify-center items-center z-10">
        {/* ==================================================================== */}
        {/* SCREEN 1 - FRONT PAGE (Expanded Full-Page Cover Layout)              */}
        {/* ==================================================================== */}
        {currentView === 'home' && (
          <div className="w-full max-w-4xl space-y-12 sm:space-y-16 animate-fade-in flex flex-col items-center">
            {/* Centered App Title & Tagline */}
            <div className="text-center space-y-3">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight">
                QuickShare
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-md mx-auto">
                Encrypted & secure peer-to-peer file transfer across any device
              </p>
            </div>

            {/* Two Large Side-by-Side Options: Send and Receive */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 w-full">
              {/* Left: Send Option */}
              <div
                onClick={() => setCurrentView('send')}
                className="group relative flex flex-col items-center text-center p-8 sm:p-12 rounded-3xl bg-[#141824]/90 hover:bg-[#181f30] border border-[#242c3d] hover:border-blue-500/50 transition-all duration-300 shadow-2xl hover:shadow-blue-500/10 cursor-pointer"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-blue-500/10 border border-blue-500/20 group-hover:border-blue-500/40 group-hover:scale-110 flex items-center justify-center text-blue-400 transition-all duration-300 mb-6">
                  <Upload className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={1.75} />
                </div>
                <div className="space-y-2 mb-8">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-white group-hover:text-blue-200 transition-colors">
                    Send
                  </h2>
                  <p className="text-sm sm:text-base text-[#8e98a8]">
                    Upload files with optional password and instant code
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView('send');
                  }}
                  className="w-full max-w-[200px] py-3.5 px-6 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-base font-medium rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40"
                >
                  Send file
                </button>
              </div>

              {/* Right: Receive Option */}
              <div
                onClick={() => setCurrentView('receive')}
                className="group relative flex flex-col items-center text-center p-8 sm:p-12 rounded-3xl bg-[#141824]/90 hover:bg-[#181f30] border border-[#242c3d] hover:border-emerald-500/50 transition-all duration-300 shadow-2xl hover:shadow-emerald-500/10 cursor-pointer"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 group-hover:border-emerald-500/40 group-hover:scale-110 flex items-center justify-center text-emerald-400 transition-all duration-300 mb-6">
                  <Download className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={1.75} />
                </div>
                <div className="space-y-2 mb-8">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-white group-hover:text-emerald-200 transition-colors">
                    Receive
                  </h2>
                  <p className="text-sm sm:text-base text-[#8e98a8]">
                    Enter a 6-digit code or scan with camera
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView('receive');
                  }}
                  className="w-full max-w-[200px] py-3.5 px-6 bg-[#1a2333] hover:bg-emerald-600 active:bg-emerald-700 text-slate-100 hover:text-white border border-[#2e3b52] hover:border-emerald-500 text-base font-medium rounded-xl transition-all shadow-lg"
                >
                  Receive file
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN 2 / SEND VIEW: Upload Dropzone -> Progress & QR Screen        */}
        {/* ==================================================================== */}
        {currentView === 'send' && (
          <div className="w-full max-w-2xl animate-fade-in flex flex-col items-center">
            {isUploading || senderResult ? (
              <div className="w-full">
                {senderError && (
                  <div className="w-full max-w-md mx-auto mb-4">
                    <Alert
                      type="error"
                      title="Upload Error"
                      message={senderError}
                      onClose={() => setSenderError(null)}
                    />
                  </div>
                )}

                <ShareSuccessModal
                  shareData={senderResult}
                  uploadFiles={senderFiles}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                  onReset={handleResetSender}
                  onGoHome={handleGoHome}
                />
              </div>
            ) : (
              <div className="w-full bg-[#141824] border border-[#242c3d] rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl">
                {senderError && (
                  <Alert
                    type="error"
                    title="Upload Error"
                    message={senderError}
                    onClose={() => setSenderError(null)}
                  />
                )}

                <FileDropzone
                  files={senderFiles}
                  onFilesChange={setSenderFiles}
                  onStartUpload={handleStartUpload}
                  isUploading={isUploading}
                  onGoHome={handleGoHome}
                />
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* RECEIVE VIEW: 6-DIGIT CODE, CAMERA SCAN, PASSWORD UNLOCK             */}
        {/* ==================================================================== */}
        {currentView === 'receive' && (
          <div className="w-full max-w-xl animate-fade-in">
            {receivedShare ? (
              <div className="bg-[#141824] border border-[#242c3d] rounded-3xl p-6 sm:p-10 shadow-2xl">
                <FileDownloadList
                  shareData={receivedShare}
                  onReset={handleResetReceiver}
                  onGoHome={handleGoHome}
                />
              </div>
            ) : pendingPasswordCode ? (
              <div className="bg-[#141824] border border-[#242c3d] rounded-3xl p-6 sm:p-10 shadow-2xl">
                <PasswordUnlockModal
                  code={pendingPasswordCode}
                  onUnlock={(pwd) => handleLookupCode(pendingPasswordCode, pwd)}
                  onCancel={handleResetReceiver}
                  isLoading={isLookingUp}
                  errorMessage={receiverError}
                />
              </div>
            ) : (
              <div className="bg-[#141824] border border-[#242c3d] rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-[#242c3d]">
                  <button
                    onClick={handleGoHome}
                    className="inline-flex items-center gap-2 text-sm text-[#8a92a5] hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Home</span>
                  </button>
                  <span className="text-xs font-medium uppercase tracking-wider text-[#8a92a5]">Receive Files</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-semibold text-white">Receive Files</h2>
                  <p className="text-sm text-[#8a92a5]">
                    Enter a 6-digit share code or scan a QR code to download files.
                  </p>
                </div>

                {/* Sub-mode toggle */}
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#0b0f1a] border border-[#242c3d] rounded-xl">
                  <button
                    onClick={() => {
                      setReceiveMode('code');
                      setReceiverError(null);
                    }}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      receiveMode === 'code'
                        ? 'bg-[#1a202c] text-white shadow-sm'
                        : 'text-[#8a92a5] hover:text-white'
                    }`}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>6-Digit</span>
                  </button>

                  <button
                    onClick={() => {
                      setReceiveMode('camera');
                      setReceiverError(null);
                    }}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      receiveMode === 'camera'
                        ? 'bg-[#1a202c] text-white shadow-sm'
                        : 'text-[#8a92a5] hover:text-white'
                    }`}
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Camera</span>
                  </button>

                  <button
                    onClick={() => {
                      setReceiveMode('image');
                      setReceiverError(null);
                    }}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      receiveMode === 'image'
                        ? 'bg-[#1a202c] text-white shadow-sm'
                        : 'text-[#8a92a5] hover:text-white'
                    }`}
                  >
                    <ImageIcon className="h-4 w-4" />
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
          </div>
        )}
      </main>
    </div>
  );
}
