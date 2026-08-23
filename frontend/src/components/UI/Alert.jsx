import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

export function Alert({ type = 'info', message, title, onClose, className = '' }) {
  if (!message) return null;

  const styles = {
    info: {
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
      icon: Info,
      iconColor: 'text-blue-400',
    },
    success: {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      icon: AlertCircle,
      iconColor: 'text-amber-400',
    },
    error: {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      icon: XCircle,
      iconColor: 'text-rose-400',
    },
  };

  const style = styles[type] || styles.info;
  const Icon = style.icon;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${style.bg} ${className} animate-fade-in`}>
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 text-sm">
        {title && <h4 className="font-semibold mb-0.5">{title}</h4>}
        <p className="leading-relaxed opacity-95">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded hover:bg-white/10"
        >
          ?
        </button>
      )}
    </div>
  );
}
