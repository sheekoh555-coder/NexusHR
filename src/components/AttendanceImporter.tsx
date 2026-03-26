import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { PreviewRecord } from '../types';
import { UploadCloud, FileSpreadsheet, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface AttendanceImporterProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AttendanceImporter({ onClose, onSuccess }: AttendanceImporterProps) {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [profilesToUpsert, setProfilesToUpsert] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

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

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('يرجى رفع ملف Excel صالح (.xlsx أو .xls)');
      return;
    }

    setProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];
      
      if (json.length === 0) {
        toast.error('الملف فارغ أو لا يحتوي على بيانات صحيحة');
        setProcessing(false);
        return;
      }

      // Validate columns
      const firstRow = json[0];
      const hasRequiredColumns = 
        ('Employee Name' in firstRow || 'اسم الموظف' in firstRow) &&
        ('Date' in firstRow || 'التاريخ' in firstRow) &&
        ('Check In' in firstRow || 'الحضور' in firstRow) &&
        ('Check Out' in firstRow || 'الانصراف' in firstRow);

      if (!hasRequiredColumns) {
        toast.error('الملف لا يحتوي على الأعمدة المطلوبة: Employee Name, Date, Check In, Check Out');
        setProcessing(false);
        return;
      }

      toast.loading('جاري معالجة البيانات...', { id: 'import-toast' });

      // Fetch existing profiles to map names to IDs
      const { data: existingProfiles } = await supabase.from('profiles').select('employee_id, full_name');
      const profileMap = new Map<string, string>();
      if (existingProfiles) {
        existingProfiles.forEach(p => {
          if (p.full_name) profileMap.set(p.full_name.trim().toLowerCase(), p.employee_id);
        });
      }

      const previewResults: PreviewRecord[] = [];
      const profilesMap = new Map<string, any>();

      json.forEach(row => {
        const empName = String(row['Employee Name'] || row['اسم الموظف'] || '').trim();
        if (!empName) return; // Skip empty rows

        let dateStr = '';
        const rawDate = row['Date'] || row['التاريخ'];
        if (typeof rawDate === 'number') {
           const dateObj = XLSX.SSF.parse_date_code(rawDate);
           dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
        } else {
           dateStr = String(rawDate || '').trim();
           if (dateStr.includes('/')) {
             const parts = dateStr.split('/');
             if (parts.length === 3) {
               dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
             }
           }
        }

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

        const checkIn = formatExcelTime(row['Check In'] || row['الحضور']);
        const checkOut = formatExcelTime(row['Check Out'] || row['الانصراف']);

        // Calculations
        let total_hours = 0;
        let late_minutes = 0;
        let overtime_minutes = 0;
        let is_early_departure = false;

        const parseTime = (timeStr: string) => {
          const [h, m] = timeStr.split(':').map(Number);
          return h * 60 + m;
        };

        if (checkIn && checkOut) {
          const inMins = parseTime(checkIn);
          const outMins = parseTime(checkOut);
          
          total_hours = Math.max(0, (outMins - inMins) / 60);
          
          // Late if Check In > 09:00
          if (inMins > parseTime('09:00')) {
            late_minutes = inMins - parseTime('09:00');
          }

          // Early Leave if Check Out < 17:00
          if (outMins < parseTime('17:00')) {
            is_early_departure = true;
          }

          // Overtime if Check Out > 17:00
          if (outMins > parseTime('17:00')) {
            overtime_minutes = outMins - parseTime('17:00');
          }
        }

        let status = 'حاضر';
        if (!checkIn && !checkOut) status = 'غياب';
        else if (late_minutes > 0) status = 'تأخير';
        else if (is_early_departure) status = 'انصراف مبكر';
        else if (overtime_minutes > 0) status = 'إضافي';

        // Map employee name to ID
        let empId = profileMap.get(empName.toLowerCase());
        if (!empId) {
          // Generate a new ID if not found
          empId = `EMP-${Math.floor(Math.random() * 10000)}`;
          profileMap.set(empName.toLowerCase(), empId);
          profilesMap.set(empId, {
            employee_id: empId,
            full_name: empName,
            first_name: empName.split(' ')[0],
            last_name: empName.split(' ').slice(1).join(' '),
            base_salary: 0
          });
        }

        previewResults.push({
          employee_id: empId,
          first_name: empName.split(' ')[0],
          last_name: empName.split(' ').slice(1).join(' '),
          full_name: empName,
          department: '',
          date: dateStr,
          weekday: '',
          first_punch: checkIn,
          last_punch: checkOut,
          total_hours: total_hours,
          late_minutes: late_minutes,
          overtime_minutes: overtime_minutes,
          status: status,
          notes: '',
          is_absent: !checkIn && !checkOut,
          is_early_departure: is_early_departure,
          short_hours: false
        });
      });

      setPreviewData(previewResults);
      setProfilesToUpsert(Array.from(profilesMap.values()));
      setShowPreview(true);
      toast.dismiss('import-toast');
      toast.success('تمت قراءة الملف بنجاح');

    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('حدث خطأ أثناء قراءة الملف', { id: 'import-toast' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSyncAndProcess = async () => {
    setSaving(true);
    toast.loading('جاري حفظ البيانات...', { id: 'sync-toast' });
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

      toast.success('تم حفظ بيانات الحضور بنجاح ✅', { id: 'sync-toast' });
      onSuccess();
      navigate('/dashboard');
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
            <h2 className="text-2xl font-bold text-slate-900">مراجعة بيانات الحضور</h2>
            <p className="text-sm text-slate-500 mt-1">تم احتساب التأخير، الانصراف المبكر، والوقت الإضافي تلقائياً.</p>
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
              {saving ? 'جاري الحفظ...' : 'حفظ البيانات'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">اسم الموظف</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">التاريخ</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الحضور</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الانصراف</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">ساعات العمل</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">التأخير</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">انصراف مبكر</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">إضافي</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {previewData.map((record, idx) => {
                  let rowClass = "hover:bg-slate-50/80 transition-colors duration-150";
                  if (record.is_absent || record.status === 'غياب') {
                    rowClass = "bg-red-50/50 hover:bg-red-50 transition-colors duration-150";
                  } else if (record.late_minutes > 0 || record.is_early_departure) {
                    rowClass = "bg-yellow-50/50 hover:bg-yellow-50 transition-colors duration-150";
                  } else if (record.overtime_minutes > 0) {
                    rowClass = "bg-emerald-50/50 hover:bg-emerald-50 transition-colors duration-150";
                  }

                  return (
                    <tr key={idx} className={rowClass}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                        {record.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {record.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-slate-700">
                        {record.first_punch || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-slate-700">
                        {record.last_punch || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                        {record.total_hours > 0 ? record.total_hours.toFixed(2) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${record.late_minutes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {record.late_minutes > 0 ? `${record.late_minutes} د` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${record.is_early_departure ? 'text-red-600' : 'text-slate-400'}`}>
                          {record.is_early_departure ? 'نعم' : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${record.overtime_minutes > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {record.overtime_minutes > 0 ? `${record.overtime_minutes} د` : '-'}
                        </span>
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
          <p className="text-sm text-slate-500 mt-1">قم برفع ملف Excel يحتوي على البصمات.</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-5 mb-8 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-bold text-base mb-1">تعليمات رفع الملف:</p>
          <ul className="list-disc list-inside space-y-1 font-medium">
            <li>يجب أن يكون الملف بصيغة Excel (.xlsx أو .xls).</li>
            <li>يجب أن يحتوي الملف على الأعمدة التالية: <strong>Employee Name, Date, Check In, Check Out</strong>.</li>
            <li>سيتم احتساب التأخير إذا كان الحضور بعد 09:00.</li>
            <li>سيتم احتساب الانصراف المبكر إذا كان الانصراف قبل 17:00.</li>
            <li>سيتم احتساب الوقت الإضافي إذا كان الانصراف بعد 17:00.</li>
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
        <p className="text-slate-500 text-sm mb-6">أو انقر لاختيار ملف من جهازك (Excel)</p>
        
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

