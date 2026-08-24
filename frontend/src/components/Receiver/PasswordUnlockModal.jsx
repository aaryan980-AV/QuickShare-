import React, { useState } from 'react';
import { Lock, KeyRound, Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';

export function PasswordUnlockModal({ code, onUnlock, onCancel, isLoading, errorMessage }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.trim().length > 0) {
      onUnlock(password.trim());
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-center">
      <div className="flex items-center justify-between pb-2 border-b border-[#242c3d]">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs text-[#8a92a5] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Enter different code</span>
        </button>
        <span className="text-xs font-semibold text-emerald-400 font-mono">#{code}</span>
      </div>

      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Lock className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Password Protected Transfer</h3>
          <p className="text-xs text-[#8a92a5] mt-1 max-w-xs mx-auto">
            The sender has encrypted this transfer with a password. Please enter the password to access files.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-rose-950/30 border border-rose-800 text-rose-300 text-xs rounded-xl text-left">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="password"
            autoFocus
            placeholder="Enter unlock password or PIN"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full py-3 pl-10 pr-4 bg-[#080b13] border border-[#2e3b52] rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={!password.trim() || isLoading}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
            password.trim() && !isLoading
              ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25'
              : 'bg-[#1a2333] text-slate-500 cursor-not-allowed border border-[#242c3d]'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying Password...</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              <span>Unlock Files</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
