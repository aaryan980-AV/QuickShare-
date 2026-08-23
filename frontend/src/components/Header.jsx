import React from 'react';
import { Zap, ArrowLeft } from 'lucide-react';

export function Header({ currentView, onGoHome }) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950 sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentView !== 'home' ? (
            <button
              onClick={onGoHome}
              aria-label="Back to home"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="h-4 w-4" />
            </div>
          )}

          <button
            onClick={onGoHome}
            className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">QuickShare</h1>
            </div>
            <p className="text-[11px] text-slate-400">Instant file transfer</p>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            {currentView === 'home' && 'Direct P2P Cloud'}
            {currentView === 'send' && 'Send Mode'}
            {currentView === 'receive' && 'Receive Mode'}
          </span>
        </div>
      </div>
    </header>
  );
}
