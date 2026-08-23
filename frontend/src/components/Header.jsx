import React from 'react';
import { Zap, ShieldCheck, Cloud } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-lg shadow-brand-500/20 flex items-center justify-center">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Zap className="h-5 w-5 text-brand-400 fill-brand-400/20" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">QuickShare</h1>
              <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full">
                Vercel Services
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Persistent, Direct Cloud File Sharing</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <Cloud className="h-3.5 w-3.5 text-brand-400" />
            <span className="hidden md:inline">Persistent Vercel Blob</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden md:inline">24h Auto-Expiry</span>
          </div>
        </div>
      </div>
    </header>
  );
}
