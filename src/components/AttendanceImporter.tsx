import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { PreviewRecord, Profile, Leave, SystemSettings } from '../types';
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface AttendanceImporterProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AttendanceImporter({ onClose, onSuccess }: AttendanceImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [profilesToUpsert, setProfilesToUpsert] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const calculateMetrics = (first: string | null, last: string | null, notes: string, settings: SystemSettings | null) => {
    let late_minutes = 0;
    let total_hours = 0;
    let overtime_minutes = 0;
    let is_early_departure = false;
    let short_hours = false;

    const isRamadan = notes.includes('رمضان') || notes.includes('أول يوم رمضان');
    
    // Default values if settings not loaded
    let startStr = isRamadan ? '09:00' : '08:00';
    let endStr = isRamadan ? '15:00' : '16:00';
    
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

    if (first) {
      const firstPunchMins = parseTime(first);
      late_minutes = Math.max(0, firstPunchMins - standardStartMins);

      if (last) {
        const lastPunchMins = parseTime(last);
        
        total_hours = Math.max(0, (lastPunchMins - firstPunchMins) / 60);
        
        overtime_minutes = Math.max(0, lastPunchMins - standardEndMins);
        
        if (lastPunchMins < standardEndMins) {
          is_early_departure = true;
        }
        
        if (total_hours < requiredHours) {
          short_hours = true;
        }
      }
    }

    return { late_minutes, total_hours, overtime_minutes, is_early_departure, short_hours, is_ramadan: isRamadan, startStr, endStr };
  };

  const handleFile = async (file: File) => {
    setProcessing(true);
    try {
      // Fetch settings first
      let fetchedSettings: SystemSettings | null = null;
      try {
        const { data: settingsData } = await supabase.from('system_settings').select('*').eq('id', 1).single();
        if (settingsData) {
          fetchedSettings = settingsData as SystemSettings;
          setSysSettings(fetchedSettings);
        }
      } catch (e) {
        console.warn('Could not fetch settings, using defaults', e);
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Parse to JSON with header: 1 to get array of arrays
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Skip header row (index 0) and empty rows
      const rows = json.slice(1).filter(row => row.length > 0 && row[0]);
      
      if (rows.length === 0) {
        toast.error('الملف فارغ أو لا يحتوي على بيانات صحيحة');
        setProcessing(false);
        return;
      }

      toast.loading('جاري معالجة وحفظ البيانات...', { id: 'import-toast' });

      const previewResults: PreviewRecord[] = [];
      const profilesMap = new Map<string, any>();

      rows.forEach(row => {
        // A (ID), B (First Name), C (Last Name), D (Dept), E (Date), F (Weekday), G (In), H (Out), I (Total), J (Notes)
        const empId = String(row[0] || '').trim();
        const firstName = String(row[1] || '').trim();
        const lastName = String(row[2] || '').trim();
        const dept = String(row[3] || '').trim();
        
        // Handle Date (Column E)
        let dateStr = '';
        if (typeof row[4] === 'number') {
           const dateObj = XLSX.SSF.parse_date_code(row[4]);
           dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
        } else {
           dateStr = String(row[4] || '').trim();
           // Attempt basic normalization if it's DD/MM/YYYY
           if (dateStr.includes('/')) {
             const parts = dateStr.split('/');
             if (parts.length === 3) {
               // Assuming DD/MM/YYYY for Arabic/European format
               dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
             }
           }
        }

        const weekday = String(row[5] || '').trim();

        // Handle Time (Columns G, H)
        const formatExcelTime = (val: any) => {
          if (val === undefined || val === null || val === '') return null;
          if (typeof val === 'number') {
            const totalSeconds = Math.round(val * 24 * 60 * 60);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
          const strVal = String(val).trim();
          if (strVal.length > 5) return strVal.substring(0, 5);
          return strVal;
        };

        const firstPunchRaw = formatExcelTime(row[6]);
        const lastPunchRaw = formatExcelTime(row[7]);
        const notes = String(row[9] || '').trim();

        // Smart Parsing
        let status = 'حاضر';
        let is_absent = false;
        
        if (notes.toUpperCase().includes('OFF')) {
          status = 'راحة';
        } else if (notes.includes('مأمورية')) {
          status = 'مأمورية';
        } else if (notes.includes('أجازة') || notes.includes('إجازة')) {
          status = 'إجازة';
        } else if (!firstPunchRaw && !lastPunchRaw) {
          status = 'غياب';
          is_absent = true;
        }

        // Auto-Fill Logic
        const isRamadan = notes.includes('رمضان') || notes.includes('أول يوم رمضان');
        let defaultStart = isRamadan ? '09:00' : '08:00';
        let defaultEnd = isRamadan ? '15:00' : '16:00';
        
        if (fetchedSettings) {
          defaultStart = isRamadan ? fetchedSettings.ramadan_start_time.substring(0, 5) : fetchedSettings.work_start_time.substring(0, 5);
          defaultEnd = isRamadan ? fetchedSettings.ramadan_end_time.substring(0, 5) : fetchedSettings.work_end_time.substring(0, 5);
        }

        let firstPunch = firstPunchRaw;
        let lastPunch = lastPunchRaw;

        if (['مأمورية', 'راحة', 'إجازة'].includes(status)) {
          firstPunch = defaultStart;
          lastPunch = defaultEnd;
        }

        const metrics = calculateMetrics(firstPunch, lastPunch, notes, fetchedSettings);
        
        if (status === 'حاضر') {
           if (!lastPunch) status = 'في العمل';
           else if (metrics.late_minutes > 0) status = 'تأخير';
           else if (metrics.overtime_minutes > 0) status = 'إضافي';
        }

        const fullName = `${firstName} ${lastName}`.trim();

        profilesMap.set(empId, {
          employee_id: empId,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName || empId,
          department: dept
        });

        previewResults.push({
          employee_id: empId,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName || empId,
          department: dept,
          date: dateStr,
          weekday: weekday,
          first_punch: firstPunch,
          last_punch: lastPunch,
          total_hours: metrics.total_hours,
          late_minutes: metrics.late_minutes,
          overtime_minutes: metrics.overtime_minutes,
          status: status,
          notes: notes,
          is_absent: is_absent,
          is_early_departure: metrics.is_early_departure,
          short_hours: metrics.short_hours
        });
      });

      setPreviewData(previewResults);
      setProfilesToUpsert(Array.from(profilesMap.values()));
      setShowPreview(true);
      toast.dismiss('import-toast');

    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('حدث خطأ أثناء قراءة الملف', { id: 'import-toast' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSyncAndProcess = async () => {
    setSaving(true);
    toast.loading('جاري المزامنة والمعالجة...', { id: 'sync-toast' });
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      // 1. Upsert Profiles first
      if (profilesToUpsert.length > 0) {
        const profilePromise = supabase
          .from('profiles')
          .upsert(profilesToUpsert, { onConflict: 'employee_id' });
        
        const { error: profileError } = await Promise.race([profilePromise, timeoutPromise]) as any;
        if (profileError) throw profileError;
      }

      // 2. Upsert Attendance
      const recordsToInsert = previewData.map(record => ({
        employee_id: record.employee_id,
        date: record.date,
        weekday: record.weekday,
        first_punch: record.first_punch,
        last_punch: record.last_punch,
        total_hours: record.total_hours,
        late_minutes: record.late_minutes,
        overtime_minutes: record.overtime_minutes,
        status: record.status,
        notes: record.notes
      }));

      const attendancePromise = supabase
        .from('attendance')
        .upsert(recordsToInsert, { onConflict: 'employee_id, date' });

      const { error: attendanceError } = await Promise.race([attendancePromise, timeoutPromise]) as any;
      if (attendanceError) throw attendanceError;

      toast.success('تمت المزامنة والمعالجة بنجاح ✅', { id: 'sync-toast' });
      onSuccess();
    } catch (error: any) {
      console.error('Error saving imported data:', error);
      const errorMsg = error.message === 'Request timeout' ? 'انتهى وقت الطلب. يرجى المحاولة مرة أخرى.' : 'حدث خطأ أثناء حفظ البيانات ❌';
      toast.error(errorMsg, { id: 'sync-toast' });
    } finally {
      setSaving(false);
    }
  };

  if (showPreview) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">مراجعة البيانات (المحرك الذكي)</h2>
            <p className="text-sm text-slate-500 mt-1">تم تطبيق قواعد الحضور، المأموريات، ورمضان تلقائياً.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowPreview(false)}
              className="px-5 py-2.5 border border-slate-200 text-sm font-bold rounded-2xl text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              disabled={saving}
            >
              إلغاء
            </button>
            <button
              onClick={handleSyncAndProcess}
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ml-2 ${saving ? 'animate-spin' : ''}`} />
              {saving ? 'جاري المزامنة...' : 'مزامنة ومعالجة'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الموظف</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">التاريخ</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">حضور</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">انصراف</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">تأخير</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">إضافي</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الحالة</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {previewData.map((record, idx) => {
                  // Smart Colors Logic
                  let rowClass = "hover:bg-slate-50/80 transition-colors duration-150";
                  if (record.is_absent) {
                    rowClass = "bg-red-50/50 hover:bg-red-50 transition-colors duration-150";
                  } else if (record.is_early_departure || record.short_hours) {
                    rowClass = "bg-yellow-50/50 hover:bg-yellow-50 transition-colors duration-150";
                  }

                  return (
                    <tr key={idx} className={rowClass}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-900">{record.full_name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{record.employee_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{record.date}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{record.weekday}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-slate-700">
                        {record.first_punch || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-slate-700">
                        {record.last_punch || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${record.late_minutes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {record.late_minutes > 0 ? `${record.late_minutes} د` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${record.overtime_minutes > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {record.overtime_minutes > 0 ? `${record.overtime_minutes} د` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                          record.status === 'حاضر' ? 'bg-emerald-100 text-emerald-800' :
                          record.status === 'غياب' ? 'bg-red-100 text-red-800' :
                          record.status === 'تأخير' ? 'bg-amber-100 text-amber-800' :
                          record.status === 'إضافي' ? 'bg-blue-100 text-blue-800' :
                          record.status === 'مأمورية' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {record.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">استيراد سجلات الحضور</h2>
          <p className="text-sm text-slate-500 mt-1">قم برفع ملف Excel أو CSV يحتوي على البصمات.</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-5 mb-8 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-bold text-base mb-1">المحرك الذكي (Smart Engine):</p>
          <p className="mb-2">يقوم النظام تلقائياً بـ:</p>
          <ul className="list-disc list-inside space-y-1 font-medium">
            <li>حساب التأخير والإضافي بناءً على إعدادات الشركة.</li>
            <li>تطبيق مواعيد رمضان تلقائياً إذا كانت الملاحظات تحتوي على "رمضان".</li>
            <li>ملء أوقات الحضور والانصراف تلقائياً لحالات (مأمورية، OFF، إجازة).</li>
            <li>تلوين الصفوف: <span className="text-red-600 font-bold">أحمر للغياب</span>، <span className="text-yellow-600 font-bold">أصفر للانصراف المبكر</span>.</li>
          </ul>
        </div>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-200 ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <div className="mx-auto w-20 h-20 mb-6 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center">
          <FileSpreadsheet className={`w-10 h-10 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">اسحب وأفلت الملف هنا</h3>
        <p className="text-slate-500 text-sm mb-6">أو انقر لاختيار ملف من جهازك (Excel, CSV)</p>
        
        <label className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all">
          <UploadCloud className="w-5 h-5 ml-2" />
          {processing ? 'جاري المعالجة...' : 'اختيار ملف'}
          <input
            type="file"
            className="hidden"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={onFileChange}
            disabled={processing}
          />
        </label>
      </div>
    </div>
  );
}
