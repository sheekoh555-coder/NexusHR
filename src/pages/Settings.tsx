import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SystemSettings } from '../types';
import { Settings as SettingsIcon, Clock, Percent, Save, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState<SystemSettings>({
    id: 1,
    work_start_time: '08:00',
    work_end_time: '16:00',
    ramadan_start_time: '08:00',
    ramadan_end_time: '14:00',
    social_insurance_pct: 11,
    tax_pct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }

      if (data) {
        // Format times to HH:mm
        setSettings({
          ...data,
          work_start_time: data.work_start_time?.substring(0, 5) || '08:00',
          work_end_time: data.work_end_time?.substring(0, 5) || '16:00',
          ramadan_start_time: data.ramadan_start_time?.substring(0, 5) || '08:00',
          ramadan_end_time: data.ramadan_end_time?.substring(0, 5) || '14:00',
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('خطأ في جلب الإعدادات ❌');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          id: 1,
          work_start_time: `${settings.work_start_time}:00`,
          work_end_time: `${settings.work_end_time}:00`,
          ramadan_start_time: `${settings.ramadan_start_time}:00`,
          ramadan_end_time: `${settings.ramadan_end_time}:00`,
          social_insurance_pct: settings.social_insurance_pct,
          tax_pct: settings.tax_pct,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('تم حفظ الإعدادات بنجاح ✅');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('خطأ في حفظ الإعدادات ❌');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">جاري تحميل الإعدادات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">الإعدادات العامة</h1>
          <p className="mt-2 text-base text-slate-500">تكوين قواعد الشركة المالية ومواعيد العمل.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Company Rules */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">مواعيد العمل</h2>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">الأيام العادية</h3>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">وقت الحضور (Start Time)</label>
                <input
                  type="time"
                  name="work_start_time"
                  value={settings.work_start_time}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">وقت الانصراف (End Time)</label>
                <input
                  type="time"
                  name="work_end_time"
                  value={settings.work_end_time}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 border-b border-amber-100 pb-2">شهر رمضان</h3>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">وقت الحضور (Ramadan Start)</label>
                <input
                  type="time"
                  name="ramadan_start_time"
                  value={settings.ramadan_start_time}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">وقت الانصراف (Ramadan End)</label>
                <input
                  type="time"
                  name="ramadan_end_time"
                  value={settings.ramadan_end_time}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financial Rules */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
              <Percent className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">القواعد المالية</h2>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">نسبة التأمينات الاجتماعية (%)</label>
              <div className="relative">
                <input
                  type="number"
                  name="social_insurance_pct"
                  value={settings.social_insurance_pct}
                  onChange={handleChange}
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm bg-slate-50 focus:bg-white font-mono text-left"
                  dir="ltr"
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold">%</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">النسبة الافتراضية هي 11%</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">نسبة الضرائب (%)</label>
              <div className="relative">
                <input
                  type="number"
                  name="tax_pct"
                  value={settings.tax_pct}
                  onChange={handleChange}
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm bg-slate-50 focus:bg-white font-mono text-left"
                  dir="ltr"
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold">%</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">نسبة الضريبة الثابتة (يمكن تطويرها لشرائح لاحقاً)</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-8 py-3.5 border border-transparent text-base font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
          >
            {saving ? (
              'جاري الحفظ...'
            ) : (
              <>
                <Save className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
                حفظ الإعدادات
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
