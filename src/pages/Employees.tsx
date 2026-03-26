import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { Plus, Search, User as UserIcon, Building2, CheckCircle2, Edit, Trash2, Eye, Upload, FileText, X, Image, File, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Employees() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    employee_id: '',
    department: '',
    job_title: '',
    base_salary: 0,
  });
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

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setFormData({
      full_name: '',
      employee_id: '',
      department: '',
      job_title: '',
      base_salary: 0,
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (employee: Profile) => {
    setIsEditing(true);
    setSelectedEmployee(employee);
    setFormData({
      full_name: employee.full_name || '',
      employee_id: employee.employee_id || '',
      department: employee.department || '',
      job_title: employee.job_title || '',
      base_salary: employee.base_salary || 0,
    });
    setShowAddModal(true);
  };

  const fetchDocuments = async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code !== '42P01') console.error(error);
      } else {
        setDocuments(data || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenProfile = (employee: Profile) => {
    setSelectedEmployee(employee);
    fetchDocuments(employee.id);
    setShowProfileModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف الموظف بنجاح');
      fetchEmployees();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const uploadDocument = async (file: File) => {
    if (!selectedEmployee) return;
    setUploadingDoc(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedEmployee.id}-${Math.random()}.${fileExt}`;
      const filePath = `${selectedEmployee.id}/${fileName}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
        
      // Save to database
      const { error: dbError } = await supabase
        .from('employee_documents')
        .insert([{
          employee_id: selectedEmployee.id,
          name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          size: file.size
        }]);
        
      if (dbError) throw dbError;
      
      toast.success('تم رفع المستند بنجاح');
      fetchDocuments(selectedEmployee.id);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error('حدث خطأ أثناء رفع المستند. تأكد من إعداد Storage و Table.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadDocument(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDoc(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadDocument(e.dataTransfer.files[0]);
    }
  };

  const getFileIcon = (type: string) => {
    if (!type) return <File className="w-6 h-6 text-slate-500" />;
    if (type.includes('pdf')) return <FileText className="w-6 h-6 text-red-500" />;
    if (type.includes('image')) return <Image className="w-6 h-6 text-blue-500" />;
    return <File className="w-6 h-6 text-slate-500" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDeleteDocument = async (docId: string, fileUrl: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستند؟')) return;
    
    try {
      const urlParts = fileUrl.split('/documents/');
      if (urlParts.length > 1) {
         await supabase.storage.from('documents').remove([urlParts[1]]);
      }
      
      const { error } = await supabase
        .from('employee_documents')
        .delete()
        .eq('id', docId);
        
      if (error) throw error;
      
      toast.success('تم حذف المستند بنجاح');
      if (selectedEmployee) fetchDocuments(selectedEmployee.id);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEditing && selectedEmployee) {
        const { error } = await supabase
          .from('profiles')
          .update(formData)
          .eq('id', selectedEmployee.id);

        if (error) throw error;
        toast.success('تم التحديث بنجاح');
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert([formData]);

        if (error) throw error;
        toast.success('تمت الإضافة بنجاح');
      }

      setShowAddModal(false);
      fetchEmployees();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">الموظفين</h1>
          <p className="mt-2 text-base text-slate-500">إدارة سجلات الموظفين وإضافة موظفين جدد.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        >
          <Plus className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
          إضافة موظف
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 border border-slate-200 rounded-2xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all focus:bg-white"
              placeholder="البحث بالاسم، رقم الملف، أو القسم..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الاسم</th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">رقم الملف</th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">القسم / الوظيفة</th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الحالة</th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-500 font-medium">جاري التحميل...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-500 font-medium">
                    لا يوجد موظفين مطابقين للبحث.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100">
                          {employee.photo_url ? (
                            <img className="h-10 w-10 object-cover" src={employee.photo_url} alt="" />
                          ) : (
                            <UserIcon className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-bold text-slate-900">{employee.full_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm text-slate-600 font-mono bg-slate-100 inline-flex px-3 py-1.5 rounded-xl font-medium">{employee.employee_id}</div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{employee.department || '---'}</div>
                      <div className="text-xs text-slate-500">{employee.job_title || '---'}</div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" />
                        نشط
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-500">
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenProfile(employee)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="عرض الملف">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleOpenEditModal(employee)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="تعديل">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(employee.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="حذف">
                          <Trash2 className="w-4 h-4" />
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
                    <h3 className="text-2xl font-bold text-slate-900">{isEditing ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h3>
                    <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">الاسم الكامل</label>
                      <input
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">رقم الملف</label>
                        <input
                          type="text"
                          required
                          value={formData.employee_id}
                          onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                          className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white font-mono text-left"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">الراتب الأساسي</label>
                        <input
                          type="number"
                          value={formData.base_salary}
                          onChange={(e) => setFormData({...formData, base_salary: Number(e.target.value)})}
                          className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">القسم</label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => setFormData({...formData, department: e.target.value})}
                          className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">المسمى الوظيفي</label>
                        <input
                          type="text"
                          value={formData.job_title}
                          onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                          className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm bg-slate-50 focus:bg-white"
                        />
                      </div>
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

      {/* Profile Modal */}
      {showProfileModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowProfileModal(false)}>
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative inline-block align-bottom bg-white rounded-3xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full border border-slate-100">
              <div className="bg-white px-8 pt-8 pb-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                      {selectedEmployee.photo_url ? (
                        <img className="h-16 w-16 rounded-2xl object-cover" src={selectedEmployee.photo_url} alt="" />
                      ) : (
                        <UserIcon className="h-8 w-8" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{selectedEmployee.full_name}</h3>
                      <p className="text-slate-500">{selectedEmployee.job_title || 'بدون مسمى وظيفي'} - {selectedEmployee.department || 'بدون قسم'}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-500 p-2 bg-slate-50 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-sm text-slate-500 mb-1">رقم الملف</p>
                    <p className="font-mono font-bold text-slate-900">{selectedEmployee.employee_id}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-sm text-slate-500 mb-1">الراتب الأساسي</p>
                    <p className="font-bold text-slate-900">{selectedEmployee.base_salary?.toLocaleString()} ر.س</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-sm text-slate-500 mb-1">تاريخ الإضافة</p>
                    <p className="font-bold text-slate-900">{new Date(selectedEmployee.created_at).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-sm text-slate-500 mb-1">الحالة</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">نشط</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-slate-900">المستندات المرفقة</h4>
                  </div>
                  
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingDoc(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingDoc(false); }}
                    onDrop={handleDocDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all mb-6 ${
                      isDraggingDoc ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                    }`}
                  >
                    <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${isDraggingDoc ? 'text-blue-500' : 'text-slate-400'}`} />
                    <p className="text-sm font-bold text-slate-700 mb-1">اسحب وأفلت المستند هنا</p>
                    <p className="text-xs text-slate-500 mb-4">يدعم PDF والصور (JPG, PNG)</p>
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-slate-200 text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                      {uploadingDoc ? 'جاري الرفع...' : 'اختيار ملف'}
                      <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleFileChange} disabled={uploadingDoc} />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {documents.length === 0 ? (
                      <div className="col-span-full p-8 text-center text-slate-500 border border-slate-100 rounded-2xl">
                        <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm">لا توجد مستندات مرفقة</p>
                      </div>
                    ) : (
                      documents.map((doc) => (
                        <div key={doc.id} className="border border-slate-100 rounded-2xl p-4 flex items-start justify-between hover:shadow-md transition-shadow bg-white">
                          <div className="flex items-start gap-3 overflow-hidden">
                            <div className="p-2 bg-slate-50 rounded-xl flex-shrink-0">
                              {getFileIcon(doc.file_type)}
                            </div>
                            <div className="min-w-0">
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors truncate block" title={doc.name}>
                                {doc.name}
                              </a>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                <span>{formatSize(doc.size)}</span>
                                <span>•</span>
                                <span>{new Date(doc.created_at).toLocaleDateString('ar-SA')}</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteDocument(doc.id, doc.file_url)} className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
