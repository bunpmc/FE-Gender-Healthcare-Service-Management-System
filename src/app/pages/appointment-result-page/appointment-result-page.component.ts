import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { BookingService } from '../../services/booking.service';
import { AppointmentCreateRequest } from '../../models/booking.model';

interface AppointmentResult {
  success: boolean;
  message: string;
  appointmentData?: AppointmentCreateRequest;
  bookingDetails?: {
    appointment_date: string;
    appointment_time: string;
    doctor_id: string;
    service_id?: string;
    appointment_status: string;
  };
  responseData?: {
    appointment?: {
      appointment_id?: string;
      guest_appointment_id?: string;
      appointment_date: string;
      appointment_time: string;
      doctor_id: string;
      appointment_status: string;
    };
    slot_info?: {
      doctor_slot_id: string;
      slot_date: string;
      slot_time: string;
    };
  };
  errorDetails?: string;
}

@Component({
  selector: 'app-appointment-result',
  standalone: true,
  imports: [CommonModule, TranslateModule, HeaderComponent, FooterComponent],
  templateUrl: './appointment-result-page.component.html',
  styleUrl: './appointment-result-page.component.css',
})
export class AppointmentResultComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);

  result: AppointmentResult | null = null;
  isLoading = true;
  isProcessing = false;

  ngOnInit(): void {
    console.log('🎯 Appointment Result Page - Starting initialization');

    // Get appointment data from sessionStorage
    const storedResult = sessionStorage.getItem('appointmentResult');
    if (!storedResult) {
      console.log(
        '❌ No appointment data found, redirecting to appointment page'
      );
      this.router.navigate(['/appointment']);
      return;
    }

    try {
      const appointmentData = JSON.parse(storedResult);
      console.log('📋 Retrieved appointment data:', appointmentData);

      // If this is already a processed result (success = true), just display it
      if (appointmentData.success === true) {
        this.result = appointmentData;
        this.isLoading = false;
        sessionStorage.removeItem('appointmentResult');
        return;
      }

      // If we have appointment data to process, create the appointment
      if (appointmentData.appointmentData) {
        this.processAppointment(appointmentData);
      } else {
        // Invalid data structure
        this.result = {
          success: false,
          message: 'Invalid appointment data received',
          errorDetails:
            'The appointment data structure is invalid. Please try booking again.',
        };
        this.isLoading = false;
        sessionStorage.removeItem('appointmentResult');
      }
    } catch (error) {
      console.error('❌ Error parsing appointment data:', error);
      this.result = {
        success: false,
        message: 'Error processing appointment data',
        errorDetails:
          'Failed to parse appointment information. Please try booking again.',
      };
      this.isLoading = false;
      sessionStorage.removeItem('appointmentResult');
    }
  }

  private processAppointment(appointmentData: any): void {
    console.log('🔄 Processing appointment creation...');
    this.isProcessing = true;
    this.isLoading = true;

    // Create the appointment using the booking service
    this.bookingService
      .createAppointment(appointmentData.appointmentData)
      .subscribe({
        next: (response) => {
          console.log('📥 Appointment creation response:', response);

          if (response.success) {
            // Success - store the result
            this.result = {
              success: true,
              message: response.message || 'Appointment created successfully!',
              appointmentData: appointmentData.appointmentData,
              bookingDetails: appointmentData.bookingDetails,
              responseData: {
                appointment: response.appointment_details || {
                  appointment_id: response.appointment_id,
                  guest_appointment_id: response.guest_appointment_id,
                  appointment_date:
                    appointmentData.bookingDetails?.appointment_date,
                  appointment_time:
                    appointmentData.bookingDetails?.appointment_time,
                  doctor_id: appointmentData.bookingDetails?.doctor_id,
                  appointment_status: 'pending',
                },
              },
            };
            console.log('✅ Appointment created successfully');
          } else {
            // API returned success: false
            this.result = {
              success: false,
              message: response.message || 'Failed to create appointment',
              appointmentData: appointmentData.appointmentData,
              bookingDetails: appointmentData.bookingDetails,
              errorDetails:
                response.message ||
                'The appointment could not be created. Please try again or contact support.',
            };
            console.log('❌ Appointment creation failed:', response.message);
          }

          this.isLoading = false;
          this.isProcessing = false;
          sessionStorage.removeItem('appointmentResult');
        },
        error: (error) => {
          console.error('❌ Error creating appointment:', error);

          // Network or other error
          this.result = {
            success: false,
            message: 'Failed to create appointment',
            appointmentData: appointmentData.appointmentData,
            bookingDetails: appointmentData.bookingDetails,
            errorDetails: `Error: ${
              error.message ||
              'Network error occurred. Please check your connection and try again.'
            }`,
          };

          this.isLoading = false;
          this.isProcessing = false;
          sessionStorage.removeItem('appointmentResult');
        },
      });
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  goToAppointment(): void {
    this.router.navigate(['/appointment']);
  }

  formatSchedule(schedule: string): string {
    const scheduleMap: { [key: string]: string } = {
      Morning: this.translate.instant('APPOINTMENT.SCHEDULE.MORNING'),
      Afternoon: this.translate.instant('APPOINTMENT.SCHEDULE.AFTERNOON'),
      Evening: this.translate.instant('APPOINTMENT.SCHEDULE.EVENING'),
    };
    return scheduleMap[schedule] || schedule;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatTime(timeString: string): string {
    if (!timeString) return '';
    return timeString.substring(0, 5); // Remove seconds
  }

  getAppointmentId(): string {
    if (!this.result?.responseData?.appointment) return '';
    return (
      this.result.responseData.appointment.appointment_id ||
      this.result.responseData.appointment.guest_appointment_id ||
      ''
    );
  }
}
