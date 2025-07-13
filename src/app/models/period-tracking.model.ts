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
  end_date?: string;
  symptoms?: PeriodSymptom[];
  flow_intensity: FlowIntensity;
  period_description?: string;
}

export interface PeriodTrackingResponse {
  success: boolean;
  message: string;
  period_id?: string;
  period_details?: PeriodEntry;
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
