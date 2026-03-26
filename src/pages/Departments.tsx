import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Users, Plus, Edit, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Departments() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data: depts, error: deptsError } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (deptsError) {
        if (deptsError.code !== '42P01') {
          console.error(deptsError);
        }
      } else {
        // Fetch employee counts
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('department');
          
        if (!profilesError && profiles && depts) {
          const deptCounts = profiles.reduce((acc: any, profile: any) => {
            if (profile.department) {
              acc[profile.department] = (acc[profile.department] || 0) + 1;
            }
            return acc;
          }, {});
          
          const deptsWithCounts = depts.map(d => ({
            ...d,
            employee_count: deptCounts[d.name] || 0
          }));
          
          setDepartments(deptsWithCounts);
        } else {
          setDepartments(depts || []);
        }
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setFormData({ name: '', description: '' });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (dept: any) => {
    setIsEditing(true);
    setSelectedDept(dept);
    setFormData({ name: dept.name, description: dept.description || '' });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم الحذف بنجاح');
      fetchDepartments();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing && selectedDept) {
        const { error } = await supabase
          .from('departments')
          .update(formData)
          .eq('id', selectedDept.id);
        if (error) throw error;
        toast.success('تم التحديث بنجاح');
      } else {
        const { error } = await supabase
          .from('departments')
          .insert([formData]);
        if (error) throw error;
        toast.success('تمت الإضافة بنجاح');
      }
      setShowAddModal(false);
      fetchDepartments();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">إدارة الأقسام</h1>
          <p className="mt-2 text-base text-slate-500">إنشاء وتعديل الأقسام والهيكل التنظيمي للشركة.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleOpenAddModal} className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200">
            <Plus className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
            إضافة قسم
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center text-slate-500 py-12">جاري التحميل...</div>
        ) : departments.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12 bg-white rounded-3xl shadow-sm border border-slate-100">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p>لا توجد أقسام مضافة حالياً.</p>
          </div>
        ) : (
          departments.map((dept) => (
            <div key={dept.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="mr-4">
                    <h3 className="text-lg font-bold text-slate-900">{dept.name}</h3>
                    <p className="text-sm text-slate-500">{dept.description || 'لا يوجد وصف'}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center text-sm text-slate-600 font-medium">
                  <Users className="w-4 h-4 ml-1.5 text-slate-400" />
                  {dept.employee_count || 0} موظف
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEditModal(dept)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="تعديل">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(dept.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAddModal(false)}>
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative inline-block align-bottom bg-white rounded-3xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-100">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-8 pt-8 pb-6">
                  <div className="mb-6 flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-slate-900">{isEditing ? 'تعديل القسم' : 'إضافة قسم جديد'}</h3>
                    <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">اسم القسم</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">الوصف</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        rows={3}
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
                    {saving ? 'جاري الحفظ...' : 'حفظ'}
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
