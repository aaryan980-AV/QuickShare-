import React, { useState, useEffect } from 'react';
import { Upload, Download, QrCode, KeyRound, Image as ImageIcon, Lock, Clock, FileText, ArrowLeft, ArrowRight } from 'lucide-react';
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
    <div className="min-h-full flex flex-col justify-between bg-[#0b0f1a] text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Top Header / App Bar */}
      <header className="border-b border-[#1c2333]/70 bg-[#0b0f1a] sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {currentView !== 'home' && (
              <button
                onClick={handleGoHome}
                aria-label="Back to home"
                className="p-1.5 rounded-[8px] bg-[#1c2333] border border-[#2e3650] text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h1 className="text-[17px] font-medium text-white tracking-tight">
              QuickShare
            </h1>
          </div>

          <span className="text-[11px] font-medium text-[#8b93a7] px-2.5 py-0.5 rounded-[6px] bg-[#141a29] border border-[#262f45]">
            {currentView === 'home' && 'v1.0'}
            {currentView === 'send' && 'Send'}
            {currentView === 'receive' && 'Receive'}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
        {/* ==================================================================== */}
        {/* SCREEN 1 — HOME: SPLIT SEND / RECEIVE                                */}
        {/* ==================================================================== */}
        {currentView === 'home' && (
          <div className="space-y-6 animate-fade-in w-full">
            {/* App name "QuickShare" centered at top, white text, 17px, medium weight */}
            <div className="text-center">
              <h2 className="text-[17px] font-medium text-white">
                QuickShare
              </h2>
            </div>

            {/* Two cards side by side (stack vertically only below ~480px width) */}
            <div className="flex flex-col xs:flex-row gap-[10px]">
              {/* SEND card */}
              <div
                onClick={() => setCurrentView('send')}
                className="flex-1 bg-[#16234a] rounded-[14px] p-5 flex flex-col items-center justify-between text-center space-y-4 cursor-pointer transition-opacity hover:opacity-95"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setCurrentView('send')}
                aria-label="Send files"
              >
                <div className="flex flex-col items-center space-y-2">
                  {/* Icon: upload arrow icon, light blue #5b8def, 22px, centered */}
                  <div className="flex items-center justify-center">
                    <Upload className="w-[22px] h-[22px] text-[#5b8def]" />
                  </div>
                  {/* Label "Send" — white, 14px, medium weight, centered */}
                  <h3 className="text-[14px] font-medium text-white">
                    Send
                  </h3>
                  {/* Subtext "Upload and get a code" — light blue-gray #8ea4d1, 11px, centered */}
                  <p className="text-[11px] text-[#8ea4d1]">
                    Upload and get a code
                  </p>
                </div>

                {/* Small "Start" button below, transparent background, 1px border in a slightly lighter blue, white text, 8px border-radius */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView('send');
                  }}
                  className="px-4 py-1.5 bg-transparent border border-[#2c4485] hover:border-[#5b8def] text-white text-[12px] font-medium rounded-[8px] transition-colors"
                >
                  Start
                </button>
              </div>

              {/* RECEIVE card */}
              <div
                onClick={() => setCurrentView('receive')}
                className="flex-1 bg-[#16302a] rounded-[14px] p-5 flex flex-col items-center justify-between text-center space-y-4 cursor-pointer transition-opacity hover:opacity-95"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setCurrentView('receive')}
                aria-label="Receive files"
              >
                <div className="flex flex-col items-center space-y-2">
                  {/* Icon: download arrow icon, light green #4ade80, 22px, centered */}
                  <div className="flex items-center justify-center">
                    <Download className="w-[22px] h-[22px] text-[#4ade80]" />
                  </div>
                  {/* Label "Receive" — white, 14px, medium weight, centered */}
                  <h3 className="text-[14px] font-medium text-white">
                    Receive
                  </h3>
                  {/* Subtext "Enter a code or scan" — light green-gray #8fc9a8, 11px, centered */}
                  <p className="text-[11px] text-[#8fc9a8]">
                    Enter a code or scan
                  </p>
                </div>

                {/* Small "Start" button below, transparent background, 1px border in a slightly lighter green, white text, 8px border-radius */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView('receive');
                  }}
                  className="px-4 py-1.5 bg-transparent border border-[#2e5c4a] hover:border-[#4ade80] text-white text-[12px] font-medium rounded-[8px] transition-colors"
                >
                  Start
                </button>
              </div>
            </div>

            {/* Below the two cards, a centered row of trust indicators in muted gray (#8b93a7), 11px text, ~16px gap between items */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#8b93a7]">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Encrypted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Auto-expires</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Up to {formatBytes(MAX_TOTAL_SIZE, 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCREEN 2 — POST-UPLOAD: PROGRESS + QR + CODE (OR UPLOAD DROPZONE)     */}
        {/* ==================================================================== */}
        {currentView === 'send' && (
          <div className="w-full animate-fade-in">
            {senderResult ? (
              <ShareSuccessModal
                shareData={senderResult}
                onReset={handleResetSender}
                onGoHome={handleGoHome}
              />
            ) : isUploading ? (
              <div className="space-y-4">
                <UploadProgress
                  progress={uploadProgress}
                  files={senderFiles}
                  currentStep={uploadStep}
                />
              </div>
            ) : (
              <div className="bg-[#141a29] border border-[#262f45] rounded-[14px] p-6 sm:p-8 space-y-5">
                {senderError && (
                  <Alert
                    type="error"
                    title="Upload Failed"
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
        {/* RECEIVE VIEW: CODE INPUT, QR SCANNER, IMAGE DECODER                  */}
        {/* ==================================================================== */}
        {currentView === 'receive' && (
          <div className="w-full animate-fade-in">
            {receivedShare ? (
              <div className="bg-[#141a29] border border-[#262f45] rounded-[14px] p-6 sm:p-8">
                <FileDownloadList
                  shareData={receivedShare}
                  onReset={handleResetReceiver}
                  onGoHome={handleGoHome}
                />
              </div>
            ) : (
              <div className="bg-[#141a29] border border-[#262f45] rounded-[14px] p-6 sm:p-8 space-y-6">
                {/* Header with Back button */}
                <div className="flex items-center justify-between pb-1">
                  <button
                    onClick={handleGoHome}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8b93a7] hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Home</span>
                  </button>
                  <span className="text-xs text-[#8b93a7]">Receive Files</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-[16px] font-medium text-white">Receive Files</h2>
                  <p className="text-xs text-[#8b93a7]">
                    Enter a 6-digit share code or scan a QR code to download files.
                  </p>
                </div>

                {/* Receiver Sub-Mode Toggle */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0b0f1a] border border-[#262f45] rounded-[10px]">
                  <button
                    onClick={() => {
                      setReceiveMode('code');
                      setReceiverError(null);
                    }}
                    className={`py-2 px-2 text-xs font-medium rounded-[8px] flex items-center justify-center gap-1.5 transition-colors ${
                      receiveMode === 'code'
                        ? 'bg-[#1c2333] text-white'
                        : 'text-[#8b93a7] hover:text-white'
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
                        ? 'bg-[#1c2333] text-white'
                        : 'text-[#8b93a7] hover:text-white'
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
                        ? 'bg-[#1c2333] text-white'
                        : 'text-[#8b93a7] hover:text-white'
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
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1c2333]/50 bg-[#0b0f1a] py-4 text-center text-[11px] text-[#8b93a7]">
        <p>QuickShare &middot; Peer-to-peer cloud transfer</p>
      </footer>
    </div>
  );
}
