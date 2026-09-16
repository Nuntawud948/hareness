import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const ProtectedRoute: React.FC = () => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8 bg-slate-100 dark:bg-gradient-to-b dark:from-slate-950 dark:to-slate-900">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
