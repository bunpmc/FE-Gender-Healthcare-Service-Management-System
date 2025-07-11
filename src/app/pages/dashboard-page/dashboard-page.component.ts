import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, catchError, timeout, tap } from 'rxjs/operators';

import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { AuthService } from '../../services/auth.service';
import { DashboardPatient, Patient } from '../../models/patient.model';
import {
  DashboardAppointment,
  CalendarDay,
  DashboardState,
} from '../../models/appointment.model';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    FooterComponent,
    TranslateModule,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Make Math available in template
  Math = Math;
  isEditing = false;
  isProfileSaving = false;
  profileError: string | null = null;
  isUploadingAvatar = false;
  selectedAvatarFile: File | null = null;
  avatarPreviewUrl: string | null = null;

  // Calendar properties
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  today = new Date();
  calendarView: 'month' | 'week' | 'day' = 'month';
  showDatePicker = false;

  // dashboard data - will be populated from authenticated user
  dashboard = {
    full_name: '',
    bio: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '',
    image_link: '',
  };

  // Temporary data for editing
  editdashboard = { ...this.dashboard };

  // Dashboard state management - Updated to match interface
  dashboardState: DashboardState = {
    isLoading: false,
    error: null,
    patients: [],
    appointments: [],
    totalPatients: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
  };

  // Appointments data from Supabase
  appointments: DashboardAppointment[] = [];

  // Patients data from Supabase
  patients: DashboardPatient[] = [];

  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private translate: TranslateService
  ) {}

  // Day names for calendar
  get dayNames(): string[] {
    return [
      this.translate.instant('DASHBOARD.CALENDAR.DAYS.SUN'),
      this.translate.instant('DASHBOARD.CALENDAR.DAYS.MON'),
      this.translate.instant('DASHBOARD.CALENDAR.DAYS.TUE'),
      this.translate.instant('DASHBOARD.CALENDAR.DAYS.WED'),
      this.translate.instant('DASHBOARD.CALENDAR.DAYS.THU'),
      this.translate.instant('DASHBOARD.CALENDAR.DAYS.FRI'),
      this.translate.instant('DASHBOARD.CALENDAR.DAYS.SAT'),
    ];
  }

  // Current month name
  get currentMonthName(): string {
    const monthKeys = [
      'DASHBOARD.CALENDAR.MONTHS.JAN',
      'DASHBOARD.CALENDAR.MONTHS.FEB',
      'DASHBOARD.CALENDAR.MONTHS.MAR',
      'DASHBOARD.CALENDAR.MONTHS.APR',
      'DASHBOARD.CALENDAR.MONTHS.MAY',
      'DASHBOARD.CALENDAR.MONTHS.JUN',
      'DASHBOARD.CALENDAR.MONTHS.JUL',
      'DASHBOARD.CALENDAR.MONTHS.AUG',
      'DASHBOARD.CALENDAR.MONTHS.SEP',
      'DASHBOARD.CALENDAR.MONTHS.OCT',
      'DASHBOARD.CALENDAR.MONTHS.NOV',
      'DASHBOARD.CALENDAR.MONTHS.DEC',
    ];
    return this.translate.instant(monthKeys[this.currentMonth]);
  }

  // Appointment mapping to dates (day of month)
  appointmentMapping: { [key: number]: DashboardAppointment[] } = {};

  // Calendar days for display
  calendarDays: CalendarDay[] = [];

  ngOnInit() {
    console.log('🚀 Dashboard component initializing...');

    try {
      // Initialize calendar
      this.generateCalendarDays();
      console.log('📅 Calendar initialized');

      // Add click listener to close date picker when clicking outside
      document.addEventListener('click', this.onDocumentClick.bind(this));

      // Simple approach: Check if user is already authenticated and load data
      console.log('🔍 Checking authentication status...');
      const currentUser = this.authService.getCurrentUser();

      if (currentUser && currentUser.patient) {
        console.log(
          '👤 User already authenticated, loading dashboard data immediately...',
          {
            userId: currentUser.id,
            patientId: currentUser.patientId,
            patientName: currentUser.patient?.full_name,
          }
        );
        this.loadUserProfile();
        this.loadDashboardDataSimple();
      } else {
        console.log(
          '⏳ No authenticated user found, setting up authentication listener...'
        );
        // Fallback: Listen for authentication changes
        this.authService
          .getCurrentUser$()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (user) => {
              if (user && user.patient) {
                console.log(
                  '👤 User authenticated via subscription, loading data...'
                );
                this.loadUserProfile();
                this.loadDashboardDataSimple();
              }
            },
            error: (error) => {
              console.error('❌ Error in authentication subscription:', error);
              this.dashboardState.isLoading = false;
              this.dashboardState.error =
                'Authentication failed. Please refresh the page.';
            },
          });
      }

      console.log('✅ Dashboard initialization complete');
    } catch (error) {
      console.error('❌ Error during dashboard initialization:', error);
      this.dashboardState.error = 'Failed to initialize dashboard';
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Remove click listener
    document.removeEventListener('click', this.onDocumentClick.bind(this));
  }

  /**
   * Handle document click to close date picker when clicking outside
   */
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const datePickerContainer = target.closest('.month-picker-container');

    if (!datePickerContainer && this.showDatePicker) {
      this.showDatePicker = false;
    }
  }

  // ========== SUPABASE DATA LOADING METHODS ==========

  /**
   * Load user profile data from authenticated user
   */
  loadUserProfile(): void {
    try {
      const currentPatient = this.authService.getCurrentPatient();
      if (currentPatient) {
        console.log(
          '👤 Loading profile for patient:',
          currentPatient.full_name
        );
        this.dashboard = {
          full_name: currentPatient.full_name || '',
          bio: currentPatient.bio || '',
          phone: currentPatient.phone || '',
          email: currentPatient.email || '',
          date_of_birth: currentPatient.date_of_birth || '',
          gender: currentPatient.gender || 'other',
          image_link: currentPatient.image_link || '',
        };
        this.editdashboard = { ...this.dashboard };
        console.log('✅ Profile loaded successfully');
      } else {
        console.warn('⚠️ No current patient found, using default profile');
        // Set default empty profile
        this.dashboard = {
          full_name: 'Guest User',
          bio: '',
          phone: '',
          email: '',
          date_of_birth: '',
          gender: 'other',
          image_link: '',
        };
        this.editdashboard = { ...this.dashboard };
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      this.dashboardState.error = 'Failed to load user profile';
    }
  }

  /**
   * Simple dashboard data loading method (step by step)
   */
  loadDashboardDataSimple(): void {
    console.log('🚀 Starting simple dashboard data load...');
    this.dashboardState.isLoading = true;
    this.dashboardState.error = null;

    const currentPatientId = this.authService.getCurrentPatientId();
    console.log('Loading dashboard data for patient ID:', currentPatientId);

    // Load data step by step to avoid complex forkJoin issues
    this.loadDashboardDataStepByStep(currentPatientId);
  }

  /**
   * Load dashboard data step by step
   */
  private loadDashboardDataStepByStep(patientId: string | null): void {
    // Step 1: Load patient data
    this.authService.getDashboardPatients().subscribe({
      next: (patients) => {
        console.log('✅ Step 1: Patients loaded:', patients.length);
        this.dashboardState.patients = patients;
        this.patients = patients;

        // Step 2: Load appointments
        this.authService
          .getDashboardAppointments(patientId || undefined)
          .subscribe({
            next: (appointments) => {
              console.log(
                '✅ Step 2: Appointments loaded:',
                appointments.length
              );
              this.dashboardState.appointments = appointments;
              this.appointments = appointments;

              // Step 3: Load counts
              this.loadDashboardCounts();
            },
            error: (error) => {
              console.error('❌ Error loading appointments:', error);
              this.dashboardState.appointments = [];
              this.appointments = [];
              // Continue with counts even if appointments fail
              this.loadDashboardCounts();
            },
          });
      },
      error: (error) => {
        console.error('❌ Error loading patients:', error);
        this.dashboardState.patients = [];
        this.patients = [];
        // Continue with appointments even if patients fail
        this.authService
          .getDashboardAppointments(patientId || undefined)
          .subscribe({
            next: (appointments) => {
              console.log(
                '✅ Appointments loaded (after patient error):',
                appointments.length
              );
              this.dashboardState.appointments = appointments;
              this.appointments = appointments;
              this.loadDashboardCounts();
            },
            error: () => {
              this.dashboardState.appointments = [];
              this.appointments = [];
              this.loadDashboardCounts();
            },
          });
      },
    });
  }

  /**
   * Load dashboard counts
   */
  private loadDashboardCounts(): void {
    console.log('🔄 Loading dashboard counts...');

    // Load patient count
    this.authService.getPatientCount().subscribe({
      next: (count) => {
        console.log('✅ Patient count loaded:', count);
        this.dashboardState.totalPatients = count;
      },
      error: (error) => {
        console.error('❌ Error loading patient count:', error);
        this.dashboardState.totalPatients = 0;
      },
    });

    // Load appointment counts
    this.authService.getAppointmentCountByStatus().subscribe({
      next: (count) => {
        console.log('✅ Total appointment count loaded:', count);
        this.dashboardState.totalAppointments = count;
      },
      error: (error) => {
        console.error('❌ Error loading total appointment count:', error);
        this.dashboardState.totalAppointments = 0;
      },
    });

    // Load pending count
    this.authService.getAppointmentCountByStatus('pending').subscribe({
      next: (count) => {
        console.log('✅ Pending appointment count loaded:', count);
        this.dashboardState.pendingAppointments = count;
      },
      error: (error) => {
        console.error('❌ Error loading pending count:', error);
        this.dashboardState.pendingAppointments = 0;
      },
    });

    // Load completed count
    this.authService.getAppointmentCountByStatus('completed').subscribe({
      next: (count) => {
        console.log('✅ Completed appointment count loaded:', count);
        this.dashboardState.completedAppointments = count;
      },
      error: (error) => {
        console.error('❌ Error loading completed count:', error);
        this.dashboardState.completedAppointments = 0;
      },
    });

    // Load cancelled count
    this.authService.getAppointmentCountByStatus('cancelled').subscribe({
      next: (count) => {
        console.log('✅ Cancelled appointment count loaded:', count);
        this.dashboardState.cancelledAppointments = count;

        // All data loaded - finalize
        this.finalizeDashboardLoad();
      },
      error: (error) => {
        console.error('❌ Error loading cancelled count:', error);
        this.dashboardState.cancelledAppointments = 0;

        // Finalize even with error
        this.finalizeDashboardLoad();
      },
    });
  }

  /**
   * Finalize dashboard loading
   */
  private finalizeDashboardLoad(): void {
    console.log('🎉 SUCCESS: All dashboard data loaded!');
    console.log('📊 Dashboard Summary:', {
      totalPatients: this.dashboardState.totalPatients,
      totalAppointments: this.dashboardState.totalAppointments,
      pendingAppointments: this.dashboardState.pendingAppointments,
      completedAppointments: this.dashboardState.completedAppointments,
      cancelledAppointments: this.dashboardState.cancelledAppointments,
      patients: this.dashboardState.patients.length,
      appointments: this.dashboardState.appointments.length,
    });

    // Update appointment mapping for calendar
    this.updateAppointmentMapping();

    // Regenerate calendar with new data
    this.generateCalendarDays();

    // Clear loading state
    this.dashboardState.isLoading = false;
    console.log('✅ Dashboard loading completed successfully!');
  }

  /**
   * Load all dashboard data from Supabase (patient-specific) - LEGACY METHOD
   */
  loadDashboardData(): void {
    console.log('🚀 Starting dashboard data load...');
    this.dashboardState.isLoading = true;
    this.dashboardState.error = null;

    const currentPatientId = this.authService.getCurrentPatientId();
    console.log(' Loading dashboard data for patient ID:', currentPatientId);

    // Backup mechanism: Force clear loading state after 35 seconds
    setTimeout(() => {
      if (this.dashboardState.isLoading) {
        console.warn('⚠️ Loading state stuck - forcing clear after 35 seconds');
        this.dashboardState.isLoading = false;
        this.dashboardState.error =
          'Loading took too long. Please refresh the page.';
      }
    }, 35000);

    forkJoin({
      patients: this.authService.getDashboardPatients().pipe(
        tap(() => console.log('🔄 Patients observable completed')),
        catchError((error) => {
          console.error('❌ Error loading patients:', error);
          return of([]);
        })
      ),
      appointments: this.authService
        .getDashboardAppointments(currentPatientId || undefined)
        .pipe(
          tap(() => console.log('🔄 Appointments observable completed')),
          catchError((error) => {
            console.error('❌ Error loading appointments:', error);
            return of([]);
          })
        ),
      patientCount: this.authService.getPatientCount().pipe(
        tap(() => console.log('🔄 Patient count observable completed')),
        catchError((error) => {
          console.error('❌ Error loading patient count:', error);
          return of(0);
        })
      ),
      appointmentCount: this.authService.getAppointmentCountByStatus().pipe(
        tap(() => console.log('🔄 Appointment count observable completed')),
        catchError((error) => {
          console.error('❌ Error loading appointment count:', error);
          return of(0);
        })
      ),
      pendingCount: this.authService
        .getAppointmentCountByStatus('pending')
        .pipe(
          tap(() => console.log('🔄 Pending count observable completed')),
          catchError((error) => {
            console.error('❌ Error loading pending count:', error);
            return of(0);
          })
        ),
      completedCount: this.authService
        .getAppointmentCountByStatus('completed')
        .pipe(
          tap(() => console.log('🔄 Completed count observable completed')),
          catchError((error) => {
            console.error('❌ Error loading completed count:', error);
            return of(0);
          })
        ),
      cancelledCount: this.authService
        .getAppointmentCountByStatus('cancelled')
        .pipe(
          tap(() => console.log('🔄 Cancelled count observable completed')),
          catchError((error) => {
            console.error('❌ Error loading cancelled count:', error);
            return of(0);
          })
        ),
    })
      .pipe(
        timeout(30000), // 30 second timeout
        takeUntil(this.destroy$),
        finalize(() => {
          console.log('🔄 Finalize called - clearing loading state');
          this.dashboardState.isLoading = false;
        })
      )
      .subscribe({
        next: (data) => {
          console.log('✅ Dashboard data loaded successfully:', {
            patients: data.patients?.length || 0,
            appointments: data.appointments?.length || 0,
            patientCount: data.patientCount,
            appointmentCount: data.appointmentCount,
            pendingCount: data.pendingCount,
            completedCount: data.completedCount,
            cancelledCount: data.cancelledCount,
            appointmentData: data.appointments,
          });

          // Show success message
          console.log(
            '🎉 SUCCESS: All dashboard data successfully fetched from Supabase!'
          );
          console.log(`📊 Dashboard Summary:
            - Total Patients: ${data.patientCount || 0}
            - Total Appointments: ${data.appointmentCount || 0}
            - Pending: ${data.pendingCount || 0}
            - Completed: ${data.completedCount || 0}
            - Cancelled: ${data.cancelledCount || 0}
          `);

          this.dashboardState.patients = data.patients || [];
          this.dashboardState.appointments = data.appointments || [];
          this.dashboardState.totalPatients = data.patientCount || 0;
          this.dashboardState.totalAppointments = data.appointmentCount || 0;
          this.dashboardState.pendingAppointments = data.pendingCount || 0;
          this.dashboardState.completedAppointments = data.completedCount || 0;
          this.dashboardState.cancelledAppointments = data.cancelledCount || 0;

          // Update component properties
          this.patients = data.patients || [];
          this.appointments = data.appointments || [];

          // Update appointment mapping for calendar
          this.updateAppointmentMapping();

          // Regenerate calendar with new data
          this.generateCalendarDays();

          console.log('📊 Dashboard state updated:', {
            totalPatients: this.dashboardState.totalPatients,
            totalAppointments: this.dashboardState.totalAppointments,
            pendingAppointments: this.dashboardState.pendingAppointments,
            isLoading: this.dashboardState.isLoading,
          });
        },
        error: (error) => {
          console.error('❌ Error loading dashboard data:', error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            error: error,
          });

          // Check if it's a timeout error
          if (error.name === 'TimeoutError') {
            this.dashboardState.error =
              'Dashboard loading timed out. Please check your connection and try again.';
            console.error('⏰ Dashboard loading timed out after 30 seconds');
          } else {
            this.dashboardState.error =
              'Failed to load dashboard data. Please try again.';
          }

          // Fallback to empty data
          this.dashboardState.patients = [];
          this.dashboardState.appointments = [];
          this.patients = [];
          this.appointments = [];
        },
      });
  }

  /**
   * Update appointment mapping for calendar display
   */
  private updateAppointmentMapping(): void {
    this.appointmentMapping = {};

    console.log(
      'Updating appointment mapping with appointments:',
      this.appointments
    );

    this.appointments.forEach((appointment) => {
      if (appointment.date) {
        const appointmentDate = new Date(appointment.date);
        const dayOfMonth = appointmentDate.getDate();

        console.log(
          'Mapping appointment:',
          appointment.title,
          'to day:',
          dayOfMonth,
          'date:',
          appointment.date
        );

        if (!this.appointmentMapping[dayOfMonth]) {
          this.appointmentMapping[dayOfMonth] = [];
        }

        this.appointmentMapping[dayOfMonth].push(appointment);
      } else {
        console.warn('Appointment without date:', appointment);
      }
    });

    console.log('Final appointment mapping:', this.appointmentMapping);
  }

  // Calendar methods

  generateCalendarDays(): void {
    switch (this.calendarView) {
      case 'week':
        this.calendarDays = this.generateWeekDays();
        break;
      case 'day':
        this.calendarDays = this.generateSingleDay();
        break;
      default:
        this.calendarDays = this.generateMonthDays();
        break;
    }
  }

  /**
   * Generate days for month view
   */
  private generateMonthDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const startDate = new Date(firstDay);

    // Adjust to start from Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dayNumber = date.getDate();
      const isCurrentMonth = date.getMonth() === this.currentMonth;
      const isToday = this.isSameDay(date, this.today);

      const appointments = isCurrentMonth
        ? this.appointmentMapping[dayNumber] || []
        : [];

      days.push({
        date: dayNumber,
        isCurrentMonth,
        isToday,
        appointments,
      });
    }

    return days;
  }

  /**
   * Generate days for week view
   */
  private generateWeekDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const currentDate = new Date(
      this.currentYear,
      this.currentMonth,
      this.currentDate.getDate()
    );

    // Get start of week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    // Generate 7 days for the week
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);

      const dayAppointments = this.getAppointmentsForDate(date);

      days.push({
        date: date.getDate(),
        isCurrentMonth: date.getMonth() === this.currentMonth,
        isToday: this.isSameDay(date, this.today),
        appointments: dayAppointments,
      });
    }

    return days;
  }

  /**
   * Generate single day for day view
   */
  private generateSingleDay(): CalendarDay[] {
    const currentDate = new Date(
      this.currentYear,
      this.currentMonth,
      this.currentDate.getDate()
    );
    const dayAppointments = this.getAppointmentsForDate(currentDate);

    return [
      {
        date: currentDate.getDate(),
        isCurrentMonth: true,
        isToday: this.isSameDay(currentDate, this.today),
        appointments: dayAppointments,
      },
    ];
  }

  /**
   * Get appointments for a specific date
   */
  private getAppointmentsForDate(date: Date): DashboardAppointment[] {
    return this.appointments.filter((appointment) => {
      if (!appointment.date) return false;
      const appointmentDate = new Date(appointment.date);
      return this.isSameDay(appointmentDate, date);
    });
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  }

  // ========== CALENDAR NAVIGATION METHODS ==========

  previousMonth(): void {
    switch (this.calendarView) {
      case 'week':
        this.previousWeek();
        break;
      case 'day':
        this.previousDay();
        break;
      default:
        if (this.currentMonth === 0) {
          this.currentMonth = 11;
          this.currentYear--;
        } else {
          this.currentMonth--;
        }
        break;
    }
    this.generateCalendarDays();
    this.updateAppointmentMapping();
  }

  nextMonth(): void {
    switch (this.calendarView) {
      case 'week':
        this.nextWeek();
        break;
      case 'day':
        this.nextDay();
        break;
      default:
        if (this.currentMonth === 11) {
          this.currentMonth = 0;
          this.currentYear++;
        } else {
          this.currentMonth++;
        }
        break;
    }
    this.generateCalendarDays();
    this.updateAppointmentMapping();
  }

  /**
   * Navigate to previous week
   */
  private previousWeek(): void {
    this.currentDate.setDate(this.currentDate.getDate() - 7);
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  /**
   * Navigate to next week
   */
  private nextWeek(): void {
    this.currentDate.setDate(this.currentDate.getDate() + 7);
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  /**
   * Navigate to previous day
   */
  private previousDay(): void {
    this.currentDate.setDate(this.currentDate.getDate() - 1);
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  /**
   * Navigate to next day
   */
  private nextDay(): void {
    this.currentDate.setDate(this.currentDate.getDate() + 1);
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  goToToday(): void {
    const today = new Date();
    this.currentDate = today;
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.generateCalendarDays();
    this.updateAppointmentMapping();
  }

  /**
   * Navigate to specific month and year
   */
  goToMonth(month: number, year: number): void {
    this.currentMonth = month;
    this.currentYear = year;
    this.currentDate = new Date(year, month, 1);
    this.generateCalendarDays();
    this.updateAppointmentMapping();
  }

  addAppointment(): void {
    // Navigate to appointment booking page
    window.location.href = '/appointment';
  }

  /**
   * Change calendar view mode
   */
  changeView(view: 'month' | 'week' | 'day'): void {
    this.calendarView = view;
    this.generateCalendarDays();
  }

  /**
   * Toggle date picker visibility
   */
  toggleDatePicker(): void {
    this.showDatePicker = !this.showDatePicker;
  }

  /**
   * Close date picker
   */
  closeDatePicker(): void {
    this.showDatePicker = false;
  }

  /**
   * Get current month full_name
   */
  get currentMonthfull_name(): string {
    const monthfull_names = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${monthfull_names[this.currentMonth]} ${this.currentYear}`;
  }

  /**
   * Get available years for date picker
   */
  get availableYears(): number[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  }

  /**
   * Get available months for date picker
   */
  get availableMonths(): { value: number; full_name: string }[] {
    const monthfull_names = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return monthfull_names.map((full_name, index) => ({
      value: index,
      full_name,
    }));
  }

  /**
   * Navigate to next month (for quick navigation)
   */
  goToNextMonth(): void {
    const nextMonth = this.currentMonth === 11 ? 0 : this.currentMonth + 1;
    const nextYear =
      this.currentMonth === 11 ? this.currentYear + 1 : this.currentYear;
    this.goToMonth(nextMonth, nextYear);
  }

  /**
   * Change year by increment/decrement
   */
  changeYear(increment: number): void {
    this.currentYear += increment;
    this.goToMonth(this.currentMonth, this.currentYear);
  }

  /**
   * Get time slots for week/day view (8 AM to 8 PM)
   */
  get timeSlots(): string[] {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      const time12 = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 12 ? 12 : time12;
      slots.push(`${displayHour}:00 ${ampm}`);
    }
    return slots;
  }

  /**
   * Get day full_names for week view
   */
  get dayfull_names(): string[] {
    return [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
  }

  /**
   * Get appointments positioned by time for a specific date
   */
  getAppointmentsForTimeSlot(
    date: Date,
    timeSlot: string
  ): DashboardAppointment[] {
    const dayAppointments = this.getAppointmentsForDate(date);
    return dayAppointments.filter((appointment) => {
      if (!appointment.time) return false;
      // Convert appointment time to match time slot format
      const appointmentTime = this.convertTo12HourFormat(appointment.time);
      return appointmentTime === timeSlot;
    });
  }

  /**
   * Get appointments for a specific day and time slot (template helper)
   */
  getAppointmentsForDayTimeSlot(
    dayNumber: number,
    timeSlot: string
  ): DashboardAppointment[] {
    const date = new Date(this.currentYear, this.currentMonth, dayNumber);
    return this.getAppointmentsForTimeSlot(date, timeSlot);
  }

  /**
   * Convert 24-hour time to 12-hour format
   */
  private convertTo12HourFormat(time24: string): string {
    try {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      return time24;
    }
  }

  onDayClick(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      console.log(`Day ${day.date} clicked`);
      // Implement day click logic
    }
  }

  // ========== PROFILE MANAGEMENT METHODS ==========

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.profileError = null;
    if (this.isEditing) {
      this.editdashboard = { ...this.dashboard };
    }
  }

  async savedashboard(): Promise<void> {
    const currentPatientId = this.authService.getCurrentPatientId();
    if (!currentPatientId) {
      this.profileError = 'User not authenticated';
      return;
    }

    // Validate form before saving
    if (!this.isFormValid()) {
      return;
    }

    this.isProfileSaving = true;
    this.profileError = null;

    try {
      // Upload avatar if a new file was selected
      let avatarUrl: string | null = this.editdashboard.image_link;
      if (this.selectedAvatarFile) {
        const uploadResult = await this.uploadAvatar();
        if (!uploadResult) {
          // Upload failed, error already set in uploadAvatar method
          return;
        }
        avatarUrl = uploadResult;
      }

      // Prepare updates for patient table
      const updates: Partial<Patient> = {
        full_name: this.editdashboard.full_name,
        bio: this.editdashboard.bio,
        phone: this.editdashboard.phone,
        email: this.editdashboard.email,
        date_of_birth: this.editdashboard.date_of_birth || null,
        gender:
          (this.editdashboard.gender as 'male' | 'female' | 'other') || 'other',
        image_link: avatarUrl || null,
      };

      this.authService
        .updatePatientProfile(currentPatientId, updates)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.isProfileSaving = false;
          })
        )
        .subscribe({
          next: (updatedPatient) => {
            // Update local dashboard data
            this.dashboard = { ...this.editdashboard };
            this.isEditing = false;

            // Reset avatar selection
            this.resetAvatarSelection();

            // Update auth service with new patient data
            this.authService.updateCurrentPatient(updatedPatient);

            console.log('Profile updated successfully');
          },
          error: (error) => {
            console.error('Error updating profile:', error);
            this.profileError = 'Failed to update profile. Please try again.';
          },
        });
    } catch (error) {
      console.error('Error in profile save process:', error);
      this.profileError = 'An unexpected error occurred. Please try again.';
      this.isProfileSaving = false;
    }
  }

  cancelEdit(): void {
    this.editdashboard = { ...this.dashboard };
    this.isEditing = false;
    this.profileError = null;
    this.resetAvatarSelection();
  }

  // ========== FORM VALIDATION METHODS ==========

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format (Vietnamese phone numbers)
   */
  isValidPhone(phone: string): boolean {
    const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate required fields
   */
  isFormValid(): boolean {
    if (!this.editdashboard.full_name.trim()) {
      this.profileError = 'full_name is required';
      return false;
    }

    if (!this.editdashboard.email.trim()) {
      this.profileError = 'Email is required';
      return false;
    }

    if (!this.isValidEmail(this.editdashboard.email)) {
      this.profileError = 'Please enter a valid email address';
      return false;
    }

    if (!this.editdashboard.phone.trim()) {
      this.profileError = 'Phone number is required';
      return false;
    }

    if (!this.isValidPhone(this.editdashboard.phone)) {
      this.profileError =
        'Please enter a valid phone number (e.g., +84901234567 or 0901234567)';
      return false;
    }

    return true;
  }

  /**
   * Get gender options for dropdown
   */
  get genderOptions() {
    return [
      {
        value: 'male',
        label: this.translate.instant('DASHBOARD.PROFILE.GENDER_OPTIONS.MALE'),
      },
      {
        value: 'female',
        label: this.translate.instant(
          'DASHBOARD.PROFILE.GENDER_OPTIONS.FEMALE'
        ),
      },
      {
        value: 'other',
        label: this.translate.instant('DASHBOARD.PROFILE.GENDER_OPTIONS.OTHER'),
      },
    ];
  }

  /**
   * Get translated appointment type
   */
  getAppointmentTypeTranslation(type: string): string {
    const typeKey = type?.toUpperCase();
    switch (typeKey) {
      case 'VIRTUAL':
        return this.translate.instant('DASHBOARD.APPOINTMENTS.TYPES.VIRTUAL');
      case 'INTERNAL':
        return this.translate.instant('DASHBOARD.APPOINTMENTS.TYPES.INTERNAL');
      case 'EXTERNAL':
        return this.translate.instant('DASHBOARD.APPOINTMENTS.TYPES.EXTERNAL');
      case 'CONSULTATION':
        return this.translate.instant(
          'DASHBOARD.APPOINTMENTS.TYPES.CONSULTATION'
        );
      default:
        return type || '';
    }
  }

  // ========== AVATAR UPLOAD METHODS ==========

  /**
   * Handle avatar file selection
   */
  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.profileError = 'Please select a valid image file';
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.profileError = 'Image file size must be less than 5MB';
        return;
      }

      this.selectedAvatarFile = file;
      this.profileError = null;

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        this.avatarPreviewUrl = e.target?.result as string;
        // Update the edit dashboard image link for preview
        this.editdashboard.image_link = this.avatarPreviewUrl;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Upload avatar to Supabase Storage
   */
  private async uploadAvatar(): Promise<string | null> {
    if (!this.selectedAvatarFile) {
      return null;
    }

    try {
      this.isUploadingAvatar = true;
      const currentPatientId = this.authService.getCurrentPatientId();
      if (!currentPatientId) {
        throw new Error('User not authenticated');
      }

      // Generate unique file full_name
      const fileExt = this.selectedAvatarFile.name.split('.').pop();
      const filename = `${currentPatientId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${filename}`;

      // Upload to Supabase Storage
      const uploadResult = await this.authService.uploadAvatar(
        filePath,
        this.selectedAvatarFile
      );

      if (uploadResult.error) {
        throw new Error(uploadResult.error.message);
      }

      // Get public URL
      const publicUrl = this.authService.getAvatarPublicUrl(filePath);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      this.profileError = 'Failed to upload avatar. Please try again.';
      return null;
    } finally {
      this.isUploadingAvatar = false;
    }
  }

  /**
   * Reset avatar selection
   */
  resetAvatarSelection(): void {
    this.selectedAvatarFile = null;
    this.avatarPreviewUrl = null;
    this.editdashboard.image_link = this.dashboard.image_link;
  }

  // Utility methods for appointment display
  getAppointmentTypeClass(
    type: 'virtual' | 'internal' | 'external' | 'consultation'
  ): string {
    return `appointment ${type}`;
  }

  getStatusClass(status?: 'pending' | 'cancelled' | 'completed'): string {
    if (!status) return '';
    return `appointment-status ${status}`;
  }

  getStatusText(status?: 'pending' | 'cancelled' | 'completed'): string {
    if (!status) return '';
    return `• ${status.toUpperCase()}`;
  }

  // ========== DASHBOARD UTILITY METHODS ==========

  /**
   * Get loading state
   */
  get isLoading(): boolean {
    const loading = this.dashboardState.isLoading;
    console.log(' Dashboard isLoading:', loading);
    return loading;
  }

  /**
   * Get error message
   */
  get errorMessage(): string | null {
    const error = this.dashboardState.error;
    console.log(' Dashboard errorMessage:', error);
    return error;
  }

  /**
   * Get dashboard statistics
   */
  get dashboardStats() {
    return {
      totalPatients: this.dashboardState.totalPatients,
      totalAppointments: this.dashboardState.totalAppointments,
      pendingAppointments: this.dashboardState.pendingAppointments,
      completedAppointments: this.dashboardState.completedAppointments,
      cancelledAppointments: this.dashboardState.cancelledAppointments,
    };
  }

  /**
   * Refresh dashboard data
   */
  refreshDashboard(): void {
    console.log('🔄 Manually refreshing dashboard data...');
    this.loadDashboardDataSimple();
  }

  /**
   * Debug method to check authentication status
   */
  debugAuth(): void {
    const user = this.authService.getCurrentUser();
    const patient = this.authService.getCurrentPatient();
    console.log(' Debug Auth Status:', {
      user: user,
      patient: patient,
      isAuthenticated: this.authService.isAuthenticated(),
      patientId: this.authService.getCurrentPatientId(),
    });
  }

  /**
   * Debug method to check dashboard state
   */
  debugDashboard(): void {
    console.log(' Debug Dashboard State:', {
      isLoading: this.dashboardState.isLoading,
      error: this.dashboardState.error,
      patients: this.dashboardState.patients,
      appointments: this.dashboardState.appointments,
      totalPatients: this.dashboardState.totalPatients,
      totalAppointments: this.dashboardState.totalAppointments,
      dashboard: this.dashboard,
      shouldShowContent: !this.isLoading && !this.errorMessage,
    });
  }

  /**
   * Force clear loading state for debugging
   */
  forceShowDashboard(): void {
    console.log('🔧 Force showing dashboard...');
    this.dashboardState.isLoading = false;
    this.dashboardState.error = null;
  }

  // ========== IMAGE UTILITY METHODS ==========

  /**
   * Get image URL without fallback
   */
  getImageUrl(imageLink: string | null | undefined): string | null {
    if (!imageLink) {
      return null;
    }
    return imageLink;
  }

  /**
   * Handle image loading errors
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    // Hide the image element when there's an error
    img.style.display = 'none';
  }

  /**
   * Get initials from full name for avatar placeholder
   */
  getInitials(fullName: string | null | undefined): string {
    if (!fullName) return '?';

    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }

    // Get first letter of first name and last name
    const firstInitial = names[0].charAt(0).toUpperCase();
    const lastInitial = names[names.length - 1].charAt(0).toUpperCase();

    return firstInitial + lastInitial;
  }
}
