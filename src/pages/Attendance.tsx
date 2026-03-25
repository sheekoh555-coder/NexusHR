import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Plus, Upload, FileSpreadsheet, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { SystemSettings } from '../types';
import AttendanceImporter from '../components/AttendanceImporter';

export default function Attendance() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Manual Entry State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [manualEmpId, setManualEmpId] = useState('');
  const [manualFirstPunch, setManualFirstPunch] = useState('');
  const [manualLastPunch, setManualLastPunch] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchAttendance();
  }, [date]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*').eq('id', 1).single();
      if (data) {
        setSettings(data as SystemSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles (full_name, department)
        `)
        .eq('date', date)
        .order('employee_id');

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (first: string, last: string, isRamadan: boolean = false) => {
    let late_minutes = 0;
    let total_hours = 0;
    let overtime_minutes = 0;

    let startStr = isRamadan ? '08:00' : '08:00';
    let endStr = isRamadan ? '14:00' : '16:00';
    
    if (settings) {
      startStr = isRamadan ? settings.ramadan_start_time.substring(0, 5) : settings.work_start_time.substring(0, 5);
      endStr = isRamadan ? settings.ramadan_end_time.substring(0, 5) : settings.work_end_time.substring(0, 5);
    }

    const parseTime = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const standardStartMins = parseTime(startStr);
    const standardEndMins = parseTime(endStr);

    if (first) {
      const firstPunchMins = parseTime(first);
      late_minutes = Math.max(0, firstPunchMins - standardStartMins);

      if (last) {
        const lastPunchMins = parseTime(last);
        
        // Total hours (decimal)
        total_hours = Math.max(0, (lastPunchMins - firstPunchMins) / 60);

        // Overtime
        overtime_minutes = Math.max(0, lastPunchMins - standardEndMins);
      }
    }

    return { late_minutes, total_hours, overtime_minutes };
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { late_minutes, total_hours, overtime_minutes } = calculateMetrics(manualFirstPunch, manualLastPunch);

      const { error } = await supabase
        .from('attendance')
        .upsert({
          employee_id: manualEmpId,
          date: date,
          first_punch: manualFirstPunch || null,
          last_punch: manualLastPunch || null,
          total_hours,
          late_minutes,
          overtime_minutes
        }, { onConflict: 'employee_id, date' });

      if (error) throw error;

      setShowAddModal(false);
      setManualEmpId('');
      setManualFirstPunch('');
      setManualLastPunch('');
      fetchAttendance();
      toast.success('تم حفظ البيانات بنجاح ✅');
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('خطأ في الربط ❌');
    } finally {
      setSaving(false);
    }
  };

  const generateMonthlyReport = async () => {
    setGeneratingReport(true);
    try {
      const monthStr = date.substring(0, 7); // YYYY-MM
      
      // Fetch all attendance for this month
      const { data: monthLogs, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .like('date', `${monthStr}-%`);

      if (fetchError) throw fetchError;

      if (!monthLogs || monthLogs.length === 0) {
        toast.error('لا توجد سجلات لهذا الشهر لإصدار التقرير');
        setGeneratingReport(false);
        return;
      }

      // Group by employee_id
      const reportMap = new Map<string, any>();

      monthLogs.forEach(log => {
        const empId = log.employee_id;
        if (!reportMap.has(empId)) {
          reportMap.set(empId, {
            employee_id: empId,
            month: monthStr,
            total_work_days: 0,
            total_late_minutes: 0,
            total_absence_days: 0,
            total_mission_days: 0,
            total_overtime_minutes: 0
          });
        }

        const report = reportMap.get(empId);
        const status = log.status || '';

        if (status === 'حاضر' || status === 'مكتمل' || status === 'في العمل' || status === 'تأخير' || status === 'إضافي') {
          report.total_work_days += 1;
        } else if (status === 'غياب' || status === 'غائب') {
          report.total_absence_days += 1;
        } else if (status === 'مأمورية') {
          report.total_mission_days += 1;
        }

        report.total_late_minutes += (log.late_minutes || 0);
        report.total_overtime_minutes += (log.overtime_minutes || 0);
      });

      const reportsToUpsert = Array.from(reportMap.values());

      const { error: upsertError } = await supabase
        .from('monthly_reports')
        .upsert(reportsToUpsert, { onConflict: 'employee_id, month' });

      if (upsertError) throw upsertError;

      toast.success('تم إصدار تقرير الشهر بنجاح ✅');
    } catch (error) {
      console.error('Error generating monthly report:', error);
      toast.error('حدث خطأ أثناء إصدار التقرير ❌');
    } finally {
      setGeneratingReport(false);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '---';
    // If it's just a time string like "09:00:00"
    if (timeString.length <= 8) {
      return timeString.substring(0, 5);
    }
    // If it's an ISO string
    try {
      return format(new Date(timeString), 'HH:mm');
    } catch {
      return timeString;
    }
  };

  if (showImportModal) {
    return (
      <div className="space-y-8">
        <AttendanceImporter 
          onClose={() => setShowImportModal(false)} 
          onSuccess={() => {
            setShowImportModal(false);
            fetchAttendance();
          }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">سجل الحضور والانصراف</h1>
          <p className="mt-2 text-base text-slate-500">متابعة البصمة الأولى والأخيرة للموظفين وإدخال السجلات يدوياً.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
            <CalendarIcon className="h-5 w-5 text-slate-400 ml-3" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-none focus:ring-0 text-sm font-semibold text-slate-700 bg-transparent p-0"
            />
          </div>
          <button
            onClick={generateMonthlyReport}
            disabled={generatingReport}
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all duration-200"
          >
            <FileText className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
            {generatingReport ? 'جاري الإصدار...' : 'إصدار تقرير الشهر'}
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center px-5 py-2.5 border border-slate-200 text-sm font-bold rounded-2xl shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            <FileSpreadsheet className="-mr-1 ml-2 h-5 w-5 text-emerald-600" aria-hidden="true" />
            استيراد Excel
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            <Plus className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
            إدخال يدوي
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  رقم الموظف
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  الاسم
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  القسم
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  التاريخ
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  اليوم
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  حضور
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  انصراف
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  إجمالي الوقت
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-8 py-12 text-center text-slate-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-8 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Clock className="h-10 w-10 text-slate-300 mb-3" />
                      <p>لا توجد سجلات حضور لهذا اليوم.</p>
                      <button onClick={() => setShowAddModal(true)} className="mt-2 text-blue-600 font-medium hover:underline">
                        إضافة سجل يدوي
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const hasFirstPunch = !!log.first_punch;
                  const hasLastPunch = !!log.last_punch;
                  
                  let status = log.status || 'غائب';
                  let statusColor = 'bg-slate-100 text-slate-700 border-slate-200';
                  
                  if (status === 'غائب' || status === 'غياب') {
                    statusColor = 'bg-red-50 text-red-700 border-red-200';
                  } else if (status === 'مكتمل' || status === 'حاضر') {
                    statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (status === 'في العمل') {
                    statusColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  } else if (status === 'تأخير') {
                    statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  } else if (status === 'إضافي') {
                    statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (status === 'راحة' || status === 'OFF') {
                    statusColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  } else if (status === 'مأمورية') {
                    statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (status.includes('إجازة') || status.includes('أجازة')) {
                    statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  const isRamadan = log.notes?.includes('رمضان') || false;
                  
                  let startStr = isRamadan ? '08:00' : '08:00';
                  let endStr = isRamadan ? '14:00' : '16:00';
                  
                  if (settings) {
                    startStr = isRamadan ? settings.ramadan_start_time.substring(0, 5) : settings.work_start_time.substring(0, 5);
                    endStr = isRamadan ? settings.ramadan_end_time.substring(0, 5) : settings.work_end_time.substring(0, 5);
                  }

                  const parseTime = (timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    return h * 60 + m;
                  };

                  const standardStartMins = parseTime(startStr);
                  const standardEndMins = parseTime(endStr);
                  const requiredHours = (standardEndMins - standardStartMins) / 60;
                  
                  let isEarlyDeparture = false;
                  let isShortHours = false;

                  if (log.last_punch) {
                    const lastPunchMins = parseTime(log.last_punch);
                    if (lastPunchMins < standardEndMins) {
                      isEarlyDeparture = true;
                    }
                  }

                  if (log.total_hours && log.total_hours < requiredHours) {
                    isShortHours = true;
                  }

                  let rowClass = "hover:bg-slate-50/80 transition-colors duration-150";
                  if (status === 'غائب' || status === 'غياب') {
                    rowClass = "bg-red-50/50 hover:bg-red-50 transition-colors duration-150";
                  } else if (status === 'تأخير' || isEarlyDeparture || isShortHours) {
                    rowClass = "bg-yellow-50/50 hover:bg-yellow-50 transition-colors duration-150";
                  } else if (status === 'راحة' || status === 'إجازة' || status === 'OFF') {
                    rowClass = "bg-blue-50/50 hover:bg-blue-50 transition-colors duration-150";
                  } else if (status === 'مأمورية' || status === 'حاضر' || status === 'مكتمل' || status === 'إضافي') {
                    rowClass = "bg-emerald-50/50 hover:bg-emerald-50 transition-colors duration-150";
                  }

                  return (
                    <tr key={log.id} className={rowClass}>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm text-slate-600 font-mono bg-slate-100 inline-flex px-2.5 py-1 rounded-lg">{log.employee_id}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-900">{log.profiles?.full_name || 'غير معروف'}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{log.profiles?.department || '---'}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-700">{log.date}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{log.weekday || '---'}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-slate-700">
                          <Clock className="h-4 w-4 text-slate-400 ml-2" />
                          {formatTime(log.first_punch)}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-slate-700">
                          <Clock className="h-4 w-4 text-slate-400 ml-2" />
                          {formatTime(log.last_punch)}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className={`text-sm font-bold ${isShortHours ? 'text-red-600' : 'text-slate-900'}`}>
                          {log.total_hours ? `${log.total_hours.toFixed(2)} س` : '---'}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-lg border ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAddModal(false)}>
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative inline-block align-bottom bg-white rounded-3xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-slate-100">
              <form onSubmit={handleManualEntry}>
                <div className="bg-white px-6 pt-8 pb-6">
                  <div className="mb-8 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-4">
                      <Clock className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">إدخال حضور يدوي</h3>
                    <p className="text-sm text-slate-500 mt-2">إضافة سجل حضور لموظف في تاريخ {date}</p>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">الرقم الوظيفي</label>
                      <input
                        type="text"
                        required
                        value={manualEmpId}
                        onChange={(e) => setManualEmpId(e.target.value)}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white font-mono text-left"
                        placeholder="EMP-001"
                        dir="ltr"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">وقت الدخول</label>
                        <input
                          type="time"
                          value={manualFirstPunch}
                          onChange={(e) => setManualFirstPunch(e.target.value)}
                          className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">وقت الخروج</label>
                        <input
                          type="time"
                          value={manualLastPunch}
                          onChange={(e) => setManualLastPunch(e.target.value)}
                          className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-6 py-5 sm:flex sm:flex-row-reverse gap-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full inline-flex justify-center rounded-2xl border border-transparent shadow-sm px-6 py-3 bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50 transition-all"
                  >
                    {saving ? 'جاري الحفظ...' : 'حفظ السجل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-2xl border border-slate-200 shadow-sm px-6 py-3 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
