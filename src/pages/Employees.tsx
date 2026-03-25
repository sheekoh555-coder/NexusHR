import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { Plus, Search, User as UserIcon, Building2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Employees() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state for Quick Add
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .insert([{ full_name: fullName, employee_id: employeeId }]);

      if (error) {
        console.log(error);
        throw error;
      }

      setShowAddModal(false);
      setFullName('');
      setEmployeeId('');
      fetchEmployees();
      toast.success('تم الحفظ بنجاح');
    } catch (error) {
      console.log(error);
      alert('حدث خطأ أثناء الحفظ. يرجى التحقق من الاتصال بقاعدة البيانات.');
      toast.error('خطأ في الربط ❌');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">الموظفين</h1>
          <p className="mt-2 text-base text-slate-500">إدارة سجلات الموظفين وإضافة موظفين جدد.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        >
          <Plus className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
          إضافة سريعة
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center bg-white">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 right-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 mr-4" aria-hidden="true" />
            </div>
            <input
              type="text"
              className="block w-full pr-12 pl-4 py-3 border border-slate-200 rounded-2xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all focus:bg-white"
              placeholder="البحث بالاسم أو رقم الملف..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  الاسم
                </th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  رقم الملف
                </th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  القسم
                </th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-500 font-medium">
                    جاري التحميل...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-500 font-medium">
                    لا يوجد موظفين حالياً. انقر على "إضافة سريعة" للبدء.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100">
                          {employee.photo_url ? (
                            <img className="h-12 w-12 object-cover" src={employee.photo_url} alt="" />
                          ) : (
                            <UserIcon className="h-6 w-6 text-blue-500" />
                          )}
                        </div>
                        <div className="mr-5">
                          <div className="text-sm font-bold text-slate-900">{employee.full_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm text-slate-600 font-mono bg-slate-100 inline-flex px-3 py-1.5 rounded-xl font-medium">{employee.employee_id}</div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-slate-700">
                        <Building2 className="w-4 h-4 ml-2 text-slate-400" />
                        عام
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" />
                        نشط
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAddModal(false)}>
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative inline-block align-bottom bg-white rounded-3xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-slate-100">
              <form onSubmit={handleQuickAdd}>
                <div className="bg-white px-8 pt-8 pb-6">
                  <div className="mb-8 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-50 mb-4">
                      <UserIcon className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">إضافة سريعة</h3>
                    <p className="text-sm text-slate-500 mt-2">أدخل البيانات الأساسية للموظف الجديد.</p>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">الاسم الكامل</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        placeholder="مثال: أحمد محمد"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">رقم الملف (Employee ID)</label>
                      <input
                        type="text"
                        required
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white font-mono text-left"
                        placeholder="EMP-001"
                        dir="ltr"
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
                    {saving ? 'جاري الحفظ...' : 'حفظ الموظف'}
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
