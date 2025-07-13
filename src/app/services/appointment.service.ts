import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, of, switchMap } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { AuthService } from './auth.service';
import {
  Appointment,
  GuestAppointment,
  Guest,
  AppointmentCreateRequest,
  AppointmentResponse,
  VisitTypeEnum,
  ScheduleEnum,
} from '../models/booking.model';

@Injectable({
  providedIn: 'root',
})
export class AppointmentService {
  private supabase: SupabaseClient;
  private authService = inject(AuthService);

  constructor() {
    console.log('🔧 Initializing AppointmentService...');
    console.log('🔧 Supabase URL:', environment.supabaseUrl);
    console.log(
      '🔧 Supabase Key (first 20 chars):',
      environment.supabaseKey?.substring(0, 20) + '...'
    );

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    console.log('✅ Supabase client created successfully');
  }

  /**
   * Create appointment for logged-in user or guest
   */
  createAppointment(
    request: AppointmentCreateRequest
  ): Observable<AppointmentResponse> {
    console.log('🚀 Starting appointment creation process...');
    console.log('📋 Request data:', JSON.stringify(request, null, 2));

    return this.authService.currentUser$.pipe(
      switchMap((currentUser) => {
        console.log('👤 Current user:', currentUser ? 'Logged in' : 'Guest');
        console.log('👤 User details:', currentUser);

        if (currentUser && currentUser.patientId) {
          console.log(
            '✅ Creating appointment for logged-in user with patient ID:',
            currentUser.patientId
          );
          return from(
            this.createUserAppointment(request, currentUser.patientId)
          );
        } else {
          console.log('✅ Creating appointment for guest user');
          return from(this.createGuestAppointment(request));
        }
      }),
      catchError((error) => {
        console.error('❌ CRITICAL ERROR in createAppointment:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        return of({
          success: false,
          message: `Appointment creation failed: ${
            error.message || 'Unknown error'
          }`,
        });
      })
    );
  }

  /**
   * Create appointment for logged-in user
   */
  private async createUserAppointment(
    request: AppointmentCreateRequest,
    patientId: string
  ): Promise<AppointmentResponse> {
    console.log('👤 Creating USER appointment...');
    console.log('👤 Patient ID:', patientId);

    try {
      // Map schedule to database enum format
      const schedule = this.mapScheduleToEnum(request.schedule);
      console.log('📅 Mapped schedule:', schedule);

      // Prepare appointment data
      const appointmentData: Partial<Appointment> = {
        patient_id: patientId,
        phone: request.phone,
        email: request.email,
        visit_type: request.visit_type,
        schedule: schedule,
        message: request.message,
        doctor_id: request.doctor_id,
        category_id: request.category_id,
        slot_id: request.slot_id,
        preferred_date: request.preferred_date,
        preferred_time: request.preferred_time,
        appointment_status: 'pending',
      };

      console.log(
        '📋 Appointment data to insert:',
        JSON.stringify(appointmentData, null, 2)
      );

      // If slot is selected, set appointment date and time from slot
      if (request.slot_id) {
        console.log('🕐 Fetching slot details for slot ID:', request.slot_id);
        const slotDetails = await this.getSlotDetails(request.slot_id);
        console.log('🕐 Slot details:', slotDetails);

        if (slotDetails) {
          appointmentData.appointment_date = slotDetails.slot_date;
          appointmentData.appointment_time = slotDetails.slot_time;
          console.log('✅ Updated appointment with slot date/time:', {
            date: slotDetails.slot_date,
            time: slotDetails.slot_time,
          });
        } else {
          console.warn(
            '⚠️ No slot details found for slot ID:',
            request.slot_id
          );
        }
      }

      console.log('💾 Inserting appointment into database...');
      // Insert appointment into database
      const { data, error } = await this.supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      console.log('💾 Database response:', { data, error });

      if (error) {
        console.error('❌ Database error:', error);
        throw new Error(
          `Database error: ${error.message} (Code: ${error.code})`
        );
      }

      console.log('✅ User appointment created successfully:', data);
      return {
        success: true,
        appointment_id: data.appointment_id,
        message: 'Appointment created successfully!',
        appointment_details: data,
      };
    } catch (error: any) {
      console.error('❌ ERROR in createUserAppointment:', error);
      console.error('❌ Error stack:', error.stack);
      return {
        success: false,
        message: `Failed to create user appointment: ${
          error.message || 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Create appointment for guest user
   */
  private async createGuestAppointment(
    request: AppointmentCreateRequest
  ): Promise<AppointmentResponse> {
    console.log('👥 Creating GUEST appointment...');

    try {
      // First, create or get guest record
      console.log('👥 Creating/getting guest record...');
      const guestId = await this.createOrGetGuest({
        full_name: request.full_name,
        email: request.email,
        phone: request.phone,
        gender: request.gender,
      });
      console.log('👥 Guest ID:', guestId);

      // Map schedule to database enum format
      const schedule = this.mapScheduleToEnum(request.schedule);
      console.log('📅 Mapped schedule:', schedule);

      // Prepare guest appointment data
      const guestAppointmentData: Partial<GuestAppointment> = {
        guest_id: guestId,
        phone: request.phone,
        email: request.email,
        visit_type: request.visit_type,
        schedule: schedule,
        message: request.message,
        doctor_id: request.doctor_id,
        category_id: request.category_id,
        slot_id: request.slot_id,
        preferred_date: request.preferred_date,
        preferred_time: request.preferred_time,
        appointment_status: 'pending',
      };

      console.log(
        '📋 Guest appointment data to insert:',
        JSON.stringify(guestAppointmentData, null, 2)
      );

      // If slot is selected, set appointment date and time from slot
      if (request.slot_id) {
        console.log('🕐 Fetching slot details for slot ID:', request.slot_id);
        const slotDetails = await this.getSlotDetails(request.slot_id);
        console.log('🕐 Slot details:', slotDetails);

        if (slotDetails) {
          guestAppointmentData.appointment_date = slotDetails.slot_date;
          guestAppointmentData.appointment_time = slotDetails.slot_time;
          console.log('✅ Updated guest appointment with slot date/time:', {
            date: slotDetails.slot_date,
            time: slotDetails.slot_time,
          });
        } else {
          console.warn(
            '⚠️ No slot details found for slot ID:',
            request.slot_id
          );
        }
      }

      console.log('💾 Inserting guest appointment into database...');
      // Insert guest appointment into database
      const { data, error } = await this.supabase
        .from('guest_appointments')
        .insert(guestAppointmentData)
        .select()
        .single();
      console.log('💾 Guest appointment created successfully:', data);
      console.log('💾 Database response:', { data, error });

      if (error) {
        console.error('❌ Database error:', error);
        throw new Error(
          `Database error: ${error.message} (Code: ${error.code})`
        );
      }

      return {
        success: true,
        guest_appointment_id: data.guest_appointment_id,
        message: 'Appointment created successfully!',
        appointment_details: data,
      };
    } catch (error) {
      console.error('Error creating guest appointment:', error);
      return {
        success: false,
        message: 'Failed to create appointment. Please try again.',
      };
    }
  }

  /**
   * Create or get existing guest record
   */
  private async createOrGetGuest(guestData: Partial<Guest>): Promise<string> {
    try {
      // First, try to find existing guest by email
      const { data: existingGuest, error: findError } = await this.supabase
        .from('guests')
        .select('guest_id')
        .eq('email', guestData.email)
        .single();

      if (existingGuest && !findError) {
        return existingGuest.guest_id;
      }

      // If guest doesn't exist, create new one
      const { data: newGuest, error: createError } = await this.supabase
        .from('guests')
        .insert(guestData)
        .select('guest_id')
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      return newGuest.guest_id;
    } catch (error) {
      console.error('Error creating/getting guest:', error);
      throw error;
    }
  }

  /**
   * Get slot details by slot ID
   */
  private async getSlotDetails(slotId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('doctor_slot_assignments')
        .select('slot_date, slot_time')
        .eq('doctor_slot_id', slotId)
        .single();

      if (error) {
        console.error('Error fetching slot details:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching slot details:', error);
      return null;
    }
  }

  /**
   * Map schedule string to database enum
   */
  private mapScheduleToEnum(schedule: string): ScheduleEnum {
    const scheduleMap: { [key: string]: ScheduleEnum } = {
      Morning: ScheduleEnum.MORNING,
      Afternoon: ScheduleEnum.AFTERNOON,
      Evening: ScheduleEnum.EVENING,
      morning: ScheduleEnum.MORNING,
      afternoon: ScheduleEnum.AFTERNOON,
      evening: ScheduleEnum.EVENING,
      specific_time: ScheduleEnum.SPECIFIC_TIME,
    };

    return scheduleMap[schedule] || ScheduleEnum.SPECIFIC_TIME;
  }

  /**
   * Get appointment by ID (for logged-in users)
   */
  getAppointmentById(appointmentId: string): Observable<Appointment | null> {
    return from(
      this.supabase
        .from('appointments')
        .select('*')
        .eq('appointment_id', appointmentId)
        .single()
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      }),
      catchError((error) => {
        console.error('Error fetching appointment:', error);
        return of(null);
      })
    );
  }

  /**
   * Get guest appointment by ID
   */
  getGuestAppointmentById(
    guestAppointmentId: string
  ): Observable<GuestAppointment | null> {
    return from(
      this.supabase
        .from('guest_appointments')
        .select('*')
        .eq('guest_appointment_id', guestAppointmentId)
        .single()
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      }),
      catchError((error) => {
        console.error('Error fetching guest appointment:', error);
        return of(null);
      })
    );
  }
}
