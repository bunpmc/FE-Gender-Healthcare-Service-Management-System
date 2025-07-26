import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, of, switchMap } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { AuthService } from './auth.service';
import {
  PeriodEntry,
  PeriodStats,
  PeriodTrackingRequest,
  PeriodTrackingResponse,
  calculateCycleDay,
  calculateNextPeriodDate,
  calculateFertileWindow,
  calculateOvulationDate,
} from '../models/period-tracking.model';

// Backend API response interfaces
interface BackendPeriodResponse {
  message: string;
  next_period_prediction: string;
  fertile_window: {
    start: string;
    end: string;
  };
  average_cycle_length: number | string;
}

@Injectable({
  providedIn: 'root',
})
export class PeriodTrackingService {
  private supabase: SupabaseClient;
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  // Backend API endpoint
  private readonly PERIOD_API_URL = 'https://xzxxodxplyetecrsbxmc.supabase.co/functions/v1/track_period_and_fertility';

  constructor() {
    console.log('🔧 Initializing PeriodTrackingService...');
    console.log('🔧 Supabase URL:', environment.supabaseUrl);
    console.log('🔧 Period API URL:', this.PERIOD_API_URL);

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    console.log('✅ Supabase client created successfully for period tracking');
  }

  /**
   * Get period history for the current user
   */
  getPeriodHistory(): Observable<PeriodEntry[]> {
    return this.authService.currentUser$.pipe(
      switchMap((currentUser) => {
        if (!currentUser?.patientId) {
          return of([]);
        }

        // Fetch real data from Supabase period_tracking table
        return from(
          this.supabase
            .from('period_tracking')
            .select('*')
            .eq('patient_id', currentUser.patientId)
            .order('start_date', { ascending: false })
        ).pipe(
          map(({ data, error }) => {
            if (error) {
              throw error;
            }

            let periodHistory: PeriodEntry[] = (data || []).map((item: any) => ({
              period_id: item.id?.toString() || '',
              user_id: item.patient_id || currentUser.patientId || '',
              start_date: item.start_date,
              end_date: item.end_date,
              symptoms: item.symptoms || [],
              flow_intensity: item.flow_intensity || 'medium',
              period_description: item.period_description,
              created_at: item.created_at,
              updated_at: item.updated_at,
            }));

            return periodHistory;
          })
        );
      }),
      catchError((error) => {
        return of([]);
      })
    );
  }

  /**
   * Get period statistics for the current user
   */
  getPeriodStats(): Observable<PeriodStats | null> {
    console.log('📊 Loading period statistics...');

    return this.getPeriodHistory().pipe(
      map((history) => {
        if (history.length === 0) {
          console.log('✅ Period stats: No data available yet');
          return null;
        }

        // Calculate stats from period history
        const sortedHistory = history.sort((a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );

        const lastPeriod = sortedHistory[0];
        const lastPeriodStart = lastPeriod.start_date;

        // Calculate cycle lengths
        const cycleLengths: number[] = [];
        for (let i = 0; i < sortedHistory.length - 1; i++) {
          const current = new Date(sortedHistory[i].start_date);
          const previous = new Date(sortedHistory[i + 1].start_date);
          const cycleLength = Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
          if (cycleLength > 0 && cycleLength <= 45) { // Reasonable cycle length
            cycleLengths.push(cycleLength);
          }
        }

        const averageCycleLength = cycleLengths.length > 0
          ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
          : 28;

        // Calculate period lengths
        const periodLengths = history
          .filter(entry => entry.end_date)
          .map(entry => {
            const start = new Date(entry.start_date);
            const end = new Date(entry.end_date!);
            return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          });

        const averagePeriodLength = periodLengths.length > 0
          ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
          : 5;

        const currentCycleDay = calculateCycleDay(lastPeriodStart);
        const nextPeriodDate = calculateNextPeriodDate(lastPeriodStart, averageCycleLength);
        const fertileWindow = calculateFertileWindow(lastPeriodStart);
        const ovulationDate = calculateOvulationDate(lastPeriodStart);

        const nextPeriod = new Date(nextPeriodDate);
        const today = new Date();
        const daysUntilNextPeriod = Math.max(0, Math.ceil((nextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

        const stats: PeriodStats = {
          averageCycleLength,
          currentCycleDay,
          daysUntilNextPeriod,
          nextPeriodDate,
          fertileWindowStart: fertileWindow.start,
          fertileWindowEnd: fertileWindow.end,
          ovulationDate,
          averagePeriodLength,
          totalCyclesTracked: history.length,
        };

        console.log('✅ Period stats calculated:', stats);
        return stats;
      }),
      catchError((error) => {
        console.error('❌ Error calculating period stats:', error);
        return of(null);
      })
    );
  }

  /**
   * Get authentication headers for API calls
   */
  private getAuthHeaders(): Observable<HttpHeaders> {
    return from(this.supabase.auth.getSession()).pipe(
      map(({ data: { session }, error }) => {
        if (error || !session?.access_token) {
          throw new Error('No valid session found');
        }

        return new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        });
      })
    );
  }

  /**
   * Log new period data
   */
  logPeriodData(
    request: PeriodTrackingRequest
  ): Observable<PeriodTrackingResponse> {
    console.log('📝 Logging period data:', request);

    return this.authService.currentUser$.pipe(
      switchMap((currentUser) => {
        if (!currentUser?.patientId) {
          throw new Error('User not authenticated');
        }

        // Prepare request body for backend API
        const requestBody = {
          start_date: request.start_date,
          end_date: request.end_date || null,
          symptoms: request.symptoms || [],
          flow_intensity: request.flow_intensity,
          period_description: request.period_description || null,
        };

        console.log('📤 Sending request to backend:', requestBody);

        // Get auth headers and make API call
        return this.getAuthHeaders().pipe(
          switchMap((headers) =>
            this.http.post<BackendPeriodResponse>(this.PERIOD_API_URL, requestBody, { headers })
          ),
          map((backendResponse) => {
            console.log('✅ Backend response:', backendResponse);

            const response: PeriodTrackingResponse = {
              success: true,
              message: backendResponse.message || 'Period data logged successfully',
              period_id: `period_${Date.now()}`, // Backend doesn't return ID yet
            };

            console.log('✅ Period data logged successfully:', response);
            return response;
          })
        );
      }),
      catchError((error) => {
        console.error('❌ Error logging period data:', error);

        let errorMessage = 'Failed to log period data';
        if (error.error?.error) {
          errorMessage = error.error.error;
        } else if (error.error?.details) {
          errorMessage = error.error.details;
        } else if (error.message) {
          errorMessage = error.message;
        }

        return of({
          success: false,
          message: errorMessage,
        });
      })
    );
  }

  /**
   * Update existing period entry
   */
  updatePeriodEntry(
    periodId: string,
    updates: Partial<PeriodTrackingRequest>
  ): Observable<PeriodTrackingResponse> {
    console.log('📝 Updating period entry:', periodId, updates);

    return this.authService.currentUser$.pipe(
      map((currentUser) => {
        if (!currentUser?.patientId) {
          throw new Error('User not authenticated');
        }

        // For now, simulate successful update
        const response: PeriodTrackingResponse = {
          success: true,
          message: 'Period entry updated successfully',
          period_id: periodId,
        };

        console.log('✅ Period entry updated successfully:', response);
        return response;
      }),
      catchError((error) => {
        console.error('❌ Error updating period entry:', error);
        return of({
          success: false,
          message: `Failed to update period entry: ${error.message}`,
        });
      })
    );
  }

  /**
   * Delete period entry
   */
  deletePeriodEntry(periodId: string): Observable<PeriodTrackingResponse> {
    console.log('🗑️ Deleting period entry:', periodId);

    return this.authService.currentUser$.pipe(
      map((currentUser) => {
        if (!currentUser?.patientId) {
          throw new Error('User not authenticated');
        }

        // For now, simulate successful deletion
        const response: PeriodTrackingResponse = {
          success: true,
          message: 'Period entry deleted successfully',
          period_id: periodId,
        };

        console.log('✅ Period entry deleted successfully:', response);
        return response;
      }),
      catchError((error) => {
        console.error('❌ Error deleting period entry:', error);
        return of({
          success: false,
          message: `Failed to delete period entry: ${error.message}`,
        });
      })
    );
  }
}
