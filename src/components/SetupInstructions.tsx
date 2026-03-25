import React from 'react';
import { Database } from 'lucide-react';

export default function SetupInstructions() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10">
        <div className="flex items-center justify-center h-20 w-20 bg-blue-50 rounded-3xl mb-8 mx-auto shadow-inner">
          <Database className="h-10 w-10 text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-10">إعداد قاعدة بيانات Supabase</h2>
        
        <div className="space-y-8 text-slate-700 text-right">
          <p className="text-lg text-slate-500 text-center">لكي يعمل النظام بشكل كامل، يجب إعداد الجداول التالية في مشروع Supabase الخاص بك:</p>
          
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm">1</span>
              جدول الموظفين (profiles)
            </h3>
            <pre className="text-left bg-slate-900 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed" dir="ltr">
{`create table profiles (
  id uuid default uuid_generate_v4() primary key,
  employee_id text unique not null,
  full_name text not null,
  first_name text,
  last_name text,
  department text,
  photo_url text,
  base_salary numeric not null default 10000,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`}
            </pre>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm">2</span>
              جدول الحضور (attendance)
            </h3>
            <pre className="text-left bg-slate-900 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed" dir="ltr">
{`create table attendance (
  id uuid default uuid_generate_v4() primary key,
  employee_id text references profiles(employee_id),
  date date not null,
  weekday text,
  first_punch time,
  last_punch time,
  total_hours numeric default 0,
  late_minutes integer default 0,
  overtime_minutes integer default 0,
  status text,
  notes text,
  unique(employee_id, date)
);`}
            </pre>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm">3</span>
              جدول الإجازات (leaves)
            </h3>
            <pre className="text-left bg-slate-900 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed" dir="ltr">
{`create table leaves (
  id uuid default uuid_generate_v4() primary key,
  employee_id text references profiles(employee_id),
  date date not null,
  type text not null, -- 'Sick', 'Casual', 'Annual'
  status text default 'Approved',
  unique(employee_id, date)
);`}
            </pre>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm">4</span>
              جدول الرواتب (payroll)
            </h3>
            <pre className="text-left bg-slate-900 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed" dir="ltr">
{`create table payroll (
  id uuid default uuid_generate_v4() primary key,
  employee_id text references profiles(employee_id),
  month text not null, -- format: YYYY-MM
  base_salary numeric not null,
  social_insurance_deduction numeric not null default 0,
  tax_deduction numeric not null default 0,
  penalty_deduction numeric not null default 0,
  overtime_addition numeric not null default 0,
  bonus_addition numeric not null default 0,
  net_salary numeric not null,
  unique(employee_id, month)
);`}
            </pre>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm">5</span>
              جدول التقارير الشهرية (monthly_reports)
            </h3>
            <pre className="text-left bg-slate-900 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed" dir="ltr">
{`create table monthly_reports (
  id uuid default uuid_generate_v4() primary key,
  employee_id text references profiles(employee_id),
  month text not null, -- format: YYYY-MM
  total_work_days integer default 0,
  total_late_minutes integer default 0,
  total_absence_days integer default 0,
  total_mission_days integer default 0,
  total_overtime_minutes integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(employee_id, month)
);`}
            </pre>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm">6</span>
              جدول الإعدادات (system_settings)
            </h3>
            <pre className="text-left bg-slate-900 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed" dir="ltr">
{`create table system_settings (
  id integer primary key default 1,
  work_start_time time default '08:00:00',
  work_end_time time default '16:00:00',
  ramadan_start_time time default '08:00:00',
  ramadan_end_time time default '14:00:00',
  social_insurance_pct numeric default 11,
  tax_pct numeric default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default settings row
insert into system_settings (id) values (1) on conflict (id) do nothing;`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
