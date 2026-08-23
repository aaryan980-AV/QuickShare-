import React, { useState, useEffect } from 'react';
import { Upload, Download, QrCode, KeyRound, Image as ImageIcon, Sparkles, Shield, AlertCircle } from 'lucide-react';
import { Header } from './components/Header';
import { Card } from './components/UI/Card';
import { Tabs } from './components/UI/Tabs';
import { Alert } from './components/UI/Alert';
import { FileDropzone } from './components/Sender/FileDropzone';
import { UploadProgress } from './components/Sender/UploadProgress';
import { ShareSuccessModal } from './components/Sender/ShareSuccessModal';
import { CodeInput } from './components/Receiver/CodeInput';
import { CameraScanner } from './components/Receiver/CameraScanner';
import { ImageScanner } from './components/Receiver/ImageScanner';
import { FileDownloadList } from './components/Receiver/FileDownloadList';
import { uploadFilesBatch } from './services/blobUpload';
import { createShareBatch, getShareByCode } from './services/api';

export function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState('send'); // 'send' | 'receive'
  const [receiveMode, setReceiveMode] = useState('code'); // 'code' | 'camera' | 'image'

  // Sender state
  const [senderFiles, setSenderFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ percentage: 0, loaded: 0, total: 0, completedFiles: 0 });
  const [uploadStep, setUploadStep] = useState('blob'); // 'blob' | 'code' | 'finalizing'
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
      setActiveTab('receive');
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
    <div className="min-h-full flex flex-col justify-between">
      <Header />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-12">
        {/* Main Tab Navigation */}
        <Tabs
          tabs={[
            { id: 'send', label: 'Send Files', icon: Upload },
            { id: 'receive', label: 'Receive Files', icon: Download },
          ]}
          activeTab={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setReceiverError(null);
            setSenderError(null);
          }}
        />

        {/* SEND TAB */}
        {activeTab === 'send' && (
          <Card className="animate-fade-in">
            {senderResult ? (
              <ShareSuccessModal shareData={senderResult} onReset={handleResetSender} />
            ) : (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white tracking-tight">Upload & Share</h2>
                  <p className="text-xs text-slate-400">
                    Files are securely stored in persistent cloud storage with 24-hour auto-expiration.
                  </p>
                </div>

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
                  />
                )}
              </div>
            )}
          </Card>
        )}

        {/* RECEIVE TAB */}
        {activeTab === 'receive' && (
          <Card className="animate-fade-in">
            {receivedShare ? (
              <FileDownloadList shareData={receivedShare} onReset={handleResetReceiver} />
            ) : (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white tracking-tight">Receive Files</h2>
                  <p className="text-xs text-slate-400">
                    Enter a 6-digit share code or scan a QuickShare QR code to download files.
                  </p>
                </div>

                {/* Receiver Sub-Mode Toggle */}
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    onClick={() => {
                      setReceiveMode('code');
                      setReceiverError(null);
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      receiveMode === 'code'
                        ? 'bg-slate-800 text-white shadow-sm'
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
                    className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      receiveMode === 'camera'
                        ? 'bg-slate-800 text-white shadow-sm'
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
                    className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      receiveMode === 'image'
                        ? 'bg-slate-800 text-white shadow-sm'
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

        {/* Feature Highlights */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <div className="h-8 w-8 mx-auto mb-2 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Chunked Direct Uploads</h4>
            <p className="text-[11px] text-slate-500 mt-1">Up to 1000MB per batch with parallel streams</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <div className="h-8 w-8 mx-auto mb-2 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <QrCode className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Instant QR & 6-Digit</h4>
            <p className="text-[11px] text-slate-500 mt-1">Scan camera, upload QR image, or type code</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <div className="h-8 w-8 mx-auto mb-2 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Shield className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-200">24-Hour Expiration</h4>
            <p className="text-[11px] text-slate-500 mt-1">Rate-limited lookups and auto-cleanup</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>QuickShare &bull; Built on Vercel Services (Vite + Express + Vercel Blob & KV)</p>
      </footer>
    </div>
  );
}
