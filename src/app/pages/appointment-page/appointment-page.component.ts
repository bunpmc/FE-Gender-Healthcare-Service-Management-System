import { Component, inject, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DoctorService } from '../../services/doctor.service';
import { MedicalService } from '../../services/medical.service';
import { BookingService } from '../../services/booking.service';

import {
  BookingState,
  DoctorBooking,
  DoctorSlotDetail,
  PhoneRegion,
  ServiceBooking,
  TimeSlot,
  AppointmentCreateRequest,
} from '../../models/booking.model';
import {
  MOCK_DOCTOR_SLOTS,
  MOCK_DOCTORS,
  MOCK_PHONE_REGIONS,
  MOCK_SERVICES,
} from '../../data/mock-data';

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
  currentStep: number = 0;
  bookingType: 'docfirst' | 'serfirst' | null = null;
  selectedType: 'serfirst' | 'docfirst' | null = null;
  formSubmitted: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  booking: BookingState = {};
  slotsForSelectedDate: DoctorSlotDetail[] = [];

  // ========== DATA SOURCES ==========
  doctors: DoctorBooking[] = [];
  services: ServiceBooking[] = [];
  availableDoctors: DoctorBooking[] = [];
  selectedDoctor: DoctorBooking | null = null;

  // ========== PHONE REGION ==========
  phoneRegions: PhoneRegion[] = MOCK_PHONE_REGIONS;
  selectedPhoneRegion: PhoneRegion = MOCK_PHONE_REGIONS[0];

  // ========== FILTERS ==========
  doctorSort: 'name' | 'specialization' = 'name';
  doctorGenderFilter: '' | 'male' | 'female' = '';
  doctorSearch: string = '';
  serviceSearch: string = '';
  serviceSort: 'name' | 'desc' = 'name';

  // ========== SLOT STATE STEP 4 ==========
  availableDates: string[] = [];
  allDoctorSlots: DoctorSlotDetail[] = []; // Store all slots from API
  selectedDate: string = '';

  // ========== INIT ==========
  ngOnInit(): void {
    this.loadDoctors();
    this.loadServices();
    this.loadBookingState();
    if (this.booking.phoneRegion) {
      const savedRegion = this.phoneRegions.find(
        (r) => r.code === this.booking.phoneRegion
      );
      if (savedRegion) this.selectedPhoneRegion = savedRegion;
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
        // Fallback to mock data if API fails
        this.doctors = MOCK_DOCTORS;
        this.availableDoctors = [...MOCK_DOCTORS];
      },
    });
  }

  private loadServices(): void {
    this.medicalService.fetchServiceBooking().subscribe({
      next: (apiServices: any[]) => {
        // Map API response to ServiceBooking format
        this.services = apiServices.map((service) => ({
          service_id: service.service_id,
          name: service.service_name, // Map service_name to name
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
        // Fallback to old API endpoint
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
            // Final fallback to mock data
            this.services = MOCK_SERVICES;
            console.log('Using mock services data');
          },
        });
      },
    });
  }
  get progressWidth(): string {
    // Tổng số bước thực hiện là 5 (step 0 ~ 4, có thể tùy thực tế của bạn)
    const totalSteps = 5;
    // Nếu có step submit cuối cùng thì đổi thành 6.
    const percent = Math.floor((this.currentStep / (totalSteps - 1)) * 100);
    return percent + '%';
  }

  // ========== STEP/NAVIGATION ==========
  chooseBookingType(type: 'serfirst' | 'docfirst' | null) {
    if (type) {
      this.bookingType = type;
      this.booking.type = type;
      this.currentStep = 1;
      this.errorMessage = null;
      this.saveBookingState();
    }
  }
  goToNextStep() {
    if (this.bookingType === 'serfirst') {
      if (this.currentStep === 2) this.getDoctorsByService();
      this.currentStep++;
    } else if (this.bookingType === 'docfirst') {
      this.currentStep++;
    }
    if (this.currentStep === 4) this.initSlotStep();
    this.formSubmitted = false;
    this.errorMessage = null;
    this.saveBookingState();
  }
  goToPrevStep() {
    if (this.currentStep === 1) {
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

  // ========== FORM ACTIONS ==========
  onContinueService(): void {
    this.formSubmitted = true;
    this.errorMessage = null;
    if (!this.booking.service_id) {
      this.errorMessage = this.translate.instant(
        'APPOINTMENT.ERRORS.SERVICE_REQUIRED'
      );
      return;
    }
    this.goToNextStep();
  }
  onContinueDoctor(): void {
    this.formSubmitted = true;
    this.errorMessage = null;
    if (!this.booking.doctor_id) {
      this.errorMessage = this.translate.instant(
        'APPOINTMENT.ERRORS.DOCTOR_REQUIRED'
      );
      return;
    }
    this.goToNextStep();
  }
  submitPatientForm(form: NgForm): void {
    this.formSubmitted = true;
    this.errorMessage = null;
    if (this.isFormValidStep2(form)) {
      if (this.bookingType === 'docfirst') {
        this.availableDoctors = [...this.doctors];
      }
      this.goToNextStep();
    } else {
      this.scrollToFirstError();
    }
  }

  selectService(service: ServiceBooking): void {
    this.booking.service_id = service.service_id;
    this.saveBookingState();
  }
  selectDoctor(doctor: DoctorBooking): void {
    this.booking.doctor_id = doctor.doctor_id;
    this.selectedDoctor = doctor;
    this.saveBookingState();
  }

  // ========== STEP 4: SLOT LOGIC ==========
  initSlotStep() {
    if (!this.booking.doctor_id) {
      console.error('No doctor selected for slot loading');
      return;
    }

    // Load slots from API instead of mock data
    this.loadDoctorSlots(this.booking.doctor_id);
  }

  private loadDoctorSlots(doctor_id: string): void {
    this.bookingService.fetchSlotsByDoctorId(doctor_id).subscribe({
      next: (response: any) => {
        if (response && response.slots) {
          // Map API response to DoctorSlotDetail format
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

          // Filter only active slots
          const activeSlots = apiSlots.filter((slot: any) => slot.is_active);

          // Extract unique dates and sort them
          this.availableDates = Array.from(
            new Set(activeSlots.map((s: any) => s.slot_date))
          );
          this.availableDates.sort();

          // Set selected date
          this.selectedDate = this.availableDates.includes(this.selectedDate)
            ? this.selectedDate
            : this.availableDates[0] || '';

          // Store all slots for later use
          this.allDoctorSlots = activeSlots;

          // Update slots for selected date
          this.updateSlotsForDate();

          console.log('Loaded doctor slots from API:', activeSlots);
        }
      },
      error: (error) => {
        console.error('Error loading doctor slots:', error);
        // Fallback to mock data
        const allSlots = MOCK_DOCTOR_SLOTS.filter(
          (slot) => slot.doctor_id === this.booking.doctor_id && slot.is_active
        );
        this.availableDates = Array.from(
          new Set(allSlots.map((s) => s.slot_date))
        );
        this.availableDates.sort();
        this.selectedDate = this.availableDates.includes(this.selectedDate)
          ? this.selectedDate
          : this.availableDates[0] || '';
        this.updateSlotsForDate();
        console.log('Using mock slots data due to API error');
      },
    });

    // Reset booking slot selection
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
    // Filter slots for selected date from already loaded slots
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
      // Fallback to mock data if no API data available
      this.slotsForSelectedDate = MOCK_DOCTOR_SLOTS.filter(
        (slot) =>
          slot.doctor_id === this.booking.doctor_id &&
          slot.slot_date === this.selectedDate
      ).sort((a, b) => a.slot_time.localeCompare(b.slot_time));
    }
  }
  selectSlot(slot: DoctorSlotDetail) {
    if (slot.is_active && slot.appointments_count < slot.max_appointments) {
      this.booking.preferred_slot_id = slot.doctor_slot_id;
      this.booking.preferred_time = slot.slot_time;
      this.formSubmitted = false;
      this.saveBookingState();
    }
  }
  onContinueSlot() {
    this.formSubmitted = true;
    if (!this.booking.preferred_slot_id) {
      this.errorMessage = this.translate.instant(
        'APPOINTMENT.ERRORS.SLOT_REQUIRED'
      );
      return;
    }

    // Validate required fields before redirecting
    if (!this.booking.fullName || !this.booking.phone) {
      this.errorMessage = 'Please fill in all required personal information.';
      return;
    }

    if (!this.booking.doctor_id || !this.booking.preferred_slot_id) {
      this.errorMessage = 'Please select a doctor and time slot.';
      return;
    }

    // Prepare appointment data for the result page
    const appointmentData = {
      // Personal information
      full_name: this.booking.fullName,
      phone: this.getFullPhoneNumber(),
      email: this.booking.email || '',
      gender: this.booking.gender || 'other',

      // Medical information
      visit_type: 'consultation',
      schedule: 'specific_time',
      message: this.booking.message || '',

      // Doctor and service
      doctor_id: this.booking.doctor_id,
      category_id: this.booking.service_id,

      // Slot information
      slot_id: this.booking.preferred_slot_id,
      preferred_date: this.selectedDate,
      preferred_time: this.booking.preferred_time,

      // Booking type
      booking_type: this.booking.type || 'docfirst',
    };

    // Store appointment data in session storage for the result page
    const appointmentResult = {
      success: false, // Set to false initially, will be processed on result page
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

    sessionStorage.setItem(
      'appointmentResult',
      JSON.stringify(appointmentResult)
    );

    console.log(
      '🧭 Redirecting to appointment result page with data:',
      appointmentResult
    );
    this.router.navigate(['/appointment-success']);

    // Reset form
    this.resetForm();
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
  getDoctorServices(): ServiceBooking[] {
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
  private scrollToFirstError(): void {
    setTimeout(() => {
      const errorElement = document.querySelector('.border-red-400');
      if (errorElement) {
        errorElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 100);
  }
  private loadBookingState(): void {
    try {
      const saved = localStorage.getItem('bookingState');
      if (saved) {
        this.booking = JSON.parse(saved);
        if (this.booking.type) {
          this.bookingType = this.booking.type;
          this.currentStep = 2;
        }
      }
    } catch (error) {
      this.booking = {};
      this.currentStep = 0;
    }
  }
  private saveBookingState(): void {
    try {
      this.booking.phoneRegion = this.selectedPhoneRegion.code;
      localStorage.setItem('bookingState', JSON.stringify(this.booking));
    } catch (error) {}
  }
  hasBookingData(): boolean {
    return !!(
      this.booking.type ||
      this.booking.fullName ||
      this.booking.email ||
      this.booking.phone ||
      this.booking.gender ||
      this.booking.message ||
      this.booking.doctor_id ||
      this.booking.service_id ||
      this.booking.preferred_date ||
      this.booking.preferred_time ||
      this.booking.preferred_slot_id ||
      this.booking.schedule
    );
  }
  resetForm(): void {
    this.booking = {};
    this.currentStep = 0;
    this.bookingType = null;
    this.formSubmitted = false;
    this.errorMessage = null;
    this.successMessage = null;
    this.selectedPhoneRegion = this.phoneRegions[0];
    this.availableDoctors = [...this.doctors];
    this.selectedDoctor = null;
    this.doctorGenderFilter = '';
    this.doctorSearch = '';
    this.serviceSearch = '';
    this.serviceSort = 'name';
    this.doctorSort = 'name';
    localStorage.removeItem('bookingState');
  }
  goHome(event: Event): void {
    event.preventDefault();
    if (this.hasBookingData()) {
      const confirmMessage = this.translate.instant(
        'APPOINTMENT.CONFIRM_LEAVE'
      );
      const confirmLeave = window.confirm(confirmMessage);
      if (confirmLeave) {
        this.resetForm();
        this.router.navigate(['/']);
      }
    } else {
      this.router.navigate(['/']);
    }
  }

  // ========== REMOVED SUBMIT BOOKING ==========
  // Appointment creation is now handled on the result page
}
