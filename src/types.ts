export type SystemSettings = {
  id: number;
  work_start_time: string;
  work_end_time: string;
  ramadan_start_time: string;
  ramadan_end_time: string;
  social_insurance_pct: number;
  tax_pct: number;
};

export type Profile = {
  id: string; // UUID from Supabase
  employee_id: string; // File Number / Custom ID
  full_name: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  job_title?: string;
  photo_url?: string;
  base_salary: number;
  created_at: string;
};

export type AttendanceLog = {
  id: string;
  employee_id: string; // Links to Profile.employee_id
  date: string; // YYYY-MM-DD
  weekday?: string;
  first_punch: string | null; // ISO string or time
  last_punch: string | null; // ISO string or time
  total_hours: number;
  late_minutes: number;
  overtime_minutes: number;
  status?: string;
  notes?: string;
};

export type Leave = {
  id: string;
  employee_id: string;
  date: string;
  type: 'Sick' | 'Casual' | 'Annual';
  status: string;
};

export type MonthlyReport = {
  id: string;
  employee_id: string;
  month: string;
  total_work_days: number;
  total_late_minutes: number;
  total_absence_days: number;
  total_mission_days: number;
  total_overtime_minutes: number;
};

export type PreviewRecord = {
  employee_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  department: string;
  date: string;
  weekday: string;
  first_punch: string | null;
  last_punch: string | null;
  total_hours: number;
  late_minutes: number;
  overtime_minutes: number;
  status: string;
  notes: string;
  is_absent: boolean;
  is_early_departure: boolean;
  short_hours: boolean;
};

export type PayrollRecord = {
  id: string;
  employee_id: string;
  month: string; // YYYY-MM
  base_salary: number;
  social_insurance_deduction: number;
  tax_deduction: number;
  penalty_deduction: number;
  overtime_addition: number;
  bonus_addition: number;
  net_salary: number;
};
