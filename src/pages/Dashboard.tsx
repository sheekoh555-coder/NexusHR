import React, { useState, useEffect } from 'react';
import { Users, Clock, Calculator, AlertCircle, Briefcase, Activity } from 'lucide-react';
import SetupInstructions from '../components/SetupInstructions';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  employee_id: string;
  full_name: string;
  action: string;
  time: string;
  type: 'check_in' | 'check_out' | 'mission' | 'upload';
}

export default function Dashboard() {
  const [totalEmployees, setTotalEmployees] = useState<number>(0);
  const [todayAttendance, setTodayAttendance] = useState<number>(0);
  const [totalPayroll, setTotalPayroll] = useState<number>(0);
  const [missingPunches, setMissingPunches] = useState<number>(0);
  const [activeMissions, setActiveMissions] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

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
    { name: 'إجمالي الرواتب (الشهر)', value: loading ? '...' : `${totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ر.س`, icon: Calculator, color: 'bg-blue-600' },
    { name: 'معدل الحضور (اليوم)', value: loading ? '...' : `${attendanceRate}%`, icon: Users, color: 'bg-emerald-600' },
    { name: 'بصمات مفقودة', value: loading ? '...' : missingPunches.toString(), icon: AlertCircle, color: 'bg-amber-500' },
    { name: 'مأموريات نشطة', value: loading ? '...' : activeMissions.toString(), icon: Briefcase, color: 'bg-indigo-600' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">لوحة القيادة</h1>
        <p className="mt-2 text-base text-slate-500">نظرة عامة على نشاط الموارد البشرية اليوم.</p>
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
  );
}

