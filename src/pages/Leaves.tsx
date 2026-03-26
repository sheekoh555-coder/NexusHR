import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, Plus, CheckCircle, XCircle, Clock, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Leaves() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    type: 'Annual',
    start_date: '',
    end_date: '',
    days: 1,
    status: 'قيد المراجعة'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLeaves();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name, employee_id');
      if (data) setEmployees(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leaves')
        .select('*, profiles(full_name, department)')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code !== '42P01') {
          console.error(error);
        }
      } else {
        setLeaves(data || []);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeaveStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leaves')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`تم تحديث الحالة إلى ${newStatus}`);
      fetchLeaves();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('leaves')
        .insert([{
          ...formData,
          date: formData.start_date // For backward compatibility with schema
        }]);
      if (error) throw error;
      toast.success('تم تقديم الطلب بنجاح');
      setShowAddModal(false);
      setFormData({ employee_id: '', type: 'Annual', start_date: '', end_date: '', days: 1, status: 'قيد المراجعة' });
      fetchLeaves();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تقديم الطلب');
    } finally {
      setSaving(false);
    }
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    const newData = { ...formData, [field]: value };
    if (newData.start_date && newData.end_date) {
      newData.days = calculateDays(newData.start_date, newData.end_date);
    }
    setFormData(newData);
  };

  const pendingLeaves = leaves.filter(l => l.status === 'قيد المراجعة').length;
  const approvedLeaves = leaves.filter(l => l.status === 'مقبول').length;
  const totalLeaves = leaves.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">إدارة الإجازات</h1>
          <p className="mt-2 text-base text-slate-500">تقديم طلبات الإجازة ومتابعة الأرصدة والموافقات.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200">
            <Plus className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
            طلب إجازة جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white overflow-hidden rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 rounded-2xl p-3 bg-blue-600 bg-opacity-10">
              <CalendarDays className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div>
            <div className="mr-4 w-0 flex-1">
              <dl>
                <dt className="text-sm font-bold text-slate-500 truncate">إجمالي الإجازات (الشهر)</dt>
                <dd className="flex items-baseline mt-1">
                  <div className="text-2xl font-black text-slate-900">{totalLeaves}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 rounded-2xl p-3 bg-amber-500 bg-opacity-10">
              <Clock className="h-6 w-6 text-amber-600" aria-hidden="true" />
            </div>
            <div className="mr-4 w-0 flex-1">
              <dl>
                <dt className="text-sm font-bold text-slate-500 truncate">طلبات قيد المراجعة</dt>
                <dd className="flex items-baseline mt-1">
                  <div className="text-2xl font-black text-slate-900">{pendingLeaves}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 rounded-2xl p-3 bg-emerald-600 bg-opacity-10">
              <CheckCircle className="h-6 w-6 text-emerald-600" aria-hidden="true" />
            </div>
            <div className="mr-4 w-0 flex-1">
              <dl>
                <dt className="text-sm font-bold text-slate-500 truncate">طلبات مقبولة</dt>
                <dd className="flex items-baseline mt-1">
                  <div className="text-2xl font-black text-slate-900">{approvedLeaves}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 flex items-center">
            <CalendarDays className="w-5 h-5 ml-2 text-blue-600" />
            سجل الإجازات
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">الموظف</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">نوع الإجازة</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">من تاريخ</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">إلى تاريخ</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">المدة</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">جاري التحميل...</td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <CalendarDays className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p>لا توجد طلبات إجازة حالياً.</p>
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{leave.profiles?.full_name || '---'}</div>
                      <div className="text-xs text-slate-500">{leave.profiles?.department || '---'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                      {leave.type === 'Annual' ? 'سنوية' : leave.type === 'Sick' ? 'مرضية' : leave.type === 'Casual' ? 'اضطرارية' : leave.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {leave.start_date || leave.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {leave.end_date || leave.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                      {leave.days || 1} أيام
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                        leave.status === 'مقبول' ? 'bg-emerald-100 text-emerald-800' :
                        leave.status === 'مرفوض' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {leave.status || 'قيد المراجعة'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      <div className="flex gap-2">
                        <button onClick={() => updateLeaveStatus(leave.id, 'مقبول')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="قبول">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => updateLeaveStatus(leave.id, 'مرفوض')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="رفض">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAddModal(false)}>
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative inline-block align-bottom bg-white rounded-3xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-100">
              <form onSubmit={handleAddLeave}>
                <div className="bg-white px-8 pt-8 pb-6">
                  <div className="mb-6 flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-slate-900">طلب إجازة جديد</h3>
                    <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">الموظف</label>
                      <select
                        required
                        value={formData.employee_id}
                        onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                      >
                        <option value="">اختر الموظف...</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.employee_id}>{emp.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">نوع الإجازة</label>
                      <select
                        required
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                      >
                        <option value="Annual">سنوية</option>
                        <option value="Sick">مرضية</option>
                        <option value="Casual">اضطرارية</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">من تاريخ</label>
                        <input
                          type="date"
                          required
                          value={formData.start_date}
                          onChange={(e) => handleDateChange('start_date', e.target.value)}
                          className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">إلى تاريخ</label>
                        <input
                          type="date"
                          required
                          value={formData.end_date}
                          onChange={(e) => handleDateChange('end_date', e.target.value)}
                          className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">عدد الأيام</label>
                      <input
                        type="number"
                        readOnly
                        value={formData.days}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-slate-100 text-slate-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-8 py-5 sm:flex sm:flex-row-reverse gap-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full inline-flex justify-center rounded-2xl border border-transparent shadow-sm px-6 py-3 bg-blue-600 text-base font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50 transition-all"
                  >
                    {saving ? 'جاري التقديم...' : 'تقديم الطلب'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-2xl border border-slate-200 shadow-sm px-6 py-3 bg-white text-base font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm transition-all"
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
