import React, { useRef, useState } from 'react';
import { UploadCloud, File, Trash2, Plus, Sparkles, AlertTriangle } from 'lucide-react';
import { formatBytes, getFileTypeInfo } from '../../utils/formatters';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB per file
const MAX_TOTAL_SIZE = 1000 * 1024 * 1024; // 1000MB total

export function FileDropzone({ files, onFilesChange, onStartUpload, isUploading, disabled }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const isOverLimit = totalSize > MAX_TOTAL_SIZE;

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
        // Prevent duplicate file references
        if (!files.some((existing) => existing.name === f.name && existing.size === f.size)) {
          valid.push(f);
        }
      }
    }

    if (oversizedNames.length > 0) {
      setErrorMsg(`These files exceed the 500MB single-file limit: ${oversizedNames.join(', ')}`);
    }

    if (valid.length > 0) {
      const combined = [...files, ...valid];
      onFilesChange(combined);
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

  return (
    <div className="space-y-4">
      {/* Dropzone area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
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
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-500/20 to-emerald-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <UploadCloud className="h-8 w-8 animate-pulse-subtle" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              Drag and drop photos, videos, or files here
            </p>
            <p className="text-xs text-slate-400 mt-1">
              or <span className="text-brand-400 font-medium hover:underline">browse from device</span> &bull; Up to 500MB per file (1GB batch)
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Selected files list */}
      {files.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">{files.length} file{files.length > 1 ? 's' : ''}</span>
              <span>&bull;</span>
              <span className={isOverLimit ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                {formatBytes(totalSize)} / 1GB
              </span>
            </div>
            {!isUploading && (
              <button
                onClick={clearAll}
                className="text-slate-400 hover:text-rose-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {files.map((file, index) => {
              const fileType = getFileTypeInfo(file.name, file.type);
              return (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`p-2 rounded-lg border text-xs font-semibold ${fileType.color}`}>
                      <File className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                    </div>
                  </div>

                  {!isUploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              onClick={onStartUpload}
              disabled={isUploading || isOverLimit || files.length === 0}
              className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-200 ${
                isOverLimit
                  ? 'bg-rose-600/50 text-rose-200 cursor-not-allowed'
                  : files.length > 0 && !isUploading
                  ? 'bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-600 hover:to-emerald-600 text-white shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.01]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {isOverLimit
                  ? 'Batch Exceeds 1000MB Limit'
                  : `Upload & Generate Share Code (${files.length} File${files.length > 1 ? 's' : ''})`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
