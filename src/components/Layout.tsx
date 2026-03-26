import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Users, Clock, Calculator, LogOut, LayoutDashboard, Settings, CalendarDays, Briefcase, Building2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
    { name: 'الموظفين', href: '/employees', icon: Users },
    { name: 'التوظيف', href: '/recruitment', icon: Briefcase },
    { name: 'سجل البصمة', href: '/attendance', icon: Clock },
    { name: 'الإجازات', href: '/leaves', icon: CalendarDays },
    { name: 'الرواتب', href: '/payroll', icon: Calculator },
    { name: 'الأقسام', href: '/departments', icon: Building2 },
    { name: 'الإعدادات', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex flex-col md:flex-row font-sans">
      {/* Sidebar - Apple Style (Clean, borderless feel, soft active states) */}
      <div className="w-full md:w-64 bg-white/80 backdrop-blur-xl border-l border-slate-200/60 flex-shrink-0 flex flex-col shadow-[rgba(0,0,0,0.02)_0px_0px_20px]">
        <div className="h-20 flex items-center px-8">
          <div className="h-10 w-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <span className="mr-4 text-2xl font-bold text-slate-900 tracking-tight">NexusHR</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="px-4 space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    isActive
                      ? 'bg-blue-50/80 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium',
                    'group flex items-center px-4 py-3 text-sm rounded-2xl transition-all duration-200'
                  )}
                >
                  <item.icon
                    className={cn(
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600',
                      'flex-shrink-0 ml-4 h-5 w-5 transition-colors'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          <div className="flex items-center mb-6 px-2">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-slate-500 font-bold text-lg">
                  {user?.user_metadata?.full_name?.[0] || user?.email?.[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="mr-4 overflow-hidden">
              <p className="text-sm font-bold text-slate-900 truncate">
                {user?.user_metadata?.full_name || 'مدير النظام'}
              </p>
              <p className="text-xs font-medium text-slate-500 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center px-4 py-3 text-sm font-bold text-red-600 rounded-2xl hover:bg-red-50 transition-colors"
          >
            <LogOut className="ml-3 h-5 w-5" />
            تسجيل الخروج
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
