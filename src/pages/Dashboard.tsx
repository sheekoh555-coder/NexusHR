import React, { useState, useEffect } from 'react';
import { Users, Clock, Calculator, AlertCircle, Briefcase, Activity, FileText, Download, RefreshCw } from 'lucide-react';
import SetupInstructions from '../components/SetupInstructions';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface ActivityLog {
  id: string;
  employee_id: string;
  full_name: string;
  action: string;
  time: string;
  type: 'check_in' | 'check_out' | 'mission' | 'upload';
}

interface AttendanceReport {
  id: string;
  employee_id: string;
  full_name: string;
  first_punch: string | null;
  last_punch: string | null;
  status: string;
  total_hours: number;
  late_minutes: number;
  overtime_minutes: number;
}

export default function Dashboard() {
  const [totalEmployees, setTotalEmployees] = useState<number>(0);
  const [todayAttendance, setTodayAttendance] = useState<number>(0);
  const [totalPayroll, setTotalPayroll] = useState<number>(0);
  const [missingPunches, setMissingPunches] = useState<number>(0);
  const [activeMissions, setActiveMissions] = useState<number>(0);
  const [pendingLeaves, setPendingLeaves] = useState<number>(0);
  const [openJobs, setOpenJobs] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [attendanceReport, setAttendanceReport] = useState<AttendanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    const toastId = toast.loading('جاري تصدير البيانات...');
    try {
      let exportData: any = {};
      
      // Attempt to use the requested Supabase RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('export_all_hr_data');
      
      if (!rpcError && rpcData) {
        exportData = rpcData;
      } else {
        // Fallback to direct fetching if RPC is not created yet
        console.warn('RPC export_all_hr_data not found or failed, using fallback.', rpcError);
        const [profilesRes, attendanceRes, payrollRes, leavesRes, departmentsRes] = await Promise.all([
          supabase.from('profiles').select('*'),
          supabase.from('attendance').select('*'),
          supabase.from('payroll').select('*'),
          supabase.from('leaves').select('*'),
          supabase.from('departments').select('*')
        ]);

        exportData = {
          employees: profilesRes.data || [],
          daily_attendance: attendanceRes.data || [],
          payroll: payrollRes.data || [],
          leaves: leavesRes.data || [],
          departments: departmentsRes.data || []
        };
      }

      const hasData = Object.values(exportData).some((arr: any) => arr && arr.length > 0);
      
      if (!hasData) {
        toast.error('لا توجد بيانات لتصديرها', { id: toastId });
        setExporting(false);
        return;
      }

      const wb = XLSX.utils.book_new();

      const addSheet = (data: any[], name: string) => {
        if (data && data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, name);
        } else {
          const ws = XLSX.utils.json_to_sheet([{ Message: 'No data available' }]);
          XLSX.utils.book_append_sheet(wb, ws, name);
        }
      };

      addSheet(exportData.employees, 'Employees');
      addSheet(exportData.daily_attendance, 'Attendance');
      addSheet(exportData.payroll, 'Payroll');
      addSheet(exportData.leaves, 'Leaves');
      addSheet(exportData.departments, 'Departments');

      XLSX.writeFile(wb, 'HR_FULL_EXPORT.xlsx');
      toast.success('Export completed successfully', { id: toastId });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('حدث خطأ أثناء التصدير', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL';

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchDashboardData();
    }
  }, [isSupabaseConfigured]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentMonth = format(new Date(), 'yyyy-MM');

      // 1. Fetch total employees
      const { count: empCount, error: empError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      if (!empError && empCount !== null) {
        setTotalEmployees(empCount);
      }

      // 2. Fetch today's attendance (present or late or overtime)
      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles (full_name)
        `)
        .eq('date', today);
      
      if (!attError && attData) {
        const presentCount = attData.filter(r => ['حاضر', 'تأخير', 'إضافي', 'في العمل', 'مكتمل'].includes(r.status || '')).length;
        setTodayAttendance(presentCount);

        const missingCount = attData.filter(r => r.first_punch && !r.last_punch && !['مأمورية', 'أجازة', 'إجازة', 'OFF', 'راحة'].includes(r.status || '')).length;
        setMissingPunches(missingCount);

        const missionCount = attData.filter(r => r.status === 'مأمورية').length;
        setActiveMissions(missionCount);

        // Generate attendance report
        const report: AttendanceReport[] = attData.map(record => ({
          id: record.id,
          employee_id: record.employee_id,
          full_name: record.profiles?.full_name || record.employee_id,
          first_punch: record.first_punch,
          last_punch: record.last_punch,
          status: record.status || 'غير معروف',
          total_hours: record.total_hours || 0,
          late_minutes: record.late_minutes || 0,
          overtime_minutes: record.overtime_minutes || 0
        }));
        setAttendanceReport(report);

        // Generate activity feed from today's attendance
        const activities: ActivityLog[] = [];
        attData.forEach(record => {
          const name = record.profiles?.full_name || record.employee_id;
          if (record.first_punch) {
            activities.push({
              id: `${record.id}-in`,
              employee_id: record.employee_id,
              full_name: name,
              action: 'تسجيل دخول',
              time: record.first_punch,
              type: 'check_in'
            });
          }
          if (record.last_punch) {
            activities.push({
              id: `${record.id}-out`,
              employee_id: record.employee_id,
              full_name: name,
              action: 'تسجيل انصراف',
              time: record.last_punch,
              type: 'check_out'
            });
          }
          if (record.status === 'مأمورية') {
            activities.push({
              id: `${record.id}-mission`,
              employee_id: record.employee_id,
              full_name: name,
              action: 'في مأمورية',
              time: record.first_punch || '08:00',
              type: 'mission'
            });
          }
        });

        // Sort by time descending
        activities.sort((a, b) => b.time.localeCompare(a.time));
        setRecentActivity(activities.slice(0, 8)); // Top 8 recent activities
      }

      // 3. Fetch total payroll for current month
      const { data: payrollData, error: payrollError } = await supabase
        .from('payroll')
        .select('net_salary')
        .eq('month', currentMonth);
      
      if (!payrollError && payrollData) {
        const total = payrollData.reduce((sum, record) => sum + (record.net_salary || 0), 0);
        setTotalPayroll(total);
      }

      // 4. Fetch pending leaves
      const { count: leavesCount, error: leavesError } = await supabase
        .from('leaves')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'قيد المراجعة');
      
      if (!leavesError && leavesCount !== null) {
        setPendingLeaves(leavesCount);
      }

      // 5. Fetch open jobs
      const { count: jobsCount, error: jobsError } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'مفتوح');
      
      if (!jobsError && jobsCount !== null) {
        setOpenJobs(jobsCount);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return <SetupInstructions />;
  }

  const attendanceRate = totalEmployees > 0 ? Math.round((todayAttendance / totalEmployees) * 100) : 0;

  const stats = [
    { name: 'إجمالي الموظفين', value: loading ? '...' : totalEmployees.toString(), icon: Users, color: 'bg-blue-600' },
    { name: 'معدل الحضور (اليوم)', value: loading ? '...' : `${attendanceRate}%`, icon: Activity, color: 'bg-emerald-600' },
    { name: 'إجازات قيد المراجعة', value: loading ? '...' : pendingLeaves.toString(), icon: AlertCircle, color: 'bg-amber-500' },
    { name: 'وظائف مفتوحة', value: loading ? '...' : openJobs.toString(), icon: Briefcase, color: 'bg-indigo-600' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">لوحة القيادة</h1>
          <p className="mt-2 text-base text-slate-500">نظرة عامة على نشاط الموارد البشرية اليوم.</p>
        </div>
      </div>

      {/* Big Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <a href="/attendance" className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-3xl shadow-sm transition-all duration-200 hover:shadow-md group">
          <div className="bg-white/20 p-3 rounded-2xl group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold">رفع ملف الحضور (Excel)</span>
        </a>
        <a href="/payroll" className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white p-6 rounded-3xl shadow-sm transition-all duration-200 hover:shadow-md group">
          <div className="bg-white/20 p-3 rounded-2xl group-hover:scale-110 transition-transform">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold">معالجة الرواتب</span>
        </a>
        <button 
          onClick={handleExportExcel}
          disabled={exporting}
          className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white p-6 rounded-3xl shadow-sm transition-all duration-200 hover:shadow-md group disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <div className="bg-white/20 p-3 rounded-2xl group-hover:scale-110 transition-transform">
            {exporting ? <RefreshCw className="w-6 h-6 text-white animate-spin" /> : <Download className="w-6 h-6 text-white" />}
          </div>
          <span className="text-lg font-bold">{exporting ? 'جاري التصدير...' : 'Export Excel'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.name} className="bg-white overflow-hidden rounded-3xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md hover:border-slate-200">
            <div className="flex items-center">
              <div className={`flex-shrink-0 rounded-2xl p-3 ${item.color} bg-opacity-10`}>
                <item.icon className={`h-6 w-6 ${item.color.replace('bg-', 'text-')}`} aria-hidden="true" />
              </div>
              <div className="mr-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-bold text-slate-500 truncate">{item.name}</dt>
                  <dd className="flex items-baseline mt-1">
                    <div className="text-2xl font-black text-slate-900">{item.value}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <FileText className="w-5 h-5 ml-2 text-blue-600" />
              تقرير الحضور اليومي
            </h2>
            <a href="/attendance" className="text-sm font-bold text-blue-600 hover:text-blue-700">عرض الكل</a>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
          ) : attendanceReport.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              لا توجد بيانات حضور لليوم.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">الموظف</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">الحضور</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">الانصراف</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">الحالة</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {attendanceReport.slice(0, 5).map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                        {record.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">
                        {record.first_punch || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">
                        {record.last_punch || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                          record.status === 'حاضر' ? 'bg-emerald-100 text-emerald-800' :
                          record.status === 'غياب' ? 'bg-red-100 text-red-800' :
                          record.status === 'تأخير' ? 'bg-amber-100 text-amber-800' :
                          record.status === 'إضافي' ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <Activity className="w-5 h-5 ml-2 text-blue-600" />
              سجل النشاط المباشر
            </h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
          ) : recentActivity.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              لا توجد نشاطات حديثة لعرضها اليوم.
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentActivity.map((activity) => (
                <li key={activity.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full ml-4 ${
                        activity.type === 'check_in' ? 'bg-emerald-500' :
                        activity.type === 'check_out' ? 'bg-slate-400' :
                        activity.type === 'mission' ? 'bg-indigo-500' : 'bg-blue-500'
                      }`}></div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{activity.full_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{activity.action}</p>
                      </div>
                    </div>
                    <div className="text-sm font-mono font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                      {activity.time}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

