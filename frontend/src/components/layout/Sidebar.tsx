import React from 'react';
import { NavLink } from 'react-router-dom';
import { KeyRound, Radio, MessageSquareText, BellRing, BarChart3 } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/keys', label: 'LLM Providers & Keys', icon: KeyRound, desc: 'API keys & Model routing' },
    { to: '/channels', label: 'Bot Channel Settings', icon: Radio, desc: 'LINE & Telegram credentials' },
    { to: '/prompts', label: 'System Persona', icon: MessageSquareText, desc: 'Bot instructions & Prompts' },
    { to: '/push', label: 'Push Message Watcher', icon: BellRing, desc: 'Real-time SSE live feed' },
    { to: '/usage', label: 'Usage & Cost Analytics', icon: BarChart3, desc: 'Token logs & cost estimations' },
  ];

  return (
    <aside className="w-64 bg-slate-50 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 space-y-2 select-none transition-colors">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 pt-2 pb-1">
        Management
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-start space-x-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-950/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 border border-transparent'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">{item.desc}</div>
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800/80 px-3">
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Harness Standalone</span>
          <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
