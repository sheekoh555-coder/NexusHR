import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function ConnectionGuard({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkConnection();
    
    const handleOnline = () => checkConnection();
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      // Simple ping to check connection
      const { error } = await supabase.from('system_settings').select('id').limit(1);
      if (error && error.message.includes('Failed to fetch')) {
        setIsOnline(false);
      } else {
        setIsOnline(true);
      }
    } catch (err) {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <WifiOff className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">انقطع الاتصال بالخادم</h2>
          <p className="text-slate-500 mb-8">
            يبدو أن هناك مشكلة في الاتصال بقاعدة البيانات (Supabase) أو أنك غير متصل بالإنترنت.
          </p>
          <button
            onClick={checkConnection}
            disabled={isChecking}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'جاري التحقق...' : 'إعادة الاتصال'}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
