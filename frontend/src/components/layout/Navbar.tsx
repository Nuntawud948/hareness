import React from 'react';
import { LogOut, ShieldCheck, Cpu, Moon, Sun } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';

export const Navbar: React.FC = () => {
  const user = authService.getCurrentUser();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/20">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Harness Router
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Clean Arch
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Multi-LLM LINE & Telegram Manager</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Dark / Light Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 text-xs font-medium"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>

        <div className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span className="font-medium">{user?.username || 'Admin'}</span>
        </div>

        <button
          onClick={() => authService.logout()}
          className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-slate-100 dark:bg-slate-800/40 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-red-500/30 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};
