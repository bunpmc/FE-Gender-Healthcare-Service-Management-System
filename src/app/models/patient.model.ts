// Patient model based on Supabase database schema
export interface Patient {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth?: string | null;
  gender: 'male' | 'female' | 'other';
  allergies?: {
    known_allergies?: string[];
  } | null;
  chronic_conditions?: {
    conditions?: string[];
  } | null;
  past_surgeries?: {
    surgeries?: string[];
  } | null;
  vaccination_status:
    | 'not_vaccinated'
    | 'partially_vaccinated'
    | 'fully_vaccinated';
  patient_status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
  image_link?: string | null;
  bio?: string | null;
}

// Dashboard-specific patient interface for display
export interface DashboardPatient {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  age?: number;
  status: string;
  lastVisit?: string;
  upcomingAppointments?: number;
  image_link?: string | null;
  nextAppointment?: UpcomingAppointment | null;
  recentAppointments?: RecentAppointment[];
}

// Upcoming appointment interface for patient dashboard
export interface UpcomingAppointment {
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  doctor_name?: string;
  visit_type: 'virtual' | 'internal' | 'external' | 'consultation';
  appointment_status: 'pending' | 'cancelled' | 'completed';
  days_until: number;
  time_until: string; // e.g., "2 days, 3 hours"
}

// Recent appointment interface for patient history
export interface RecentAppointment {
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  doctor_name?: string;
  visit_type: 'virtual' | 'internal' | 'external' | 'consultation';
  appointment_status: 'pending' | 'cancelled' | 'completed';
  days_ago: number;
}
