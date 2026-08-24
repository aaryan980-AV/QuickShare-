import React, { useRef, useState } from 'react';
import { UploadCloud, File, Trash2, ArrowLeft, AlertTriangle, ShieldCheck, Lock, Flame, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { formatBytes, getFileTypeInfo } from '../../utils/formatters';

export const MAX_FILE_SIZE = 1024 * 1024 * 1024 * 1024; // 1 TB per file
export const MAX_TOTAL_SIZE = 1024 * 1024 * 1024 * 1024; // 1 TB total batch

const DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.vbs', '.sh', '.ps1', '.msi', '.scr'];

export function FileDropzone({ files, onFilesChange, onStartUpload, isUploading, disabled, onGoHome }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showSecurity, setShowSecurity] = useState(false);
  
  // Security options state
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [expirySeconds, setExpirySeconds] = useState(86400); // default 24h

  const fileInputRef = useRef(null);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const isOverLimit = totalSize > MAX_TOTAL_SIZE;

  // Check if any file contains potentially dangerous script/executable extensions
  const hasDangerousFiles = files.some((f) =>
    DANGEROUS_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    if (disabled || isUploading) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const processFiles = (newFiles) => {
    setErrorMsg(null);
    const valid = [];
    let oversizedNames = [];

    for (const f of newFiles) {
      if (f.size > MAX_FILE_SIZE) {
        oversizedNames.push(`${f.name} (${formatBytes(f.size)})`);
      } else {
        if (!files.some((existing) => existing.name === f.name && existing.size === f.size)) {
          valid.push(f);
        }
      }
    }

    if (oversizedNames.length > 0) {
      setErrorMsg(`These files exceed the 1TB single-file limit: ${oversizedNames.join(', ')}`);
    }

    if (valid.length > 0) {
      onFilesChange([...files, ...valid]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  const clearAll = () => {
    onFilesChange([]);
    setErrorMsg(null);
  };

  const handleSubmit = () => {
    onStartUpload({
      password: enablePassword && password.trim().length > 0 ? password.trim() : null,
      selfDestruct,
      expirySeconds,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header with Back to Home */}
      <div className="flex items-center justify-between pb-1 border-b border-[#242c3d]">
        <button
          onClick={onGoHome}
          className="inline-flex items-center gap-1.5 text-xs text-[#8a92a5] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8a92a5]">Send Files</span>
      </div>

      {/* Dropzone area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-[20px] p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
            : 'border-[#242c3d] hover:border-blue-500/50 bg-[#0b0f1a]'
        } ${isUploading || disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled || isUploading}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <UploadCloud className="h-8 w-8" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              Choose files or drag & drop here
            </p>
            <p className="text-xs text-[#8a92a5] mt-1">
              Up to 1 TB per file &middot; High-Speed Chunked Streaming &middot; SHA-256 Protected
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-rose-950/30 border border-rose-800 text-rose-300 text-xs rounded-xl">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {hasDangerousFiles && (
        <div className="flex items-center gap-2 p-3 bg-amber-950/30 border border-amber-800 text-amber-300 text-xs rounded-xl">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Notice: Executable or script files detected. They will be transferred as raw byte attachments safely.</span>
        </div>
      )}

      {/* Selected files list */}
      {files.length > 0 && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between text-xs text-[#8a92a5] px-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-200">{files.length} file{files.length > 1 ? 's' : ''}</span>
              <span>&middot;</span>
              <span className={isOverLimit ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                {formatBytes(totalSize)} / 1 TB
              </span>
            </div>
            {!isUploading && (
              <button
                onClick={clearAll}
                className="text-[#8a92a5] hover:text-rose-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {files.map((file, index) => {
              const fileType = getFileTypeInfo(file.name, file.type);
              return (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#0b0f1a] border border-[#242c3d] hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`p-2 rounded-lg border text-xs font-semibold ${fileType.color}`}>
                      <File className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-[#8a92a5]">{formatBytes(file.size)}</p>
                    </div>
                  </div>

                  {!isUploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="p-1.5 text-[#8a92a5] hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Remove file"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Security Options Accordion */}
          <div className="border border-[#242c3d] bg-[#0d121f] rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSecurity(!showSecurity)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Security & Transfer Options</span>
                {(enablePassword || selfDestruct || expirySeconds !== 86400) && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                    Active
                  </span>
                )}
              </div>
              {showSecurity ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showSecurity && (
              <div className="p-4 pt-2 border-t border-[#242c3d] space-y-4 text-xs">
                {/* Password Protection */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="flex items-center gap-2 text-slate-200 font-medium">
                      <Lock className="h-3.5 w-3.5 text-blue-400" />
                      Password / PIN Protection
                    </span>
                    <input
                      type="checkbox"
                      checked={enablePassword}
                      onChange={(e) => setEnablePassword(e.target.checked)}
                      className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </label>
                  {enablePassword && (
                    <input
                      type="password"
                      placeholder="Enter secret password or PIN"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full py-2 px-3 bg-[#080b13] border border-[#2e3b52] rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>

                {/* Self-Destruct */}
                <div className="pt-2 border-t border-[#1e2738]">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="space-y-0.5">
                      <span className="flex items-center gap-2 text-slate-200 font-medium">
                        <Flame className="h-3.5 w-3.5 text-rose-400" />
                        Self-Destruct after First Download
                      </span>
                      <p className="text-[11px] text-[#8a92a5]">
                        Files will be permanently deleted immediately once downloaded
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selfDestruct}
                      onChange={(e) => setSelfDestruct(e.target.checked)}
                      className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Expiry Selector */}
                <div className="pt-2 border-t border-[#1e2738] space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-200 font-medium">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <span>Auto-Expiration Time</span>
                  </div>
                  <select
                    value={expirySeconds}
                    onChange={(e) => setExpirySeconds(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-[#080b13] border border-[#2e3b52] rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value={600}>10 Minutes</option>
                    <option value={3600}>1 Hour</option>
                    <option value={86400}>24 Hours (Default)</option>
                    <option value={604800}>7 Days</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-[#1e2738] flex items-center gap-2 text-[11px] text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Client-side SHA-256 integrity checksums computed automatically.</span>
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="pt-2">
            <button
              onClick={handleSubmit}
              disabled={isUploading || isOverLimit || files.length === 0 || (enablePassword && !password.trim())}
              className={`w-full py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                isOverLimit || (enablePassword && !password.trim())
                  ? 'bg-rose-900/50 text-rose-300 border border-rose-800 cursor-not-allowed'
                  : files.length > 0 && !isUploading
                  ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-[#1c2230] text-slate-500 cursor-not-allowed'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {isOverLimit
                  ? 'Batch Exceeds 1 TB Limit'
                  : enablePassword && !password.trim()
                  ? 'Please set a password'
                  : `Secure Upload (${files.length} File${files.length > 1 ? 's' : ''})`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
