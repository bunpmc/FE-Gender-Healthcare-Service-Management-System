// ========== PERIOD TRACKING INTERFACES ==========

export interface PeriodEntry {
  period_id: string;
  user_id: string;
  start_date: string;
  end_date?: string;
  symptoms?: PeriodSymptom[];
  flow_intensity: FlowIntensity;
  period_description?: string;
  created_at: string;
  updated_at?: string;
}

export interface PeriodStats {
  averageCycleLength: number;
  currentCycleDay: number;
  daysUntilNextPeriod: number;
  nextPeriodDate: string;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  ovulationDate: string;
  averagePeriodLength: number;
  totalCyclesTracked: number;
}

export interface PeriodTrackingRequest {
  start_date: string;
  end_date?: string | null;
  symptoms?: PeriodSymptom[];
  flow_intensity: FlowIntensity;
  period_description?: string | null;
}

export interface PeriodTrackingResponse {
  success: boolean;
  message: string;
  period_id?: string;
  period_details?: PeriodEntry;
}

export interface PeriodFormValidation {
  isValid: boolean;
  errors: {
    start_date?: string;
    end_date?: string;
    flow_intensity?: string;
    symptoms?: string;
    period_description?: string;
  };
}

export interface PeriodFormState {
  isSubmitting: boolean;
  isDirty: boolean;
  validation: PeriodFormValidation;
}

export interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPeriodDay: boolean;
  isFertileDay: boolean;
  isOvulationDay: boolean;
  isPredictedPeriod: boolean;
  dayNumber: number;
  status: 'period' | 'fertile' | 'ovulation' | 'predicted' | 'normal';
}

// ========== TYPES ==========

export type PeriodSymptom =
  | 'cramps'
  | 'headache'
  | 'mood_swings'
  | 'bloating'
  | 'breast_tenderness'
  | 'fatigue'
  | 'nausea'
  | 'back_pain'
  | 'acne'
  | 'food_cravings'
  | 'insomnia'
  | 'diarrhea'
  | 'constipation'
  | 'hot_flashes'
  | 'dizziness';

export type FlowIntensity = 'light' | 'medium' | 'heavy' | 'very_heavy';

// ========== CONSTANTS ==========

export const PERIOD_SYMPTOMS: PeriodSymptom[] = [
  'cramps',
  'headache',
  'mood_swings',
  'bloating',
  'breast_tenderness',
  'fatigue',
  'nausea',
  'back_pain',
  'acne',
  'food_cravings',
  'insomnia',
  'diarrhea',
  'constipation',
  'hot_flashes',
  'dizziness',
];

export const FLOW_INTENSITIES: {
  value: FlowIntensity;
  label: string;
  color: string;
}[] = [
  { value: 'light', label: 'Light', color: '#fecaca' },
  { value: 'medium', label: 'Medium', color: '#f87171' },
  { value: 'heavy', label: 'Heavy', color: '#dc2626' },
  { value: 'very_heavy', label: 'Very Heavy', color: '#991b1b' },
];

// ========== HELPER FUNCTIONS ==========

export function calculateCycleDay(lastPeriodStart: string): number {
  const startDate = new Date(lastPeriodStart);
  const today = new Date();
  const diffTime = today.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

export function calculateNextPeriodDate(
  lastPeriodStart: string,
  averageCycleLength: number = 28
): string {
  const startDate = new Date(lastPeriodStart);
  const nextPeriodDate = new Date(startDate);
  nextPeriodDate.setDate(startDate.getDate() + averageCycleLength);
  return nextPeriodDate.toISOString().split('T')[0];
}

export function calculateFertileWindow(lastPeriodStart: string): {
  start: string;
  end: string;
} {
  const startDate = new Date(lastPeriodStart);

  // Fertile window typically starts around day 10 and ends around day 17
  const fertileStart = new Date(startDate);
  fertileStart.setDate(startDate.getDate() + 9); // Day 10

  const fertileEnd = new Date(startDate);
  fertileEnd.setDate(startDate.getDate() + 16); // Day 17

  return {
    start: fertileStart.toISOString().split('T')[0],
    end: fertileEnd.toISOString().split('T')[0],
  };
}

export function calculateOvulationDate(lastPeriodStart: string): string {
  const startDate = new Date(lastPeriodStart);
  const ovulationDate = new Date(startDate);
  ovulationDate.setDate(startDate.getDate() + 13); // Day 14
  return ovulationDate.toISOString().split('T')[0];
}

export function isDateInRange(
  date: string,
  startDate: string,
  endDate: string
): boolean {
  const checkDate = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);
  return checkDate >= start && checkDate <= end;
}

export function formatDateForDisplay(
  dateString: string,
  locale: string = 'vi-VN'
): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getSymptomDisplayName(symptom: PeriodSymptom): string {
  const symptomNames: Record<PeriodSymptom, string> = {
    cramps: 'Cramps',
    headache: 'Headache',
    mood_swings: 'Mood Swings',
    bloating: 'Bloating',
    breast_tenderness: 'Breast Tenderness',
    fatigue: 'Fatigue',
    nausea: 'Nausea',
    back_pain: 'Back Pain',
    acne: 'Acne',
    food_cravings: 'Food Cravings',
    insomnia: 'Insomnia',
    diarrhea: 'Diarrhea',
    constipation: 'Constipation',
    hot_flashes: 'Hot Flashes',
    dizziness: 'Dizziness',
  };

  return symptomNames[symptom] || symptom;
}

export function getFlowIntensityColor(intensity: FlowIntensity): string {
  const colors: Record<FlowIntensity, string> = {
    light: '#fecaca', // light red
    medium: '#f87171', // medium red
    heavy: '#dc2626', // dark red
    very_heavy: '#991b1b', // very dark red
  };

  return colors[intensity] || colors.medium;
}

// ========== FORM VALIDATION FUNCTIONS ==========

export function validatePeriodForm(
  form: PeriodTrackingRequest
): PeriodFormValidation {
  const errors: PeriodFormValidation['errors'] = {};
  let isValid = true;

  // Validate start date
  if (!form.start_date || form.start_date.trim() === '') {
    errors.start_date = 'Start date is required';
    isValid = false;
  } else {
    const startDate = new Date(form.start_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (isNaN(startDate.getTime())) {
      errors.start_date = 'Invalid start date format';
      isValid = false;
    } else if (startDate > today) {
      errors.start_date = 'Start date cannot be in the future';
      isValid = false;
    }
  }

  // Validate end date if provided
  if (form.end_date && form.end_date.trim() !== '') {
    const endDate = new Date(form.end_date);
    const startDate = new Date(form.start_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (isNaN(endDate.getTime())) {
      errors.end_date = 'Invalid end date format';
      isValid = false;
    } else if (endDate > today) {
      errors.end_date = 'End date cannot be in the future';
      isValid = false;
    } else if (form.start_date && endDate < startDate) {
      errors.end_date = 'End date must be after start date';
      isValid = false;
    } else {
      // Check if period duration is reasonable (max 10 days)
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 10) {
        errors.end_date = 'Period duration cannot exceed 10 days';
        isValid = false;
      }
    }
  }

  // Validate flow intensity
  if (
    !form.flow_intensity ||
    !['light', 'medium', 'heavy', 'very_heavy'].includes(form.flow_intensity)
  ) {
    errors.flow_intensity = 'Please select a valid flow intensity';
    isValid = false;
  }

  // Validate symptoms (optional but if provided, should be valid)
  if (form.symptoms && form.symptoms.length > 0) {
    const invalidSymptoms = form.symptoms.filter(
      (symptom) => !PERIOD_SYMPTOMS.includes(symptom)
    );
    if (invalidSymptoms.length > 0) {
      errors.symptoms = 'Invalid symptoms selected';
      isValid = false;
    }
  }

  // Validate description length
  if (form.period_description && form.period_description.length > 500) {
    errors.period_description = 'Description cannot exceed 500 characters';
    isValid = false;
  }

  return { isValid, errors };
}

export function createEmptyPeriodForm(): PeriodTrackingRequest {
  return {
    start_date: '',
    end_date: null,
    symptoms: [],
    flow_intensity: 'medium',
    period_description: null,
  };
}

export function isFormDirty(
  form: PeriodTrackingRequest,
  originalForm: PeriodTrackingRequest
): boolean {
  return (
    form.start_date !== originalForm.start_date ||
    form.end_date !== originalForm.end_date ||
    form.flow_intensity !== originalForm.flow_intensity ||
    form.period_description !== originalForm.period_description ||
    JSON.stringify(form.symptoms?.sort()) !==
      JSON.stringify(originalForm.symptoms?.sort())
  );
}

export function sanitizePeriodForm(
  form: PeriodTrackingRequest
): PeriodTrackingRequest {
  return {
    start_date: form.start_date?.trim() || '',
    end_date: form.end_date?.trim() || null,
    symptoms:
      form.symptoms?.filter((symptom) => PERIOD_SYMPTOMS.includes(symptom)) ||
      [],
    flow_intensity: ['light', 'medium', 'heavy', 'very_heavy'].includes(
      form.flow_intensity
    )
      ? form.flow_intensity
      : 'medium',
    period_description:
      form.period_description?.trim().substring(0, 500) || null,
  };
}
