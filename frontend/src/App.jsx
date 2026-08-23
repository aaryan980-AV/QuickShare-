import React, { useState, useEffect } from 'react';
import { Upload, Download, QrCode, KeyRound, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { Alert } from './components/UI/Alert';
import { FileDropzone } from './components/Sender/FileDropzone';
import { ShareSuccessModal } from './components/Sender/ShareSuccessModal';
import { CodeInput } from './components/Receiver/CodeInput';
import { CameraScanner } from './components/Receiver/CameraScanner';
import { ImageScanner } from './components/Receiver/ImageScanner';
import { FileDownloadList } from './components/Receiver/FileDownloadList';
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

  // Upload pipeline: upload directly to Blob or local dev fallback, then register share
  const handleStartUpload = async () => {
    if (senderFiles.length === 0) return;
    setIsUploading(true);
    setSenderError(null);
    setSenderResult(null);
    setUploadProgress({ percentage: 0, loaded: 0, total: 0, completedFiles: 0 });

    try {
      // Step 1: Upload to Blob / Local storage
      const uploadedBlobs = await uploadFilesBatch(senderFiles, {
        concurrency: 3,
        onTotalProgress: (prog) => {
          setUploadProgress(prog);
        },
      });

      // Step 2: Register batch and generate 6-digit code & server-side QR
      const shareData = await createShareBatch(uploadedBlobs);

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
    <div className="min-h-full flex flex-col justify-between bg-[#0b0f1a] text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col justify-center items-center">
        {/* ==================================================================== */}
        {/* SCREEN 1 — FRONT PAGE (Exact Image 1 Layout)                         */}
        {/* ==================================================================== */}
        {currentView === 'home' && (
          <div className="w-full space-y-12 animate-fade-in">
            {/* Centered App Title */}
            <div className="text-center">
              <h1 className="text-[20px] font-semibold text-white tracking-tight">
                QuickShare
              </h1>
            </div>

            {/* Two Side-by-Side Options: Send and Receive */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8 max-w-md mx-auto">
              {/* Left: Send Option */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div
                  onClick={() => setCurrentView('send')}
                  className="cursor-pointer p-2 hover:opacity-80 transition-opacity"
                >
                  <Upload className="w-7 h-7 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-[16px] font-medium text-white">Send</h2>
                  <p className="text-[12px] text-[#8e98a8] mt-0.5">Upload and get a code</p>
                </div>
                <button
                  onClick={() => setCurrentView('send')}
                  className="w-full max-w-[140px] py-2 px-4 bg-transparent hover:bg-slate-800/40 border border-[#333d4e] hover:border-slate-500 text-white text-[13px] font-normal rounded-[12px] transition-colors"
                >
                  Send file
                </button>
              </div>

              {/* Right: Receive Option */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div
                  onClick={() => setCurrentView('receive')}
                  className="cursor-pointer p-2 hover:opacity-80 transition-opacity"
                >
                  <Download className="w-7 h-7 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-[16px] font-medium text-white">Receive</h2>
                  <p className="text-[12px] text-[#8e98a8] mt-0.5">Enter a code or scan</p>
                </div>
                <button
                  onClick={() => setCurrentView('receive')}
                  className="w-full max-w-[140px] py-2 px-4 bg-transparent hover:bg-slate-800/40 border border-[#333d4e] hover:border-slate-500 text-white text-[13px] font-normal rounded-[12px] transition-colors"
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
          <div className="w-full animate-fade-in flex flex-col items-center">
            {/* If upload completed or currently uploading, show Screen 2 (Image 2) */}
            {isUploading || senderResult ? (
              <div className="w-full">
                {senderError && (
                  <div className="w-full max-w-sm mx-auto mb-4">
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
              /* Before starting upload: show clean Send / Dropzone screen */
              <div className="w-full max-w-lg bg-[#141824] border border-[#242c3d] rounded-[18px] p-6 sm:p-8 space-y-5">
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
        {/* RECEIVE VIEW: 6-DIGIT CODE, CAMERA SCAN, QR IMAGE                    */}
        {/* ==================================================================== */}
        {currentView === 'receive' && (
          <div className="w-full max-w-md animate-fade-in">
            {receivedShare ? (
              <div className="bg-[#141824] border border-[#242c3d] rounded-[18px] p-6 sm:p-8">
                <FileDownloadList
                  shareData={receivedShare}
                  onReset={handleResetReceiver}
                  onGoHome={handleGoHome}
                />
              </div>
            ) : (
              <div className="bg-[#141824] border border-[#242c3d] rounded-[18px] p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between pb-1">
                  <button
                    onClick={handleGoHome}
                    className="inline-flex items-center gap-1.5 text-xs text-[#8a92a5] hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Home</span>
                  </button>
                  <span className="text-xs text-[#8a92a5]">Receive Files</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-[17px] font-medium text-white">Receive Files</h2>
                  <p className="text-xs text-[#8a92a5]">
                    Enter a 6-digit share code or scan a QR code.
                  </p>
                </div>

                {/* Sub-mode toggle */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0b0f1a] border border-[#242c3d] rounded-[10px]">
                  <button
                    onClick={() => {
                      setReceiveMode('code');
                      setReceiverError(null);
                    }}
                    className={`py-2 px-2 text-xs font-medium rounded-[8px] flex items-center justify-center gap-1.5 transition-colors ${
                      receiveMode === 'code'
                        ? 'bg-[#1a202c] text-white'
                        : 'text-[#8a92a5] hover:text-white'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>6-Digit</span>
                  </button>

                  <button
                    onClick={() => {
                      setReceiveMode('camera');
                      setReceiverError(null);
                    }}
                    className={`py-2 px-2 text-xs font-medium rounded-[8px] flex items-center justify-center gap-1.5 transition-colors ${
                      receiveMode === 'camera'
                        ? 'bg-[#1a202c] text-white'
                        : 'text-[#8a92a5] hover:text-white'
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Camera</span>
                  </button>

                  <button
                    onClick={() => {
                      setReceiveMode('image');
                      setReceiverError(null);
                    }}
                    className={`py-2 px-2 text-xs font-medium rounded-[8px] flex items-center justify-center gap-1.5 transition-colors ${
                      receiveMode === 'image'
                        ? 'bg-[#1a202c] text-white'
                        : 'text-[#8a92a5] hover:text-white'
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
