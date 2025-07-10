// ================== IMPORTS ==================
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { type UserLogin, type UserRegister } from '../models/user.model';
import {
  Observable,
  BehaviorSubject,
  from,
  map,
  catchError,
  of,
  finalize,
} from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Patient,
  DashboardPatient,
  UpcomingAppointment,
  RecentAppointment,
} from '../models/patient.model';
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
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

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
    // For development with mock authentication, return the current patient data
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.patient) {
      console.log(
        '✅ Successfully fetched patient data from Supabase:',
        currentUser.patient.full_name
      );
      return of({
        success: true,
        data: currentUser.patient,
      });
    }

    // For production, use the actual API call
    let token =
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('access_token');

    if (!token) {
      throw new Error('No access token found');
    }

    // Check if it's a mock token
    if (token === 'mock-token-for-development') {
      console.log('🔧 Mock token detected, using local patient data');
      const patient = this.getCurrentPatient();
      if (patient) {
        return of({
          success: true,
          data: patient,
        });
      } else {
        throw new Error('No patient data available in mock mode');
      }
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    // Call REST API endpoint for user profile
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
    )
      .pipe(
        map((response) => {
          if (response.error) {
            console.warn(
              'Test patient not found, using first available patient'
            );
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
            patient: patient,
          };

          console.log(
            'Mock authentication successful for patient:',
            patient.full_name,
            'ID:',
            patient.id
          );

          // Set a mock token for development
          localStorage.setItem('access_token', 'mock-token-for-development');

          this.currentUserSubject.next(mockUser);
        }),
        catchError((error) => {
          console.error('Mock authentication failed:', error);
          this.initializeFallbackAuth();
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Fallback authentication with first available patient
   */
  private initializeFallbackAuth(): void {
    from(this.supabase.from('patients').select('*').limit(1).single())
      .pipe(
        map((response) => {
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
            patient: patient,
          };

          console.log(
            'Fallback authentication successful for patient:',
            patient.full_name,
            'ID:',
            patient.id
          );

          // Set a mock token for development
          localStorage.setItem('access_token', 'mock-token-for-development');

          this.currentUserSubject.next(mockUser);
        }),
        catchError((error) => {
          console.error('Fallback authentication failed:', error);
          return of(null);
        })
      )
      .subscribe();
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
        patient: updatedPatient,
      };
      this.currentUserSubject.next(updatedUser);
    }
  }

  /**
   * Mock authentication with specific patient ID
   */
  mockAuthWithPatientId(patientId: string): Observable<boolean> {
    return from(
      this.supabase.from('patients').select('*').eq('id', patientId).single()
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }

        const patient = response.data;
        const mockUser: AuthUser = {
          id: 'mock-user-id',
          phone: patient.phone,
          email: patient.email,
          patientId: patient.id,
          patient: patient,
        };

        this.currentUserSubject.next(mockUser);
        return true;
      }),
      catchError((error) => {
        console.error('Mock authentication failed:', error);
        return of(false);
      })
    );
  }

  // ========== SUPABASE DATA METHODS ==========

  /**
   * Get dashboard-specific patient data with computed fields
   */
  getDashboardPatients(): Observable<DashboardPatient[]> {
    return this.currentUser$.pipe(
      map((user) => {
        if (!user || !user.patient) {
          console.log('⚠️ No patient data available');
          return [];
        }
        console.log(
          '✅ Successfully fetched dashboard patient data from Supabase:',
          user.patient.full_name
        );
        return [this.transformPatientForDashboard(user.patient)];
      })
    );
  }

  /**
   * Get patient count
   */
  getPatientCount(): Observable<number> {
    return from(
      this.supabase.from('patients').select('*', { count: 'exact', head: true })
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        const count = response.count || 0;
        console.log(
          '✅ Successfully fetched patient count from Supabase:',
          count
        );
        return count;
      }),
      catchError((error) => {
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
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data || [];
      }),
      catchError((error) => {
        console.error('Error fetching appointments:', error);
        return of([]);
      })
    );
  }

  /**
   * Get upcoming appointments for a specific patient with doctor information
   */
  getUpcomingAppointments(
    patientId: string
  ): Observable<UpcomingAppointment[]> {
    const today = new Date().toISOString().split('T')[0];

    return from(
      this.supabase
        .from('appointments')
        .select(
          `
          appointment_id,
          appointment_date,
          appointment_time,
          preferred_date,
          preferred_time,
          visit_type,
          appointment_status,
          doctor_id,
          doctor_details:doctor_id (
            doctor_id,
            staff_members:doctor_id (
              full_name
            )
          )
        `
        )
        .eq('patient_id', patientId)
        .gte('appointment_date', today)
        .in('appointment_status', ['pending'])
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })
        .limit(5)
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }

        return (response.data || [])
          .map((appointment) => {
            const appointmentDate =
              appointment.appointment_date || appointment.preferred_date;
            const appointmentTime =
              appointment.appointment_time || appointment.preferred_time;

            if (!appointmentDate) return null;

            const appointmentDateTime = new Date(
              `${appointmentDate}T${appointmentTime || '00:00'}`
            );
            const now = new Date();
            const timeDiff = appointmentDateTime.getTime() - now.getTime();
            const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            return {
              appointment_id: appointment.appointment_id,
              appointment_date: appointmentDate,
              appointment_time: appointmentTime || '00:00',
              doctor_name:
                (appointment.doctor_details as any)?.staff_members?.full_name ||
                'Unknown Doctor',
              visit_type: appointment.visit_type,
              appointment_status: appointment.appointment_status || 'pending',
              days_until: daysUntil,
              time_until: this.formatTimeUntil(timeDiff),
            } as UpcomingAppointment;
          })
          .filter(Boolean) as UpcomingAppointment[];
      }),
      catchError((error) => {
        console.error('Error fetching upcoming appointments:', error);
        return of([]);
      })
    );
  }

  /**
   * Get recent appointments for a specific patient
   */
  getRecentAppointments(patientId: string): Observable<RecentAppointment[]> {
    const today = new Date().toISOString().split('T')[0];

    return from(
      this.supabase
        .from('appointments')
        .select(
          `
          appointment_id,
          appointment_date,
          appointment_time,
          preferred_date,
          preferred_time,
          visit_type,
          appointment_status,
          doctor_id,
          doctor_details:doctor_id (
            doctor_id,
            staff_members:doctor_id (
              full_name
            )
          )
        `
        )
        .eq('patient_id', patientId)
        .lt('appointment_date', today)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })
        .limit(5)
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }

        return (response.data || [])
          .map((appointment) => {
            const appointmentDate =
              appointment.appointment_date || appointment.preferred_date;
            const appointmentTime =
              appointment.appointment_time || appointment.preferred_time;

            if (!appointmentDate) return null;

            const appointmentDateTime = new Date(
              `${appointmentDate}T${appointmentTime || '00:00'}`
            );
            const now = new Date();
            const timeDiff = now.getTime() - appointmentDateTime.getTime();
            const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

            return {
              appointment_id: appointment.appointment_id,
              appointment_date: appointmentDate,
              appointment_time: appointmentTime || '00:00',
              doctor_name:
                (appointment.doctor_details as any)?.staff_members?.full_name ||
                'Unknown Doctor',
              visit_type: appointment.visit_type,
              appointment_status: appointment.appointment_status || 'completed',
              days_ago: daysAgo,
            } as RecentAppointment;
          })
          .filter(Boolean) as RecentAppointment[];
      }),
      catchError((error) => {
        console.error('Error fetching recent appointments:', error);
        return of([]);
      })
    );
  }

  /**
   * Get dashboard-specific appointment data
   */
  getDashboardAppointments(
    patientId?: string
  ): Observable<DashboardAppointment[]> {
    return this.getAppointments(patientId).pipe(
      map((appointments) => {
        const dashboardAppointments = appointments.map((appointment) =>
          this.transformAppointmentForDashboard(appointment)
        );
        console.log(
          '✅ Successfully fetched dashboard appointments from Supabase:',
          dashboardAppointments.length
        );
        return dashboardAppointments;
      })
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
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        const count = response.count || 0;
        const statusText = status ? ` (${status})` : ' (all)';
        console.log(
          `✅ Successfully fetched appointment count${statusText} from Supabase:`,
          count
        );
        return count;
      }),
      catchError((error) => {
        console.error(
          `Error fetching appointment count for status ${status}:`,
          error
        );
        return of(0);
      })
    );
  }

  /**
   * Update patient profile information
   */
  updatePatientProfile(
    patientId: string,
    updates: Partial<Patient>
  ): Observable<Patient> {
    return from(
      this.supabase
        .from('patients')
        .update(updates)
        .eq('id', patientId)
        .select()
        .single()
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      }),
      catchError((error) => {
        console.error('Error updating patient profile:', error);
        throw error;
      })
    );
  }

  /**
   * Upload avatar image to Supabase Storage
   */
  uploadAvatar(
    filePath: string,
    file: File
  ): Promise<{ data: any; error: any }> {
    return this.supabase.storage.from('avatars').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
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

  /**
   * Test bucket access and list files (for debugging)
   */
  async testBucketAccess(): Promise<void> {
    try {
      // Test listing files in avatars bucket
      const { data, error } = await this.supabase.storage
        .from('avatars')
        .list('', {
          limit: 5,
          offset: 0,
        });

      if (error) {
        console.error('Bucket access error:', error);
      } else {
        console.log('Bucket accessible. Files found:', data?.length || 0);
        console.log('Sample files:', data?.slice(0, 3));
      }
    } catch (error) {
      console.error('Bucket test failed:', error);
    }
  }

  /**
   * Check if bucket exists and is accessible
   */
  async checkBucketStatus(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage.getBucket('avatars');

      if (error) {
        console.error('Bucket check error:', error);
        return false;
      }

      console.log('Bucket status:', data);
      return true;
    } catch (error) {
      console.error('Bucket status check failed:', error);
      return false;
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Format time difference into human-readable string
   */
  private formatTimeUntil(timeDiff: number): string {
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return hours > 0 ? `${days} days, ${hours} hours` : `${days} days`;
    } else if (hours > 0) {
      return minutes > 0
        ? `${hours} hours, ${minutes} minutes`
        : `${hours} hours`;
    } else if (minutes > 0) {
      return `${minutes} minutes`;
    } else {
      return 'Soon';
    }
  }

  /**
   * Transform Patient to DashboardPatient
   */
  private transformPatientForDashboard(patient: Patient): DashboardPatient {
    const age = patient.date_of_birth
      ? this.calculateAge(patient.date_of_birth)
      : undefined;

    return {
      id: patient.id,
      name: patient.full_name,
      email: patient.email,
      phone: patient.phone,
      gender: patient.gender,
      age: age,
      status: patient.patient_status,
      image_link: patient.image_link,
    };
  }

  /**
   * Transform Appointment to DashboardAppointment
   */
  private transformAppointmentForDashboard(
    appointment: Appointment
  ): DashboardAppointment {
    const appointmentDate =
      appointment.appointment_date ||
      appointment.preferred_date ||
      new Date().toISOString().split('T')[0];
    const appointmentTime =
      appointment.appointment_time || appointment.preferred_time || '00:00';

    return {
      id: appointment.appointment_id,
      title: this.getAppointmentTitle(appointment.visit_type),
      type: appointment.visit_type,
      time: this.formatTime(appointmentTime),
      date: appointmentDate,
      status: appointment.appointment_status || 'pending',
      schedule: appointment.schedule,
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

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
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
