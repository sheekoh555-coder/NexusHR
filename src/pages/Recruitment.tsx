import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Briefcase, Users, Plus, Search, Filter, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Recruitment() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [jobFormData, setJobFormData] = useState({
    title: '',
    department: '',
    status: 'مفتوح',
  });
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (jobsError) {
        if (jobsError.code !== '42P01') { // Ignore table not found
          console.error(jobsError);
        }
      } else {
        setJobs(jobsData || []);
      }

      // Fetch applications
      const { data: appsData, error: appsError } = await supabase
        .from('job_applications')
        .select('*, jobs(title)')
        .order('created_at', { ascending: false });

      if (appsError) {
        if (appsError.code !== '42P01') {
          console.error(appsError);
        }
      } else {
        setApplications(appsData || []);
      }
    } catch (error) {
      console.error('Error fetching recruitment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`تم تحديث الحالة إلى ${newStatus}`);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingJob(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .insert([jobFormData]);
      if (error) throw error;
      toast.success('تمت الإضافة بنجاح');
      setShowAddJobModal(false);
      setJobFormData({ title: '', department: '', status: 'مفتوح' });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSavingJob(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">إدارة التوظيف</h1>
          <p className="mt-2 text-base text-slate-500">نشر الوظائف الشاغرة ومتابعة المتقدمين.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddJobModal(true)} className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200">
            <Plus className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
            وظيفة جديدة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <Briefcase className="w-5 h-5 ml-2 text-blue-600" />
                الوظائف الشاغرة
              </h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center text-slate-500">جاري التحميل...</div>
              ) : jobs.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p>لا توجد وظائف شاغرة حالياً.</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {jobs.map((job) => (
                    <li key={job.id} className="p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900">{job.title}</h3>
                          <p className="text-sm text-slate-500 mt-1">{job.department}</p>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${job.status === 'مفتوح' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                          {job.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <Users className="w-5 h-5 ml-2 text-blue-600" />
                طلبات التوظيف
              </h2>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث..."
                    className="pl-4 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">المتقدم</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">الوظيفة</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">التاريخ</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">الحالة</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">جاري التحميل...</td>
                    </tr>
                  ) : applications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p>لا توجد طلبات توظيف حالياً.</p>
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900">{app.applicant_name}</div>
                          <div className="text-xs text-slate-500">{app.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {app.jobs?.title || '---'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(app.created_at).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                            app.status === 'مقبول' ? 'bg-emerald-100 text-emerald-800' :
                            app.status === 'مرفوض' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {app.status || 'قيد المراجعة'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          <div className="flex gap-2">
                            <button onClick={() => updateApplicationStatus(app.id, 'مقبول')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="قبول">
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button onClick={() => updateApplicationStatus(app.id, 'مرفوض')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="رفض">
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button onClick={() => updateApplicationStatus(app.id, 'مجدول للمقابلة')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="جدولة مقابلة">
                              <Clock className="w-5 h-5" />
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
        </div>
      </div>

      {/* Add Job Modal */}
      {showAddJobModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAddJobModal(false)}>
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative inline-block align-bottom bg-white rounded-3xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-100">
              <form onSubmit={handleAddJob}>
                <div className="bg-white px-8 pt-8 pb-6">
                  <div className="mb-6 flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-slate-900">إضافة وظيفة جديدة</h3>
                    <button type="button" onClick={() => setShowAddJobModal(false)} className="text-slate-400 hover:text-slate-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">المسمى الوظيفي</label>
                      <input
                        type="text"
                        required
                        value={jobFormData.title}
                        onChange={(e) => setJobFormData({...jobFormData, title: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">القسم</label>
                      <input
                        type="text"
                        required
                        value={jobFormData.department}
                        onChange={(e) => setJobFormData({...jobFormData, department: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">الحالة</label>
                      <select
                        value={jobFormData.status}
                        onChange={(e) => setJobFormData({...jobFormData, status: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                      >
                        <option value="مفتوح">مفتوح</option>
                        <option value="مغلق">مغلق</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-8 py-5 sm:flex sm:flex-row-reverse gap-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={savingJob}
                    className="w-full inline-flex justify-center rounded-2xl border border-transparent shadow-sm px-6 py-3 bg-blue-600 text-base font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50 transition-all"
                  >
                    {savingJob ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddJobModal(false)}
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
