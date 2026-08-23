import React from 'react';

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
