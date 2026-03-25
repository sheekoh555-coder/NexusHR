import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Calculator, DollarSign, FileText, Printer, Eye, XCircle, PieChart as PieChartIcon } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { SystemSettings } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface EmployeeStats {
  employee_id: string;
  full_name: string;
  base_salary: number;
  total_work_days: number;
  total_late_minutes: number;
  total_overtime_minutes: number;
  total_absence_days: number;
  total_mission_days: number;
  social_insurance_deduction: number;
  tax_deduction: number;
  penalty_deduction: number;
  overtime_addition: number;
  net_salary: number;
}

export default function Payroll() {
  const [records, setRecords] = useState<EmployeeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [calculating, setCalculating] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStats | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      fetchDashboardData();
    }
  }, [month, settings]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*').eq('id', 1).single();
      if (data) {
        setSettings(data as SystemSettings);
      } else {
        // Fallback settings if not found
        setSettings({
          id: 1,
          work_start_time: '08:00',
          work_end_time: '16:00',
          ramadan_start_time: '09:00',
          ramadan_end_time: '15:00',
          social_insurance_pct: 11,
          tax_pct: 0
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles
      const { data: profiles, error: empError } = await supabase.from('profiles').select('*');
      if (empError) throw empError;

      // 2. Fetch attendance for the month
      const { data: attendanceLogs, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .like('date', `${month}-%`);
      if (attError) throw attError;

      // 3. Aggregate data
      const statsMap = new Map<string, EmployeeStats>();
      
      profiles.forEach(emp => {
        statsMap.set(emp.employee_id, {
          employee_id: emp.employee_id,
          full_name: emp.full_name || 'غير معروف',
          base_salary: emp.base_salary || 0,
          total_work_days: 0,
          total_late_minutes: 0,
          total_overtime_minutes: 0,
          total_absence_days: 0,
          total_mission_days: 0,
          social_insurance_deduction: 0,
          tax_deduction: 0,
          penalty_deduction: 0,
          overtime_addition: 0,
          net_salary: 0,
        });
      });

      let onTimeCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      attendanceLogs?.forEach(log => {
        const empId = log.employee_id;
        if (!statsMap.has(empId)) return;
        
        const stats = statsMap.get(empId)!;
        const status = log.status || '';

        // Logic Rule: مأمورية or OFF or أجازة or إجازة should NOT count as absence and should be calculated as a full working day.
        const fullWorkDayStatuses = ['حاضر', 'مكتمل', 'في العمل', 'تأخير', 'إضافي', 'مأمورية', 'OFF', 'أجازة', 'إجازة', 'راحة'];
        
        if (fullWorkDayStatuses.includes(status)) {
          stats.total_work_days += 1;
        } else if (status === 'غياب' || status === 'غائب') {
          stats.total_absence_days += 1;
        }

        if (status === 'مأمورية') {
          stats.total_mission_days += 1;
        }

        stats.total_late_minutes += (log.late_minutes || 0);
        stats.total_overtime_minutes += (log.overtime_minutes || 0);

        // For chart
        if (status === 'حاضر' || status === 'مكتمل' || status === 'في العمل' || status === 'إضافي') {
          onTimeCount++;
        } else if (status === 'تأخير') {
          lateCount++;
        } else if (status === 'غياب' || status === 'غائب') {
          absentCount++;
        }
      });

      // Calculate financials
      const socialInsurancePct = settings ? settings.social_insurance_pct / 100 : 0.11;
      const taxPct = settings ? settings.tax_pct / 100 : 0;

      Array.from(statsMap.values()).forEach(stats => {
        const base = stats.base_salary;
        stats.social_insurance_deduction = base * socialInsurancePct;
        
        if (taxPct > 0) {
          stats.tax_deduction = base * taxPct;
        } else {
          if (base > 10000) {
            stats.tax_deduction = (base - 10000) * 0.15 + 5000 * 0.10;
          } else if (base > 5000) {
            stats.tax_deduction = (base - 5000) * 0.10;
          }
        }

        const dailyRate = base / 30;
        const hourlyRate = dailyRate / 8;
        const minuteRate = hourlyRate / 60;

        // خصم التأخير + خصم الغياب
        const penaltyLate = stats.total_late_minutes * minuteRate;
        const penaltyAbsence = stats.total_absence_days * dailyRate;
        stats.penalty_deduction = penaltyLate + penaltyAbsence;
        
        // بدل الإضافي
        stats.overtime_addition = stats.total_overtime_minutes * minuteRate * 1.5;

        stats.net_salary = base - stats.social_insurance_deduction - stats.tax_deduction - stats.penalty_deduction + stats.overtime_addition;
      });

      setRecords(Array.from(statsMap.values()));
      
      // Only set chart data if there are logs
      if (onTimeCount > 0 || lateCount > 0 || absentCount > 0) {
        setChartData([
          { name: 'في الموعد', value: onTimeCount, color: '#10b981' },
          { name: 'تأخير', value: lateCount, color: '#f59e0b' },
          { name: 'غياب', value: absentCount, color: '#ef4444' },
        ]);
      } else {
        setChartData([]);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const calculatePayroll = async () => {
    setCalculating(true);
    try {
      const newRecords = records.map(stats => ({
        employee_id: stats.employee_id,
        month: month,
        base_salary: stats.base_salary,
        social_insurance_deduction: stats.social_insurance_deduction,
        tax_deduction: stats.tax_deduction,
        penalty_deduction: stats.penalty_deduction,
        overtime_addition: stats.overtime_addition,
        bonus_addition: 0,
        net_salary: stats.net_salary
      }));

      // Upsert records
      const { error: upsertError } = await supabase
        .from('payroll')
        .upsert(newRecords, { onConflict: 'employee_id, month' });

      if (upsertError) throw upsertError;
      
      toast.success('تم حفظ الرواتب بنجاح! ✅');
    } catch (error) {
      console.error('Error calculating payroll:', error);
      toast.error('حدث خطأ أثناء حفظ الرواتب. ❌');
    } finally {
      setCalculating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">التقارير والرواتب</h1>
          <p className="mt-2 text-base text-slate-500">تحليل الحضور والانصراف وإصدار مسيرات الرواتب الشهرية.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
            <CalendarIcon className="h-5 w-5 text-slate-400 ml-3" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-none focus:ring-0 text-sm font-semibold text-slate-700 bg-transparent p-0"
            />
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2.5 border border-slate-200 text-sm font-bold rounded-2xl shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            <Printer className="-mr-1 ml-2 h-5 w-5 text-slate-500" aria-hidden="true" />
            طباعة / PDF
          </button>
          <button
            onClick={calculatePayroll}
            disabled={calculating || loading}
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50"
          >
            <Calculator className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
            {calculating ? 'جاري الحفظ...' : 'حفظ الرواتب'}
          </button>
        </div>
      </div>

      {/* Print Header (Only visible when printing) */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">تقرير الرواتب والحضور</h1>
        <p className="text-lg text-slate-600 mt-2">شهر: {month}</p>
      </div>

      {/* Charts Section */}
      {!loading && chartData.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 print:hidden">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <PieChartIcon className="w-5 h-5 ml-2 text-blue-500" />
            مؤشرات صحة الحضور
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => [`${value} سجل`, 'العدد']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  اسم الموظف
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  أيام العمل الفعلية
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  إجمالي ساعات التأخير
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  إجمالي الساعات الإضافية
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  أيام الغياب
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  عدد المأموريات
                </th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider print:hidden">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="h-10 w-10 text-slate-300 mb-3" />
                      <p>لا توجد بيانات لهذا الشهر.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.employee_id} className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{record.full_name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{record.employee_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{record.total_work_days} يوم</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${record.total_late_minutes > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {Math.floor(record.total_late_minutes / 60)}س {record.total_late_minutes % 60}د
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${record.total_overtime_minutes > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {Math.floor(record.total_overtime_minutes / 60)}س {record.total_overtime_minutes % 60}د
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${record.total_absence_days > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {record.total_absence_days} يوم
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">
                        {record.total_mission_days}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center print:hidden">
                      <button
                        onClick={() => setSelectedEmployee(record)}
                        className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-xs font-bold rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        <Eye className="w-4 h-4 ml-1.5 text-slate-400" />
                        عرض الراتب
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Slip Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity print:hidden" aria-hidden="true" onClick={() => setSelectedEmployee(null)}>
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
            </div>
            
            <div className="relative inline-block align-bottom bg-white rounded-3xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-100 print:shadow-none print:border-none print:w-full print:max-w-full">
              <div className="bg-white px-6 pt-6 pb-6 print:p-0">
                <div className="flex justify-between items-start mb-6 print:mb-10">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 print:text-4xl">مفردات الراتب (إيصال استلام)</h3>
                    <p className="text-sm text-slate-500 mt-1 print:text-lg">{selectedEmployee.full_name} - شهر {month}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono print:text-sm">الرقم الوظيفي: {selectedEmployee.employee_id}</p>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    <button onClick={() => window.print()} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="طباعة الإيصال">
                      <Printer className="w-5 h-5" />
                    </button>
                    <button onClick={() => setSelectedEmployee(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4 print:bg-white print:border-2 print:border-slate-200 print:p-8">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <span className="text-sm font-bold text-slate-600 print:text-lg">الراتب الأساسي</span>
                    <span className="text-lg font-bold text-slate-900 print:text-xl">{selectedEmployee.base_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-emerald-600 print:text-lg">بدل الإضافي (+)</span>
                    <span className="text-sm font-bold text-emerald-600 print:text-lg">{selectedEmployee.overtime_addition.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-red-600 print:text-lg">خصم التأخير والغياب (-)</span>
                    <span className="text-sm font-bold text-red-600 print:text-lg">{selectedEmployee.penalty_deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</span>
                  </div>
                  
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <span className="text-sm font-medium text-red-600 print:text-lg">تأمينات الاجتماعية ({settings?.social_insurance_pct || 11}%) (-)</span>
                    <span className="text-sm font-bold text-red-600 print:text-lg">{selectedEmployee.social_insurance_deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-xl font-bold text-slate-900 print:text-2xl">صافي الراتب المستحق</span>
                    <span className="text-2xl font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl print:bg-transparent print:text-3xl print:p-0">
                      {selectedEmployee.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                    </span>
                  </div>
                </div>
                
                <div className="mt-8 hidden print:flex justify-between items-end px-8 pt-16">
                  <div className="text-center">
                    <div className="w-48 border-b-2 border-slate-300 mb-2"></div>
                    <span className="text-sm font-bold text-slate-600">توقيع الموظف</span>
                  </div>
                  <div className="text-center">
                    <div className="w-48 border-b-2 border-slate-300 mb-2"></div>
                    <span className="text-sm font-bold text-slate-600">توقيع المدير المباشر</span>
                  </div>
                  <div className="text-center">
                    <div className="w-48 border-b-2 border-slate-300 mb-2"></div>
                    <span className="text-sm font-bold text-slate-600">توقيع مدير الموارد البشرية</span>
                  </div>
                </div>

                <div className="mt-6 text-center text-xs text-slate-400 print:mt-16 print:text-sm">
                  تم الحساب بناءً على سجلات الحضور والانصراف لشهر {month}
                  <br className="hidden print:block" />
                  صدر هذا الإيصال من نظام NexusHR
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for the icon since we didn't import it at the top
function CalendarIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
