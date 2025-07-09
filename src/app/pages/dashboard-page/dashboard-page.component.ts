import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { AuthService } from '../../services/auth.service';
import { DashboardPatient, Patient } from '../../models/patient.model';
import { DashboardAppointment, CalendarDay, DashboardState } from '../../models/appointment.model';

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
  styleUrl: './dashboard-page.component.css'
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
    name: '',
    bio: '',
    pronouns: '',
    location: '',
    website: '',
    socialLinks: ['', '', '', ''],
    phone: '',
    email: '',
    dateOfBirth: '',
    gender: 'other' as 'male' | 'female' | 'other',
    imageLink: ''
  };

  // Temporary data for editing
  editdashboard = { ...this.dashboard };

  // Dashboard state management
  dashboardState: DashboardState = {
    isLoading: false,
    error: null,
    patients: [],
    appointments: [],
    totalPatients: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0
  };

  // Appointments data from Supabase
  appointments: DashboardAppointment[] = [];

  // Patients data from Supabase
  patients: DashboardPatient[] = [];

  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService
  ) {}

  // Appointment mapping to dates (day of month)
  appointmentMapping: { [key: number]: DashboardAppointment[] } = {};

  ngOnInit() {
    // Initialize calendar
    this.generateCalendarDays();
    // Load user profile data
    this.loadUserProfile();
    // Load dashboard data from Supabase
    this.loadDashboardData();

    // Add click listener to close date picker when clicking outside
    document.addEventListener('click', this.onDocumentClick.bind(this));
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
    const currentPatient = this.authService.getCurrentPatient();
    if (currentPatient) {
      this.dashboard = {
        name: currentPatient.full_name || '',
        bio: currentPatient.bio || '',
        pronouns: '', // Not in patient model, keep empty
        location: '', // Not in patient model, keep empty
        website: '', // Not in patient model, keep empty
        socialLinks: ['', '', '', ''], // Not in patient model, keep empty
        phone: currentPatient.phone || '',
        email: currentPatient.email || '',
        dateOfBirth: currentPatient.date_of_birth || '',
        gender: currentPatient.gender || 'other',
        imageLink: currentPatient.image_link || ''
      };
      this.editdashboard = { ...this.dashboard };
    }
  }

  /**
   * Load all dashboard data from Supabase (patient-specific)
   */
  loadDashboardData(): void {
    this.dashboardState.isLoading = true;
    this.dashboardState.error = null;

    const currentPatientId = this.authService.getCurrentPatientId();

    forkJoin({
      patients: this.authService.getDashboardPatients(),
      appointments: this.authService.getDashboardAppointments(currentPatientId || undefined),
      patientCount: this.authService.getPatientCount(),
      appointmentCount: this.authService.getAppointmentCountByStatus(),
      pendingCount: this.authService.getAppointmentCountByStatus('pending'),
      confirmedCount: this.authService.getAppointmentCountByStatus('confirmed')
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.dashboardState.isLoading = false;
      })
    ).subscribe({
      next: (data) => {
        console.log('Dashboard data loaded:', {
          patients: data.patients.length,
          appointments: data.appointments.length,
          appointmentData: data.appointments
        });

        this.dashboardState.patients = data.patients;
        this.dashboardState.appointments = data.appointments;
        this.dashboardState.totalPatients = data.patientCount;
        this.dashboardState.totalAppointments = data.appointmentCount;
        this.dashboardState.pendingAppointments = data.pendingCount;
        this.dashboardState.confirmedAppointments = data.confirmedCount;

        // Update component properties
        this.patients = data.patients;
        this.appointments = data.appointments;

        // Update appointment mapping for calendar
        this.updateAppointmentMapping();

        // Regenerate calendar with new data
        this.generateCalendarDays();
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.dashboardState.error = 'Failed to load dashboard data. Please try again.';

        // Fallback to empty data
        this.dashboardState.patients = [];
        this.dashboardState.appointments = [];
        this.patients = [];
        this.appointments = [];
      }
    });
  }

  /**
   * Update appointment mapping for calendar display
   */
  private updateAppointmentMapping(): void {
    this.appointmentMapping = {};

    console.log('Updating appointment mapping with appointments:', this.appointments);

    this.appointments.forEach(appointment => {
      if (appointment.date) {
        const appointmentDate = new Date(appointment.date);
        const dayOfMonth = appointmentDate.getDate();

        console.log('Mapping appointment:', appointment.title, 'to day:', dayOfMonth, 'date:', appointment.date);

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

  get calendarDays(): CalendarDay[] {
    return this.generateCalendarDays();
  }

  generateCalendarDays(): CalendarDay[] {
    switch (this.calendarView) {
      case 'week':
        return this.generateWeekDays();
      case 'day':
        return this.generateSingleDay();
      default:
        return this.generateMonthDays();
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

      const appointments = isCurrentMonth ? (this.appointmentMapping[dayNumber] || []) : [];

      days.push({
        date: dayNumber,
        isCurrentMonth,
        isToday,
        appointments
      });
    }

    return days;
  }

  /**
   * Generate days for week view
   */
  private generateWeekDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const currentDate = new Date(this.currentYear, this.currentMonth, this.currentDate.getDate());

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
        appointments: dayAppointments
      });
    }

    return days;
  }

  /**
   * Generate single day for day view
   */
  private generateSingleDay(): CalendarDay[] {
    const currentDate = new Date(this.currentYear, this.currentMonth, this.currentDate.getDate());
    const dayAppointments = this.getAppointmentsForDate(currentDate);

    return [{
      date: currentDate.getDate(),
      isCurrentMonth: true,
      isToday: this.isSameDay(currentDate, this.today),
      appointments: dayAppointments
    }];
  }

  /**
   * Get appointments for a specific date
   */
  private getAppointmentsForDate(date: Date): DashboardAppointment[] {
    return this.appointments.filter(appointment => {
      if (!appointment.date) return false;
      const appointmentDate = new Date(appointment.date);
      return this.isSameDay(appointmentDate, date);
    });
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
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
   * Get current month name
   */
  get currentMonthName(): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[this.currentMonth]} ${this.currentYear}`;
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
  get availableMonths(): { value: number; name: string }[] {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames.map((name, index) => ({ value: index, name }));
  }

  /**
   * Navigate to next month (for quick navigation)
   */
  goToNextMonth(): void {
    const nextMonth = this.currentMonth === 11 ? 0 : this.currentMonth + 1;
    const nextYear = this.currentMonth === 11 ? this.currentYear + 1 : this.currentYear;
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
   * Get day names for week view
   */
  get dayNames(): string[] {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  }

  /**
   * Get appointments positioned by time for a specific date
   */
  getAppointmentsForTimeSlot(date: Date, timeSlot: string): DashboardAppointment[] {
    const dayAppointments = this.getAppointmentsForDate(date);
    return dayAppointments.filter(appointment => {
      if (!appointment.time) return false;
      // Convert appointment time to match time slot format
      const appointmentTime = this.convertTo12HourFormat(appointment.time);
      return appointmentTime === timeSlot;
    });
  }

  /**
   * Get appointments for a specific day and time slot (template helper)
   */
  getAppointmentsForDayTimeSlot(dayNumber: number, timeSlot: string): DashboardAppointment[] {
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
      let avatarUrl: string | null = this.editdashboard.imageLink;
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
        full_name: this.editdashboard.name,
        bio: this.editdashboard.bio,
        phone: this.editdashboard.phone,
        email: this.editdashboard.email,
        date_of_birth: this.editdashboard.dateOfBirth || null,
        gender: this.editdashboard.gender,
        image_link: avatarUrl || null
      };

      this.authService.updatePatientProfile(currentPatientId, updates).pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isProfileSaving = false;
        })
      ).subscribe({
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
        }
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
    if (!this.editdashboard.name.trim()) {
      this.profileError = 'Name is required';
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
      this.profileError = 'Please enter a valid phone number (e.g., +84901234567 or 0901234567)';
      return false;
    }

    return true;
  }

  /**
   * Get gender options for dropdown
   */
  get genderOptions() {
    return [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other / Prefer not to say' }
    ];
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
        this.editdashboard.imageLink = this.avatarPreviewUrl;
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

      // Generate unique filename
      const fileExt = this.selectedAvatarFile.name.split('.').pop();
      const fileName = `${currentPatientId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const uploadResult = await this.authService.uploadAvatar(filePath, this.selectedAvatarFile);

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
    this.editdashboard.imageLink = this.dashboard.imageLink;
  }

  // Utility methods for appointment display
  getAppointmentTypeClass(type: 'virtual' | 'internal' | 'external' | 'consultation'): string {
    return `appointment ${type}`;
  }

  getStatusClass(status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'): string {
    if (!status) return '';
    return `appointment-status ${status}`;
  }

  getStatusText(status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'): string {
    if (!status) return '';
    return `• ${status.toUpperCase()}`;
  }

  // ========== DASHBOARD UTILITY METHODS ==========

  /**
   * Get loading state
   */
  get isLoading(): boolean {
    return this.dashboardState.isLoading;
  }

  /**
   * Get error message
   */
  get errorMessage(): string | null {
    return this.dashboardState.error;
  }

  /**
   * Get dashboard statistics
   */
  get dashboardStats() {
    return {
      totalPatients: this.dashboardState.totalPatients,
      totalAppointments: this.dashboardState.totalAppointments,
      pendingAppointments: this.dashboardState.pendingAppointments,
      confirmedAppointments: this.dashboardState.confirmedAppointments
    };
  }

  /**
   * Refresh dashboard data
   */
  refreshDashboard(): void {
    this.loadDashboardData();
  }
}