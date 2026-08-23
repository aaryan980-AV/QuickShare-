import React from 'react';

export function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex p-1.5 bg-slate-900/90 border border-slate-800 rounded-xl max-w-md mx-auto mb-8 shadow-inner">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-brand-600 to-emerald-600 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {Icon && <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
