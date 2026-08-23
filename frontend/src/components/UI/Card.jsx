import React from 'react';

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl shadow-black/40 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
