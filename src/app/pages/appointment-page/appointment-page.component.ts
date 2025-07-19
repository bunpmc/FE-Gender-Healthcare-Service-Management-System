import { Component, inject, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DoctorService } from '../../services/doctor.service';
import { MedicalService } from '../../services/medical.service';
import { BookingService } from '../../services/booking.service';
import { AuthService } from '../../services/auth.service';

import {
  BookingState,
  DoctorBooking,
  DoctorSlotDetail,
  PhoneRegion,
  ServiceBooking,
  TimeSlot,
  AppointmentCreateRequest,
} from '../../models/booking.model';

// Extend BookingState to include profile selection
interface ExtendedBookingState extends BookingState {
  useProfile?: 'me' | 'another';
  authState?: boolean;
  savedProfiles?: {
    fullName: string;
    phone: string;
    email?: string;
    gender?: string;
    dateOfBirth?: string;
  }[];
}

@Component({
  selector: 'app-appointmentPage',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './appointment-page.component.html',
  styleUrls: ['./appointment-page.component.css'],
})
export class AppointmentPageComponent implements OnInit {
  // ========== CORE STATE ==========
  private router = inject(Router);
  private translate = inject(TranslateService);
  private doctorService = inject(DoctorService);
  private medicalService = inject(MedicalService);
  private bookingService = inject(BookingService);
  private authService = inject(AuthService);
  currentStep: number = 0;
  bookingType: 'docfirst' | 'serfirst' | null = null;
  selectedType: 'serfirst' | 'docfirst' | null = null;
  formSubmitted: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  booking: ExtendedBookingState = {};
  slotsForSelectedDate: DoctorSlotDetail[] = [];
  selectedService: ServiceBooking | null = null;
  selectedSlot: DoctorSlotDetail | null = null;

  // ========== DATA SOURCES ==========
  doctors: DoctorBooking[] = [];
  services: ServiceBooking[] = [];
  availableDoctors: DoctorBooking[] = [];
  selectedDoctor: DoctorBooking | null = null;

  // ========== PHONE REGION ==========
  phoneRegions: PhoneRegion[] = [
    {
      code: 'VN',
      flag: '🇻🇳',
      name: 'Vietnam',
      dialCode: '+84',
      format: 'XXX XXX XXX',
      placeholder: '901 234 567',
    },
  ];
  selectedPhoneRegion: PhoneRegion = this.phoneRegions[0];

  // ========== FILTERS ==========
  doctorSort: 'name' | 'specialization' = 'name';
  doctorGenderFilter: '' | 'male' | 'female' = '';
  doctorSearch: string = '';
  serviceSearch: string = '';
  serviceSort: 'name' | 'desc' = 'name';

  // ========== SLOT STATE STEP 4 ==========
  availableDates: string[] = [];
  allDoctorSlots: DoctorSlotDetail[] = [];
  selectedDate: string = '';

  // ========== INIT ==========
  ngOnInit(): void {
    console.log('🚀 AppointmentPage: Initializing component');
    console.log('📊 Initial state:', {
      currentStep: this.currentStep,
      bookingType: this.bookingType,
      isAuthenticated: this.authService.isAuthenticated(),
    });

    this.loadDoctors();
    this.loadServices();
    this.loadBookingState();
    this.checkAuthAndAdjustFlow();

    if (this.booking.phoneRegion) {
      const savedRegion = this.phoneRegions.find(
        (r) => r.code === this.booking.phoneRegion
      );
      if (savedRegion) {
        this.selectedPhoneRegion = savedRegion;
        console.log('📞 Restored phone region:', savedRegion.name);
      }
    }

    // Subscribe to auth changes
    this.authService.currentUser$.subscribe((user) => {
      console.log('👤 Auth state changed:', user ? 'Logged in' : 'Logged out');
      this.handleAuthChange();
    });

    console.log('✅ AppointmentPage: Initialization complete');
  }

  // ========== ENHANCED AUTHENTICATION HANDLING ==========
  isUserLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  private checkAuthAndAdjustFlow(): void {
    const isAuthenticated = this.authService.isAuthenticated();
    console.log('🔐 Checking auth and adjusting flow:', {
      isAuthenticated,
      currentStep: this.currentStep,
      bookingType: this.booking.type,
      useProfile: this.booking.useProfile,
    });

    if (isAuthenticated) {
      // For logged-in users, reset to beginning to show profile selection
      console.log(
        '👤 User is authenticated - resetting to step 0 for profile selection'
      );
      this.currentStep = 0; // Start at booking type selection
      this.booking.useProfile = undefined;
    } else {
      // For guests, maintain current progress (step persistence)
      if (this.booking.type) {
        // Resume from saved progress
        console.log(
          '👥 Guest user - resuming from saved progress:',
          this.booking.type
        );
        this.bookingType = this.booking.type;
        // Keep current step as is - no adjustment needed
      } else {
        console.log('👥 Guest user - starting fresh at step 0');
        this.currentStep = 0; // Start at booking type selection
      }
    }

    console.log('✅ Flow adjusted - currentStep:', this.currentStep);
  }

  private handleAuthChange(): void {
    if (this.authService.isAuthenticated()) {
      // Reset booking flow to first step after successful login
      this.currentStep = 0;
      this.booking.useProfile = undefined;
      this.saveBookingState();
    }
  }

  // ========== LOAD DATA FROM API ==========
  private loadDoctors(): void {
    this.doctorService.fetchDoctorBooking().subscribe({
      next: (doctors) => {
        this.doctors = doctors;
        this.availableDoctors = [...doctors];
        console.log('Loaded doctors from API:', doctors);
      },
      error: (error) => {
        console.error('Error loading doctors:', error);
        this.doctors = [];
        this.availableDoctors = [];
      },
    });
  }

  private loadServices(): void {
    this.medicalService.fetchServiceBooking().subscribe({
      next: (apiServices: any[]) => {
        this.services = apiServices.map((service) => ({
          service_id: service.service_id,
          name: service.service_name,
          description: service.description || '',
        }));
        console.log(
          'Loaded services from fetch-serviceBooking API:',
          this.services
        );
      },
      error: (error) => {
        console.error(
          'Error loading services from fetch-serviceBooking:',
          error
        );
        this.medicalService.fetchService().subscribe({
          next: (fallbackServices) => {
            this.services = fallbackServices;
            console.log('Loaded services from fallback API:', fallbackServices);
          },
          error: (fallbackError) => {
            console.error(
              'Error loading services from fallback API:',
              fallbackError
            );
            this.services = [];
            console.log('No services available - please check your connection');
          },
        });
      },
    });
  }

  get progressWidth(): string {
    // Total steps:
    // Guests: 0(booking type) -> 1(patient info) -> 2(first selection) -> 3(second selection) -> 4(slot) -> 5(confirmation) = 6 steps
    // Logged-in: 0(booking type) -> 1(profile) -> 2(patient info) -> 3(first selection) -> 4(second selection) -> 5(slot) -> 6(confirmation) = 7 steps
    const totalSteps = this.authService.isAuthenticated() ? 7 : 6;
    const percent = Math.floor((this.currentStep / (totalSteps - 1)) * 100);
    return percent + '%';
  }

  // ========== ENHANCED STEP NAVIGATION ==========
  chooseBookingType(type: 'serfirst' | 'docfirst' | null) {
    console.log('📋 Choosing booking type:', type);

    if (type) {
      this.bookingType = type;
      this.booking.type = type;

      const isAuthenticated = this.authService.isAuthenticated();
      console.log('🔄 Setting booking type:', {
        type,
        isAuthenticated,
        currentStep: this.currentStep,
      });

      if (isAuthenticated) {
        // Go to profile selection step (Step 1)
        console.log(
          '👤 Authenticated user - going to profile selection (Step 1)'
        );
        this.currentStep = 1;
      } else {
        // Skip profile selection, go directly to patient info (Step 1 for guests)
        console.log('👥 Guest user - going to patient info (Step 1)');
        this.currentStep = 1;
      }

      this.errorMessage = null;
      this.saveBookingState();

      console.log('✅ Booking type set - new step:', this.currentStep);
    }
  }

  goToNextStep() {
    console.log('➡️ Going to next step:', {
      currentStep: this.currentStep,
      bookingType: this.bookingType,
      serviceStep: this.getServiceStep(),
      slotStep: this.getSlotStep(),
    });

    // Handle service-first flow
    if (
      this.bookingType === 'serfirst' &&
      this.currentStep === this.getServiceStep()
    ) {
      console.log('🔄 Service-first flow - getting doctors by service');
      this.getDoctorsByService();
    }

    this.currentStep++;
    console.log('📈 Step incremented to:', this.currentStep);

    // Initialize slot step when reaching it
    if (this.currentStep === this.getSlotStep()) {
      console.log('🕐 Reached slot step - initializing slots');
      this.initSlotStep();
    }

    this.formSubmitted = false;
    this.errorMessage = null;
    this.saveBookingState();

    console.log('✅ Next step complete - current step:', this.currentStep);
  }

  goToPrevStep() {
    if (this.currentStep === 2 && !this.authService.isAuthenticated()) {
      // Guests: go back to booking type selection
      this.bookingType = null;
      this.booking.type = undefined;
      this.currentStep = 0;
    } else if (this.currentStep === 1 && this.authService.isAuthenticated()) {
      // Logged-in users: go back to booking type selection
      this.bookingType = null;
      this.booking.type = undefined;
      this.currentStep = 0;
    } else {
      this.currentStep = Math.max(0, this.currentStep - 1);
    }

    this.formSubmitted = false;
    this.errorMessage = null;
    this.saveBookingState();
  }

  // ========== STEP CALCULATION HELPERS ==========
  private getServiceStep(): number {
    // Service selection step varies based on booking type and auth status
    if (this.bookingType === 'serfirst') {
      return this.authService.isAuthenticated() ? 3 : 2; // Step 3 for logged-in, Step 2 for guests
    } else {
      return this.authService.isAuthenticated() ? 4 : 3; // Step 4 for logged-in, Step 3 for guests (after doctor selection)
    }
  }

  private getDoctorStep(): number {
    // Doctor selection step varies based on booking type and auth status
    if (this.bookingType === 'serfirst') {
      return this.authService.isAuthenticated() ? 4 : 3; // Step 4 for logged-in, Step 3 for guests (after service selection)
    } else {
      return this.authService.isAuthenticated() ? 3 : 2; // Step 3 for logged-in, Step 2 for guests
    }
  }

  private getSlotStep(): number {
    // Slot selection step: Step 5 for logged-in, Step 4 for guests
    return this.authService.isAuthenticated() ? 5 : 4;
  }

  private getConfirmationStep(): number {
    // Confirmation step: Step 6 for logged-in, Step 5 for guests
    return this.authService.isAuthenticated() ? 6 : 5;
  }

  // ========== ENHANCED PROFILE HANDLING ==========
  selectProfileType(useProfile: 'me' | 'another'): void {
    console.log('👤 Selecting profile type:', useProfile);
    this.booking.useProfile = useProfile;

    if (useProfile === 'me') {
      console.log('📝 Auto-filling profile with user data');
      this.autoFillProfile();
    } else {
      console.log('🆕 Clearing profile fields for new profile');
      this.clearProfileFields();
    }

    this.saveBookingState();
    console.log('✅ Profile type selected, going to next step');
    this.goToNextStep();
  }

  private clearProfileFields(): void {
    this.booking.fullName = '';
    this.booking.phone = '';
    this.booking.email = '';
    this.booking.gender = undefined;
    this.booking.dateOfBirth = '';
    this.selectedPhoneRegion = this.phoneRegions[0];
    this.booking.phoneRegion = this.selectedPhoneRegion.code;
  }

  private autoFillProfile(): void {
    this.authService.getUserProfile().subscribe({
      next: (userProfile) => {
        if (userProfile) {
          this.booking.fullName = userProfile.fullName || userProfile.full_name;
          this.booking.phone = userProfile.phone;
          this.booking.email = userProfile.email;
          this.booking.gender = userProfile.gender;
          this.booking.dateOfBirth =
            userProfile.dateOfBirth || userProfile.date_of_birth;

          // Update phone region
          const savedRegion = this.phoneRegions.find(
            (r) => r.code === userProfile.phoneRegion
          );
          if (savedRegion) {
            this.selectedPhoneRegion = savedRegion;
            this.booking.phoneRegion = savedRegion.code;
          }

          this.saveBookingState();
        }
      },
      error: (error) => {
        console.error('Error fetching user profile:', error);
      },
    });
  }

  // ========== ENHANCED FORM SUBMISSION ==========
  submitPatientForm(form: NgForm): void {
    this.formSubmitted = true;
    this.errorMessage = null;

    if (this.isFormValidStep2(form)) {
      // Save profile for future use if logged in and using "another" profile
      if (
        this.authService.isAuthenticated() &&
        this.booking.useProfile === 'another'
      ) {
        this.saveProfileForFutureUse();
      }

      // Prepare available doctors for doctor-first flow
      if (this.bookingType === 'docfirst') {
        this.availableDoctors = [...this.doctors];
      }

      this.goToNextStep();
    } else {
      this.scrollToFirstError();
    }
  }

  private saveProfileForFutureUse(): void {
    // Implementation for saving profile for future use
    console.log('Saving profile for future use');
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const firstError = document.querySelector('.error, .ng-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  // ========== SLOT LOGIC ==========
  initSlotStep() {
    console.log('🕐 Initializing slot step:', {
      doctorId: this.booking.doctor_id,
      doctorName: this.getSelectedDoctorName(),
      currentStep: this.currentStep,
    });

    if (!this.booking.doctor_id) {
      console.error('❌ No doctor selected for slot loading');
      return;
    }

    console.log('📅 Loading doctor slots...');
    this.loadDoctorSlots(this.booking.doctor_id);
  }

  private loadDoctorSlots(doctor_id: string): void {
    this.bookingService.fetchSlotsByDoctorId(doctor_id).subscribe({
      next: (response: any) => {
        if (response && response.slots) {
          const apiSlots = response.slots.map((slot: any) => ({
            doctor_slot_id: slot.doctor_slot_id,
            doctor_id: response.doctor_id,
            slot_id: slot.slot_id,
            slot_date: slot.slot_date,
            slot_time: slot.slot_time,
            is_active: slot.is_active,
            appointments_count: slot.appointments_count,
            max_appointments: slot.max_appointments,
          }));
          const activeSlots = apiSlots.filter((slot: any) => slot.is_active);
          this.availableDates = Array.from(
            new Set(activeSlots.map((s: any) => s.slot_date))
          );
          this.availableDates.sort();
          this.selectedDate = this.availableDates.includes(this.selectedDate)
            ? this.selectedDate
            : this.availableDates[0] || '';
          this.allDoctorSlots = activeSlots;
          this.updateSlotsForDate();
          console.log('Loaded doctor slots from API:', activeSlots);
        }
      },
      error: (error) => {
        console.error('Error loading doctor slots:', error);
        this.availableDates = [];
        this.slotsForSelectedDate = [];
        this.selectedDate = '';
        console.log('No slots available - please try again later');
      },
    });
    this.booking.preferred_slot_id = undefined;
    this.booking.preferred_time = undefined;
  }

  onDateChange(date: string) {
    this.selectedDate = date;
    this.updateSlotsForDate();
    this.booking.preferred_slot_id = undefined;
    this.booking.preferred_time = undefined;
  }

  updateSlotsForDate() {
    if (this.allDoctorSlots && this.allDoctorSlots.length > 0) {
      this.slotsForSelectedDate = this.allDoctorSlots
        .filter(
          (slot: any) =>
            slot.doctor_id === this.booking.doctor_id &&
            slot.slot_date === this.selectedDate &&
            slot.is_active
        )
        .sort((a: any, b: any) => a.slot_time.localeCompare(b.slot_time));
    } else {
      // No slots available from API
      this.slotsForSelectedDate = [];
    }
  }

  selectSlot(slot: DoctorSlotDetail) {
    console.log('🕐 Selecting time slot:', {
      slotId: slot.doctor_slot_id,
      slotTime: slot.slot_time,
      slotDate: slot.slot_date,
      isActive: slot.is_active,
      appointmentsCount: slot.appointments_count,
      maxAppointments: slot.max_appointments,
    });

    if (slot.is_active && slot.appointments_count < slot.max_appointments) {
      this.booking.preferred_slot_id = slot.doctor_slot_id;
      this.booking.preferred_time = slot.slot_time;
      this.formSubmitted = false;
      this.saveBookingState();
      console.log('✅ Time slot selected and saved');
    } else {
      console.log('❌ Slot not available:', {
        isActive: slot.is_active,
        isFull: slot.appointments_count >= slot.max_appointments,
      });
    }
  }

  onContinueSlot() {
    console.log('🚀 Final appointment submission started');
    console.log('📋 Current booking state:', {
      slotId: this.booking.preferred_slot_id,
      doctorId: this.booking.doctor_id,
      serviceId: this.booking.service_id,
      fullName: this.booking.fullName,
      phone: this.booking.phone,
      selectedDate: this.selectedDate,
      preferredTime: this.booking.preferred_time,
    });

    this.formSubmitted = true;

    if (!this.booking.preferred_slot_id) {
      console.log('❌ Validation failed: No slot selected');
      this.errorMessage = this.translate.instant(
        'APPOINTMENT.ERRORS.SLOT_REQUIRED'
      );
      return;
    }

    if (!this.booking.fullName || !this.booking.phone) {
      console.log('❌ Validation failed: Missing personal information');
      this.errorMessage = 'Please fill in all required personal information.';
      return;
    }

    if (!this.booking.doctor_id || !this.booking.preferred_slot_id) {
      console.log('❌ Validation failed: Missing doctor or slot');
      this.errorMessage = 'Please select a doctor and time slot.';
      return;
    }

    console.log('✅ All validations passed, creating appointment data...');
    const appointmentData = {
      full_name: this.booking.fullName,
      phone: this.getFullPhoneNumber(),
      email: this.booking.email || '',
      gender: this.booking.gender || 'other',
      date_of_birth: this.booking.dateOfBirth || '1990-01-01',
      visit_type: 'consultation',
      schedule: this.mapScheduleForEdgeFunction(),
      message: this.booking.message || '',
      doctor_id: this.booking.doctor_id,
      category_id: this.booking.service_id,
      slot_id: this.booking.preferred_slot_id,
      preferred_date: this.selectedDate,
      preferred_time: this.booking.preferred_time,
      booking_type: this.booking.type || 'docfirst',
    };

    console.log('📝 Appointment data created:', appointmentData);

    const appointmentResult = {
      success: false,
      message: 'Processing appointment...',
      appointmentData: appointmentData,
      bookingDetails: {
        appointment_date: this.selectedDate,
        appointment_time: this.booking.preferred_time,
        doctor_id: this.booking.doctor_id,
        service_id: this.booking.service_id,
        appointment_status: 'pending',
      },
    };

    console.log('💾 Saving appointment result to sessionStorage');
    sessionStorage.setItem(
      'appointmentResult',
      JSON.stringify(appointmentResult)
    );

    console.log(
      '🧭 Redirecting to appointment result page with data:',
      appointmentResult
    );
    this.router.navigate(['/appointment-success']);

    console.log('🔄 Resetting form after successful submission');
    this.resetForm();
  }

  resetForm(): void {
    this.booking = {
      type: undefined,
      useProfile: undefined,
      fullName: '',
      phone: '',
      email: '',
      gender: undefined,
      dateOfBirth: '',
      phoneRegion: 'VN',
      service_id: undefined,
      doctor_id: undefined,
      preferred_date: '',
      preferred_time: '',
      preferred_slot_id: undefined,
    };
    this.currentStep = 0;
    this.bookingType = null;
    this.selectedService = null;
    this.selectedDoctor = null;
    this.selectedDate = '';
    this.selectedSlot = null;
    this.formSubmitted = false;
    this.errorMessage = null;
    this.successMessage = null;
    localStorage.removeItem('bookingState');
  }

  hasBookingData(): boolean {
    return !!(
      this.booking.fullName ||
      this.booking.phone ||
      this.booking.email ||
      this.booking.service_id ||
      this.booking.doctor_id ||
      this.selectedDate
    );
  }

  // ========== FILTERS, SEARCH, SORT ==========
  normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  perfectPrefixMatch(haystack: string, needle: string): boolean {
    const hay = this.normalizeString(haystack);
    const need = this.normalizeString(needle).trim();
    return hay.startsWith(need);
  }

  fuzzyMatch(fullName: string, keyword: string): boolean {
    const normName = this.normalizeString(fullName);
    const normQuery = this.normalizeString(keyword);
    const words = normQuery.split(' ');
    return words.every((w) => normName.includes(w));
  }

  get filteredDoctors(): DoctorBooking[] {
    let list = this.getAvailableDoctors();
    if (this.doctorGenderFilter) {
      list = list.filter((doc) => doc.gender === this.doctorGenderFilter);
    }
    if (this.doctorSearch && this.doctorSearch.trim()) {
      const searchNorm = this.normalizeString(this.doctorSearch.trim());
      let exactMatch = list.filter((doc) =>
        this.normalizeString(doc.full_name).includes(searchNorm)
      );
      if (exactMatch.length > 0) {
        list = exactMatch;
      } else {
        const keywords = searchNorm.split(' ');
        list = list.filter((doc) => {
          const docNameNorm = this.normalizeString(doc.full_name);
          return keywords.every((kw) => docNameNorm.includes(kw));
        });
      }
    }
    list = list.slice().sort((a, b) => {
      if (this.doctorSort === 'name') {
        return a.full_name.localeCompare(b.full_name);
      } else if (this.doctorSort === 'specialization') {
        return (a.specialization || '').localeCompare(b.specialization || '');
      }
      return 0;
    });
    return list;
  }

  get filteredServices(): ServiceBooking[] {
    let list = this.getAvailableServices();
    if (!this.serviceSearch || this.serviceSearch.trim().length < 2) {
      return list.slice().sort((a, b) => {
        if (this.serviceSort === 'name') return a.name.localeCompare(b.name);
        if (this.serviceSort === 'desc')
          return (a.description || '').localeCompare(b.description || '');
        return 0;
      });
    }
    const keywords = this.normalizeString(this.serviceSearch).split(' ');
    list = list.filter((svc) => {
      const haystack = this.normalizeString(
        svc.name + ' ' + (svc.description ?? '')
      );
      return keywords.every((kw) => haystack.includes(kw));
    });
    list = list.slice().sort((a, b) => {
      const aPerfect = this.perfectPrefixMatch(a.name, this.serviceSearch);
      const bPerfect = this.perfectPrefixMatch(b.name, this.serviceSearch);
      if (aPerfect && !bPerfect) return -1;
      if (!aPerfect && bPerfect) return 1;
      if (this.serviceSort === 'name') return a.name.localeCompare(b.name);
      if (this.serviceSort === 'desc')
        return (a.description || '').localeCompare(b.description || '');
      return 0;
    });
    return list;
  }

  get filteredDoctorServices(): ServiceBooking[] {
    if (this.bookingType === 'docfirst' && this.currentStep === 3) {
      let list = this.getDoctorServices();
      if (!this.serviceSearch || this.serviceSearch.trim().length < 2) {
        return list.slice().sort((a, b) => {
          if (this.serviceSort === 'name') return a.name.localeCompare(b.name);
          if (this.serviceSort === 'desc')
            return (a.description || '').localeCompare(b.description || '');
          return 0;
        });
      }
      const keywords = this.normalizeString(this.serviceSearch).split(' ');
      list = list.filter((svc) => {
        const haystack = this.normalizeString(
          svc.name + ' ' + (svc.description ?? '')
        );
        return keywords.every((kw) => haystack.includes(kw));
      });
      list = list.slice().sort((a, b) => {
        const aPerfect = this.perfectPrefixMatch(a.name, this.serviceSearch);
        const bPerfect = this.perfectPrefixMatch(b.name, this.serviceSearch);
        if (aPerfect && !bPerfect) return -1;
        if (!aPerfect && bPerfect) return 1;
        if (this.serviceSort === 'name') return a.name.localeCompare(b.name);
        if (this.serviceSort === 'desc')
          return (a.description || '').localeCompare(b.description || '');
        return 0;
      });
      return list;
    }
    return [];
  }

  private getAvailableDoctors(): DoctorBooking[] {
    if (this.bookingType === 'serfirst' && this.booking.service_id) {
      return this.doctors.filter((d) =>
        d.services?.includes(this.booking.service_id!)
      );
    }
    return [
      ...(this.availableDoctors.length ? this.availableDoctors : this.doctors),
    ];
  }

  private getAvailableServices(): ServiceBooking[] {
    if (this.bookingType === 'docfirst' && this.booking.doctor_id) {
      const doc = this.doctors.find(
        (d) => d.doctor_id === this.booking.doctor_id
      );
      if (doc?.services) {
        return this.services.filter((svc) =>
          doc.services!.includes(svc.service_id)
        );
      }
      return [];
    }
    return [...this.services];
  }

  private getDoctorServices(): ServiceBooking[] {
    const doctor = this.doctors.find(
      (d) => d.doctor_id === this.booking.doctor_id
    );
    if (!doctor || !doctor.services) return [];
    return this.services.filter((svc) =>
      doctor.services?.includes(svc.service_id)
    );
  }

  // ========== UI EVENTS ==========
  onDoctorSearchChange(): void {}
  onDoctorGenderFilterChange(): void {}
  onDoctorSortChange(): void {}
  clearDoctorSearch(): void {
    this.doctorSearch = '';
  }
  clearDoctorGenderFilter(): void {
    this.doctorGenderFilter = '';
  }
  onServiceSearchChange(): void {}
  onServiceSortChange(): void {}
  clearServiceSearch(): void {
    this.serviceSearch = '';
  }

  selectService(service: ServiceBooking): void {
    console.log('🏥 Selecting service:', {
      serviceId: service.service_id,
      serviceName: service.name,
      currentStep: this.currentStep,
    });
    this.booking.service_id = service.service_id;
    this.selectedService = service;
    this.saveBookingState();
    console.log('✅ Service selected and saved');
  }

  selectDoctor(doctor: DoctorBooking): void {
    console.log('👨‍⚕️ Selecting doctor:', {
      doctorId: doctor.doctor_id,
      doctorName: doctor.full_name,
      specialization: doctor.specialization,
      currentStep: this.currentStep,
    });
    this.booking.doctor_id = doctor.doctor_id;
    this.selectedDoctor = doctor;
    this.saveBookingState();
    console.log('✅ Doctor selected and saved');
  }

  onContinueService(): void {
    console.log('🔄 Continue service clicked:', {
      serviceId: this.booking.service_id,
      serviceName: this.getSelectedServiceName(),
      currentStep: this.currentStep,
    });
    if (this.booking.service_id) {
      console.log('✅ Service selected, proceeding to next step');
      this.goToNextStep();
    } else {
      console.log('❌ No service selected');
    }
  }

  onContinueDoctor(): void {
    console.log('🔄 Continue doctor clicked:', {
      doctorId: this.booking.doctor_id,
      doctorName: this.getSelectedDoctorName(),
      currentStep: this.currentStep,
    });
    if (this.booking.doctor_id) {
      console.log('✅ Doctor selected, proceeding to next step');
      this.goToNextStep();
    } else {
      console.log('❌ No doctor selected');
    }
  }

  getDoctorsByService(): void {
    if (!this.booking.service_id) return;
    this.availableDoctors = this.doctors.filter((d) =>
      d.services?.includes(this.booking.service_id!)
    );
    this.booking.doctor_id = undefined;
    this.selectedDoctor = null;
    this.doctorSearch = '';
    this.doctorGenderFilter = '';
  }

  // ========== DISPLAY HELPERS ==========
  getSelectedServiceName(): string {
    const service = this.services.find(
      (s) => s.service_id === this.booking.service_id
    );
    return service ? service.name : '';
  }

  getSelectedDoctorName(): string {
    const doctor = this.doctors.find(
      (d) => d.doctor_id === this.booking.doctor_id
    );
    return doctor ? doctor.full_name : '';
  }

  getDoctorResultCount(): string {
    const total = this.getAvailableDoctors().length;
    const filtered = this.filteredDoctors.length;
    if (filtered === total) return `Showing all ${total} doctors`;
    return `Showing ${filtered} of ${total} doctors`;
  }

  getServiceResultCount(): string {
    const baseList = this.getAvailableServices();
    const total = baseList.length;
    const filtered = this.filteredServices.length;
    if (filtered === total) return `Showing all ${total} services`;
    return `Showing ${filtered} of ${total} services`;
  }

  // ========== PHONE, EMAIL, VALIDATION ==========
  onPhoneRegionChange(regionCode: string): void {
    const region = this.phoneRegions.find((r) => r.code === regionCode);
    if (region) {
      this.selectedPhoneRegion = region;
      this.booking.phoneRegion = regionCode;
      this.booking.phone = '';
      this.saveBookingState();
    }
  }

  formatPhoneNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    const phone = input.value;
    if (!phone) {
      this.booking.phone = '';
      return;
    }
    let cleanedPhone = phone.replace(/\D/g, '');
    switch (this.selectedPhoneRegion.code) {
      case 'VN':
        cleanedPhone = this.formatVietnamesePhone(cleanedPhone);
        break;
      case 'US':
      case 'CA':
        cleanedPhone = this.formatNorthAmericanPhone(cleanedPhone);
        break;
      case 'GB':
        cleanedPhone = this.formatUKPhone(cleanedPhone);
        break;
      case 'AU':
        cleanedPhone = this.formatAustralianPhone(cleanedPhone);
        break;
    }
    this.booking.phone = cleanedPhone;
    this.saveBookingState();
  }

  private formatVietnamesePhone(digits: string): string {
    if (digits.startsWith('0')) digits = digits.substring(1);
    if (digits.startsWith('84')) digits = digits.substring(2);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }

  private formatNorthAmericanPhone(digits: string): string {
    if (digits.startsWith('1')) digits = digits.substring(1);
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
      6,
      10
    )}`;
  }

  private formatUKPhone(digits: string): string {
    if (digits.startsWith('44')) digits = digits.substring(2);
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }

  private formatAustralianPhone(digits: string): string {
    if (digits.startsWith('61')) digits = digits.substring(2);
    if (digits.startsWith('0')) digits = digits.substring(1);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }

  getFullPhoneNumber(): string {
    if (!this.booking.phone) return '';
    const digits = this.booking.phone.replace(/\D/g, '');
    switch (this.selectedPhoneRegion.code) {
      case 'VN':
        return `+84${digits}`;
      case 'US':
      case 'CA':
        return `+1${digits}`;
      case 'GB':
        return `+44${digits}`;
      case 'AU':
        return `+61${digits}`;
      default:
        return `${this.selectedPhoneRegion.dialCode}${digits}`;
    }
  }

  isPhoneValid(): boolean {
    if (!this.booking.phone) return false;
    const digits = this.booking.phone.replace(/\D/g, '');
    switch (this.selectedPhoneRegion.code) {
      case 'VN':
        return digits.length >= 9 && digits.length <= 10;
      case 'US':
      case 'CA':
        return digits.length === 10;
      case 'GB':
        return digits.length >= 10 && digits.length <= 11;
      case 'AU':
        return digits.length === 9;
      default:
        return digits.length >= 7 && digits.length <= 15;
    }
  }

  isTimeValid(): boolean {
    if (!this.booking.preferred_time) return false;
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d:00$/;
    return timeRegex.test(this.booking.preferred_time);
  }

  private isEmailValid(): boolean {
    if (!this.booking.email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.booking.email);
  }

  private isFormValidStep2(form: NgForm): boolean {
    const hasValidPhone = this.isPhoneValid();
    const hasFullName = !!this.booking.fullName?.trim();
    const hasMessage = !!this.booking.message?.trim();
    const hasValidEmail = !this.booking.email || this.isEmailValid();
    return (
      (form.valid ?? false) &&
      hasValidPhone &&
      hasFullName &&
      hasMessage &&
      hasValidEmail
    );
  }

  // ========== FINAL SUBMIT/UTILS ==========
  // ========== ENHANCED STATE PERSISTENCE ==========
  private saveBookingState(): void {
    try {
      // Always save current auth state context
      this.booking.phoneRegion = this.selectedPhoneRegion.code;
      this.booking.authState = this.authService.isAuthenticated();
      localStorage.setItem('bookingState', JSON.stringify(this.booking));
    } catch (error) {
      console.error('Error saving booking state:', error);
    }
  }

  private loadBookingState(): void {
    try {
      const saved = localStorage.getItem('bookingState');
      if (saved) {
        this.booking = JSON.parse(saved);

        // Restore booking type and adjust step based on current auth state
        if (this.booking.type) {
          this.bookingType = this.booking.type;

          // Adjust step based on current auth state vs saved auth state
          const wasLoggedIn = this.booking.authState || false;
          const isLoggedIn = this.authService.isAuthenticated();

          if (!wasLoggedIn && isLoggedIn) {
            // User was guest, now logged in - reset to show profile selection
            this.currentStep = 0;
          } else if (wasLoggedIn && !isLoggedIn) {
            // User was logged in, now guest - adjust step numbers
            this.currentStep = Math.max(0, Math.min(this.currentStep - 1, 0));
          }
        }
      }
    } catch (error) {
      console.error('Error loading booking state:', error);
      this.booking = {};
      this.currentStep = 0;
    }
  }
  // ========== TEMPLATE HELPER METHODS ==========
  shouldShowProfileStep(): boolean {
    const isAuthenticated = this.authService.isAuthenticated();
    const shouldShow = isAuthenticated && this.currentStep === 1;
    console.log('🔍 shouldShowProfileStep:', {
      isAuthenticated,
      currentStep: this.currentStep,
      shouldShow,
      bookingType: this.bookingType,
    });
    return shouldShow;
  }

  shouldShowPatientInfoStep(): boolean {
    return this.currentStep === 2;
  }

  shouldShowServiceStep(): boolean {
    const serviceStep = this.authService.isAuthenticated() ? 3 : 3;
    return this.currentStep === serviceStep && this.bookingType === 'serfirst';
  }

  shouldShowDoctorStep(): boolean {
    const doctorStep =
      this.bookingType === 'serfirst'
        ? this.authService.isAuthenticated()
          ? 4
          : 3
        : this.authService.isAuthenticated()
        ? 3
        : 3;
    return this.currentStep === doctorStep;
  }

  shouldShowSlotStep(): boolean {
    return this.currentStep === this.getSlotStep();
  }

  shouldShowConfirmationStep(): boolean {
    return this.currentStep === this.getConfirmationStep();
  }

  // ========== ENHANCED STEP DESCRIPTIONS ==========
  getCurrentStepDescription(): string {
    const isLoggedIn = this.authService.isAuthenticated();

    switch (this.currentStep) {
      case 0:
        return 'Choose booking type';
      case 1:
        return isLoggedIn ? 'Select profile' : 'Patient information';
      case 2:
        return isLoggedIn ? 'Patient information' : 'Select service/doctor';
      case 3:
        return isLoggedIn ? 'Select service/doctor' : 'Select doctor/service';
      case 4:
        return isLoggedIn ? 'Select doctor/service' : 'Select time slot';
      case 5:
        return isLoggedIn ? 'Select time slot' : 'Confirmation';
      case 6:
        return isLoggedIn ? 'Confirmation' : 'Complete';
      default:
        return 'Booking';
    }
  }
  // ========== SCHEDULE MAPPING ==========
  private mapScheduleForEdgeFunction(): string {
    if (this.booking.preferred_time) {
      const time = this.booking.preferred_time;
      const hour = parseInt(time.split(':')[0]);
      if (hour >= 8 && hour < 13) {
        return 'Morning';
      } else if (hour >= 13 && hour < 18) {
        return 'Afternoon';
      } else {
        return 'Evening';
      }
    }
    return 'Morning';
  }
}
