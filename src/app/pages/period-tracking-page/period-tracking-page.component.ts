// ================== IMPORTS ==================
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PeriodTrackingService } from '../../services/period-tracking.service';
import {
  CalendarDay,
  PeriodEntry,
  PeriodStats,
  PeriodTrackingRequest,
  PeriodFormValidation,
  PeriodFormState,
  PERIOD_SYMPTOMS,
  FLOW_INTENSITIES,
  PeriodSymptom,
  getSymptomDisplayName,
  validatePeriodForm,
  createEmptyPeriodForm,
  isFormDirty,
  sanitizePeriodForm,
} from '../../models/period-tracking.model';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';

// ================== COMPONENT DECORATOR ==================
@Component({
  selector: 'app-period-tracking',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './period-tracking-page.component.html',
  styleUrl: './period-tracking-page.component.css',
})
export class PeriodTrackingComponent implements OnInit {
  // =========== DEPENDENCY INJECTION ===========
  private periodService = inject(PeriodTrackingService);
  private translate = inject(TranslateService);

  // =========== STATE SIGNALS ===========
  isLoading = signal(false);
  error = signal<string | null>(null);
  showLogModal = signal(false);
  showLogForm = signal(false);
  showStatsModal = signal(false);

  // =========== DATA SIGNALS ===========
  periodHistory = signal<PeriodEntry[]>([]);
  periodStats = signal<PeriodStats | null>(null);
  calendarDays = signal<CalendarDay[]>([]);
  currentMonth = signal(new Date());

  // =========== FORM DATA ===========
  logForm: PeriodTrackingRequest = createEmptyPeriodForm();
  originalForm: PeriodTrackingRequest = createEmptyPeriodForm();
  formValidation = signal<PeriodFormValidation>({ isValid: true, errors: {} });
  formState = signal<PeriodFormState>({
    isSubmitting: false,
    isDirty: false,
    validation: { isValid: true, errors: {} },
  });

  // =========== CONSTANTS ===========
  readonly symptoms = PERIOD_SYMPTOMS;
  readonly flowIntensities = FLOW_INTENSITIES;
  readonly PERIOD_SYMPTOMS = PERIOD_SYMPTOMS;
  readonly FLOW_INTENSITIES = FLOW_INTENSITIES;

  // =========== UTILITY METHODS ===========
  getSymptomDisplayName = getSymptomDisplayName;

  getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  // =========== LIFECYCLE ===========
  ngOnInit(): void {
    this.loadPeriodData();
    this.generateCalendar();
  }

  // =========== DATA LOADING ===========
  private loadPeriodData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // Load period history
    this.periodService.getPeriodHistory().subscribe({
      next: (history) => {
        this.periodHistory.set(history);
        this.generateCalendar();
      },
      error: (err) => {
        console.error('Error loading period history:', err);
        this.error.set(
          this.translate.instant('PERIOD.ERRORS.LOAD_HISTORY_FAILED')
        );
      },
    });

    // Load period stats
    this.periodService.getPeriodStats().subscribe({
      next: (stats) => {
        this.periodStats.set(stats);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading period stats:', err);
        this.error.set(
          this.translate.instant('PERIOD.ERRORS.LOAD_STATS_FAILED')
        );
        this.isLoading.set(false);
      },
    });
  }

  // =========== CALENDAR GENERATION ===========
  private generateCalendar(): void {
    const currentMonth = this.currentMonth();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const day: CalendarDay = {
        date: new Date(currentDate),
        dateString: currentDate.toISOString().split('T')[0],
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: this.isDateToday(currentDate),
        isPeriodDay: this.isPeriodDay(currentDate),
        isFertileDay: this.isFertileDay(currentDate),
        isOvulationDay: this.isOvulationDay(currentDate),
        isPredictedPeriod: this.isPredictedPeriod(currentDate),
        dayNumber: currentDate.getDate(),
        status: this.getDayStatus(currentDate),
      };

      days.push(day);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    this.calendarDays.set(days);
  }

  // =========== CALENDAR HELPER METHODS ===========
  private isDateToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  private isPeriodDay(date: Date): boolean {
    const history = this.periodHistory();
    return history.some((entry) => {
      const startDate = new Date(entry.start_date);
      const endDate = entry.end_date ? new Date(entry.end_date) : startDate;
      return date >= startDate && date <= endDate;
    });
  }

  private isFertileDay(date: Date): boolean {
    const stats = this.periodStats();
    if (!stats) return false;

    const fertileStart = new Date(stats.fertileWindowStart);
    const fertileEnd = new Date(stats.fertileWindowEnd);
    return date >= fertileStart && date <= fertileEnd;
  }

  private isOvulationDay(date: Date): boolean {
    const stats = this.periodStats();
    if (!stats) return false;

    const ovulationDate = new Date(stats.ovulationDate);
    return date.toDateString() === ovulationDate.toDateString();
  }

  private isPredictedPeriod(date: Date): boolean {
    const stats = this.periodStats();
    if (!stats) return false;

    const nextPeriod = new Date(stats.nextPeriodDate);
    const predictedEnd = new Date(nextPeriod);
    predictedEnd.setDate(predictedEnd.getDate() + 5);

    return date >= nextPeriod && date <= predictedEnd;
  }

  private getDayStatus(
    date: Date
  ): 'period' | 'fertile' | 'ovulation' | 'predicted' | 'normal' {
    if (this.isPeriodDay(date)) return 'period';
    if (this.isOvulationDay(date)) return 'ovulation';
    if (this.isFertileDay(date)) return 'fertile';
    if (this.isPredictedPeriod(date)) return 'predicted';
    return 'normal';
  }

  // =========== NAVIGATION ===========
  previousMonth(): void {
    const current = this.currentMonth();
    const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.currentMonth.set(previous);
    this.generateCalendar();
  }

  nextMonth(): void {
    const current = this.currentMonth();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.currentMonth.set(next);
    this.generateCalendar();
  }

  // =========== MODAL CONTROLS ===========
  toggleLogForm(): void {
    this.showLogForm.set(!this.showLogForm());
    if (this.showLogForm()) {
      this.logForm.start_date = new Date().toISOString().split('T')[0];
    } else {
      this.resetForm();
    }
  }

  // =========== FORM HANDLING ===========
  toggleSymptom(symptom: PeriodSymptom): void {
    const symptoms = this.logForm.symptoms || [];
    const index = symptoms.indexOf(symptom);

    if (index > -1) {
      symptoms.splice(index, 1);
    } else {
      symptoms.push(symptom);
    }

    this.logForm.symptoms = [...symptoms];
    this.validateForm();
  }

  validateForm(): void {
    const validation = validatePeriodForm(this.logForm);
    this.formValidation.set(validation);

    const isDirty = isFormDirty(this.logForm, this.originalForm);
    this.formState.update((state) => ({
      ...state,
      isDirty,
      validation,
    }));
  }

  onFormFieldChange(): void {
    this.validateForm();
  }

  isSymptomSelected(symptom: PeriodSymptom): boolean {
    return this.logForm.symptoms?.includes(symptom) || false;
  }

  resetForm(): void {
    this.logForm = createEmptyPeriodForm();
    this.originalForm = createEmptyPeriodForm();
    this.formValidation.set({ isValid: true, errors: {} });
    this.formState.set({
      isSubmitting: false,
      isDirty: false,
      validation: { isValid: true, errors: {} },
    });
  }

  // =========== FORM SUBMISSION ===========
  submitPeriodLog(): void {
    if (!this.logForm.start_date) {
      this.error.set(
        this.translate.instant('PERIOD.ERRORS.START_DATE_REQUIRED')
      );
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.periodService.logPeriodData(this.logForm).subscribe({
      next: (response) => {
        console.log('Period logged successfully:', response);
        this.toggleLogForm();
        this.loadPeriodData();

        const successMsg = this.translate.instant('PERIOD.SUCCESS.LOGGED');
        alert(successMsg);
      },
      error: (err) => {
        console.error('Error logging period:', err);
        this.error.set(this.translate.instant('PERIOD.ERRORS.LOG_FAILED'));
        this.isLoading.set(false);
      },
    });
  }

  // =========== FORM HELPER METHODS ===========
  setTodayAsStart(): void {
    const today = new Date();
    this.logForm.start_date = today.toISOString().split('T')[0];
  }

  setYesterdayAsStart(): void {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.logForm.start_date = yesterday.toISOString().split('T')[0];
  }

  isToday(dateString: string): boolean {
    if (!dateString) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  }

  isYesterday(dateString: string): boolean {
    if (!dateString) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return dateString === yesterday.toISOString().split('T')[0];
  }

  getFlowIntensityLabel(intensity: string): string {
    return this.translate.instant(`PERIOD.FLOW.${intensity.toUpperCase()}`);
  }

  getSymptomLabel(symptom: string): string {
    return this.translate.instant(`PERIOD.SYMPTOMS.${symptom.toUpperCase()}`);
  }

  // =========== CALENDAR METHODS ===========
  getMonthYearDisplay(): string {
    const current = this.currentMonth();
    return current.toLocaleDateString('vi-VN', {
      month: 'long',
      year: 'numeric',
    });
  }

  onCalendarDayClick(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      this.quickLogForDate(day.dateString);
    }
  }

  getCalendarDayClasses(day: CalendarDay): string {
    let classes = 'w-full h-full ';

    if (!day.isCurrentMonth) {
      classes += 'text-gray-300 bg-gray-50 ';
    } else {
      classes += 'text-gray-700 ';
    }

    if (day.isToday) {
      classes += 'ring-2 ring-blue-500 ring-inset ';
    }

    if (day.isPeriodDay) {
      classes += 'bg-red-500 text-white hover:bg-red-600 ';
    } else if (day.isFertileDay) {
      classes += 'bg-green-500 text-white hover:bg-green-600 ';
    } else if (day.isOvulationDay) {
      classes += 'bg-yellow-500 text-white hover:bg-yellow-600 ';
    } else if (day.isPredictedPeriod) {
      classes +=
        'bg-pink-200 text-pink-800 border-2 border-pink-500 border-dashed hover:bg-pink-300 ';
    } else {
      classes += 'bg-white hover:bg-gray-100 ';
    }

    return classes.trim();
  }

  private quickLogForDate(dateString: string): void {
    this.logForm.start_date = dateString;
    this.showLogForm.set(true);
  }

  // =========== DATE FORMATTING ===========
  formatDate(dateString?: string): string {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  // =========== COMPUTED PROPERTIES ===========
  get currentCycleDay(): number {
    const stats = this.periodStats();
    return stats?.currentCycleDay || 1;
  }

  get daysUntilNextPeriod(): number {
    const stats = this.periodStats();
    return stats?.daysUntilNextPeriod || 0;
  }

  get averageCycleLength(): number {
    const stats = this.periodStats();
    return stats?.averageCycleLength || 28;
  }

  getNextPeriodDate(): string {
    const stats = this.periodStats();
    return this.formatDate(stats?.nextPeriodDate);
  }

  getPeriodLength(): number {
    // Calculate average period length from history
    const history = this.periodHistory();
    if (history.length === 0) return 5;

    const lengths = history
      .filter((entry) => entry.end_date)
      .map((entry) => {
        const start = new Date(entry.start_date);
        const end = new Date(entry.end_date!);
        return (
          Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
          1
        );
      });

    return lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 5;
  }

  getStreakDays(): number {
    // Calculate consecutive tracking days
    const history = this.periodHistory();
    return history.length;
  }

  savePeriodData(): void {
    // Validate form before submission
    const validation = validatePeriodForm(this.logForm);
    this.formValidation.set(validation);

    if (!validation.isValid) {
      // Show first error message
      const firstError = Object.values(validation.errors)[0];
      if (firstError) {
        alert(firstError);
      }
      return;
    }

    // Sanitize form data
    const sanitizedForm = sanitizePeriodForm(this.logForm);

    this.formState.update((state) => ({ ...state, isSubmitting: true }));
    this.isLoading.set(true);

    // Use the period service to save data
    this.periodService.logPeriodData(sanitizedForm).subscribe({
      next: (response) => {
        console.log('Period logged successfully:', response);
        this.isLoading.set(false);
        this.formState.update((state) => ({ ...state, isSubmitting: false }));
        this.showLogForm.set(false);
        this.resetForm();
        this.loadPeriodData(); // Reload data to show updated information

        const successMsg = this.translate.instant('PERIOD.SUCCESS.LOGGED');
        alert(successMsg);
      },
      error: (error) => {
        console.error('Error saving period data:', error);
        this.isLoading.set(false);
        this.formState.update((state) => ({ ...state, isSubmitting: false }));

        const errorMsg = this.translate.instant('PERIOD.ERRORS.SAVE_FAILED');
        alert(errorMsg);
      },
    });
  }
}
