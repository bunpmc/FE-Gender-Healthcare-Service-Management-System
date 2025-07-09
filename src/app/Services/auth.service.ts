// ================== IMPORTS ==================
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { type UserLogin, type UserRegister } from '../models/user.model';
import { Observable, BehaviorSubject, from, map, catchError, of, finalize } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Patient, DashboardPatient } from '../models/patient.model';
import { Appointment, DashboardAppointment } from '../models/appointment.model';

export interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  patientId?: string;
  patient?: Patient;
}

// ================== SERVICE DECORATOR ==================
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase: SupabaseClient;
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // =========== CONSTRUCTOR ===========
  constructor(private http: HttpClient) {
    // Initialize Supabase client using environment configuration
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    // For development, mock authentication with first patient
    this.initializeMockAuth();
  }

  // =========== PRIVATE HEADER BUILDER ===========
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  // =========== REGISTER USER ===========
  registerUser(userRegisterData: UserRegister) {
    const phone = userRegisterData.phone.startsWith('0')
      ? '+84' + userRegisterData.phone.slice(1)
      : userRegisterData.phone;

    const body: UserRegister = {
      phone,
      password: userRegisterData.password,
    };

    return this.http.post(`${environment.apiEndpoint}/register`, body, {
      headers: this.getHeaders(),
    });
  }

  // =========== LOGIN ===========
  loginWithPhone(phone: string, password: string) {
    const formattedPhone = phone.startsWith('0')
      ? '+84' + phone.slice(1)
      : phone;

    const body: UserLogin = {
      phone: formattedPhone,
      password,
    };

    return this.http.post(`${environment.apiEndpoint}/login`, body, {
      headers: this.getHeaders(),
    });
  }

  // ================== FORGOT PASSWORD (GỬI OTP) ==================
  forgotPassword(phone: string): Observable<any> {
    const formattedPhone = phone.startsWith('0')
      ? '+84' + phone.slice(1)
      : phone;
    return this.http.post(
      `${environment.apiEndpoint}/forgot-password`,
      { phone: formattedPhone },
      { headers: this.getHeaders() }
    );
  }

  // ================== RESET PASSWORD (NHẬP OTP + MẬT KHẨU MỚI) ==================
  resetPassword(
    phone: string,
    otp: string,
    newPassword: string
  ): Observable<any> {
    const formattedPhone = phone.startsWith('0')
      ? '+84' + phone.slice(1)
      : phone;
    return this.http.post(
      `${environment.apiEndpoint}/reset-password`,
      {
        phone: formattedPhone,
        otp,
        password: newPassword,
      },
      { headers: this.getHeaders() }
    );
  }

  // =========== PROFILE ===========
  getUserProfile(): Observable<any> {
    let token =
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('access_token');

    if (!token) {
      throw new Error('No access token found');
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    // Call REST API endpoint cho user profile
    return this.http.get(`${environment.apiEndpoint}/me`, {
      headers,
    });
  }

  // =========== PATIENT STATE MANAGEMENT ===========

  /**
   * Initialize mock authentication for development
   */
  private initializeMockAuth(): void {
    // Mock authentication with patient that has appointments for testing
    const testPatientId = '69a25879-8618-4299-9e99-d4e22d5474b0'; // Patient with appointment

    from(
      this.supabase
        .from('patients')
        .select('*')
        .eq('id', testPatientId)
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          console.warn('Test patient not found, using first available patient');
          // Fallback to first patient if test patient not found
          this.initializeFallbackAuth();
          return;
        }

        const patient = response.data;
        const mockUser: AuthUser = {
          id: 'mock-user-id',
          phone: patient.phone,
          email: patient.email,
          patientId: patient.id,
          patient: patient
        };

        console.log('Mock authentication successful for patient:', patient.full_name, 'ID:', patient.id);
        this.currentUserSubject.next(mockUser);
      }),
      catchError(error => {
        console.error('Mock authentication failed:', error);
        this.initializeFallbackAuth();
        return of(null);
      })
    ).subscribe();
  }

  /**
   * Fallback authentication with first available patient
   */
  private initializeFallbackAuth(): void {
    from(
      this.supabase
        .from('patients')
        .select('*')
        .limit(1)
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          console.warn('No patients found for fallback auth');
          return;
        }

        const patient = response.data;
        const mockUser: AuthUser = {
          id: 'mock-user-id',
          phone: patient.phone,
          email: patient.email,
          patientId: patient.id,
          patient: patient
        };

        console.log('Fallback authentication successful for patient:', patient.full_name, 'ID:', patient.id);
        this.currentUserSubject.next(mockUser);
      }),
      catchError(error => {
        console.error('Fallback authentication failed:', error);
        return of(null);
      })
    ).subscribe();
  }

  /**
   * Get current user synchronously
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get current user as observable
   */
  getCurrentUser$(): Observable<AuthUser | null> {
    return this.currentUser$;
  }

  /**
   * Get current patient ID
   */
  getCurrentPatientId(): string | null {
    const user = this.getCurrentUser();
    return user?.patientId || null;
  }

  /**
   * Get current patient data
   */
  getCurrentPatient(): Patient | null {
    const user = this.getCurrentUser();
    return user?.patient || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Update current user's patient data
   */
  updateCurrentPatient(updatedPatient: Patient): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const updatedUser: AuthUser = {
        ...currentUser,
        patient: updatedPatient
      };
      this.currentUserSubject.next(updatedUser);
    }
  }

  /**
   * Mock authentication with specific patient ID
   */
  mockAuthWithPatientId(patientId: string): Observable<boolean> {
    return from(
      this.supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }

        const patient = response.data;
        const mockUser: AuthUser = {
          id: 'mock-user-id',
          phone: patient.phone,
          email: patient.email,
          patientId: patient.id,
          patient: patient
        };

        this.currentUserSubject.next(mockUser);
        return true;
      }),
      catchError(error => {
        console.error('Mock authentication failed:', error);
        return of(false);
      })
    );
  }

  // ========== SUPABASE DATA METHODS ==========

  /**
   * Fetch all patients from the database
   */
  getPatients(): Observable<Patient[]> {
    return from(
      this.supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data || [];
      }),
      catchError(error => {
        console.error('Error fetching patients:', error);
        return of([]);
      })
    );
  }

  /**
   * Get dashboard-specific patient data with computed fields
   */
  getDashboardPatients(): Observable<DashboardPatient[]> {
    return this.getPatients().pipe(
      map(patients => patients.map(patient => this.transformPatientForDashboard(patient)))
    );
  }

  /**
   * Get patient count
   */
  getPatientCount(): Observable<number> {
    return from(
      this.supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.count || 0;
      }),
      catchError(error => {
        console.error('Error fetching patient count:', error);
        return of(0);
      })
    );
  }

  /**
   * Fetch appointments from the database, optionally filtered by patient ID
   */
  getAppointments(patientId?: string): Observable<Appointment[]> {
    let query = this.supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by patient ID if provided
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    return from(query).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data || [];
      }),
      catchError(error => {
        console.error('Error fetching appointments:', error);
        return of([]);
      })
    );
  }

  /**
   * Get dashboard-specific appointment data
   */
  getDashboardAppointments(patientId?: string): Observable<DashboardAppointment[]> {
    return this.getAppointments(patientId).pipe(
      map(appointments => appointments.map(appointment => this.transformAppointmentForDashboard(appointment)))
    );
  }

  /**
   * Get appointment count by status
   */
  getAppointmentCountByStatus(status?: string): Observable<number> {
    let query = this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });

    if (status) {
      query = query.eq('appointment_status', status);
    }

    return from(query).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.count || 0;
      }),
      catchError(error => {
        console.error(`Error fetching appointment count for status ${status}:`, error);
        return of(0);
      })
    );
  }

  /**
   * Update patient profile information
   */
  updatePatientProfile(patientId: string, updates: Partial<Patient>): Observable<Patient> {
    return from(
      this.supabase
        .from('patients')
        .update(updates)
        .eq('id', patientId)
        .select()
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      }),
      catchError(error => {
        console.error('Error updating patient profile:', error);
        throw error;
      })
    );
  }

  /**
   * Upload avatar image to Supabase Storage
   */
  uploadAvatar(filePath: string, file: File): Promise<{ data: any; error: any }> {
    return this.supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
  }

  /**
   * Get public URL for avatar image
   */
  getAvatarPublicUrl(filePath: string): string {
    const { data } = this.supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // ========== HELPER METHODS ==========

  /**
   * Transform Patient to DashboardPatient
   */
  private transformPatientForDashboard(patient: Patient): DashboardPatient {
    const age = patient.date_of_birth ? this.calculateAge(patient.date_of_birth) : undefined;

    return {
      id: patient.id,
      name: patient.full_name,
      email: patient.email,
      phone: patient.phone,
      gender: patient.gender,
      age: age,
      status: patient.patient_status,
      image_link: patient.image_link
    };
  }

  /**
   * Transform Appointment to DashboardAppointment
   */
  private transformAppointmentForDashboard(appointment: Appointment): DashboardAppointment {
    const appointmentDate = appointment.appointment_date || appointment.preferred_date || new Date().toISOString().split('T')[0];
    const appointmentTime = appointment.appointment_time || appointment.preferred_time || '00:00';

    return {
      id: appointment.appointment_id,
      title: this.getAppointmentTitle(appointment.visit_type),
      type: appointment.visit_type,
      time: this.formatTime(appointmentTime),
      date: appointmentDate,
      status: appointment.appointment_status || 'pending',
      schedule: appointment.schedule
    };
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Get appointment title based on visit type
   */
  private getAppointmentTitle(visitType: string): string {
    switch (visitType) {
      case 'virtual':
        return 'Virtual Consultation';
      case 'internal':
        return 'In-Person Visit';
      case 'external':
        return 'External Referral';
      case 'consultation':
        return 'Medical Consultation';
      default:
        return 'Appointment';
    }
  }

  /**
   * Format time string for display
   */
  private formatTime(timeString: string): string {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      return timeString;
    }
  }
}
