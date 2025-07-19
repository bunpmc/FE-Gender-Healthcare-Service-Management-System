import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, of } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { AuthService } from './auth.service';
import {
  PeriodEntry,
  PeriodStats,
  PeriodTrackingRequest,
  PeriodTrackingResponse,
} from '../models/period-tracking.model';

@Injectable({
  providedIn: 'root',
})
export class PeriodTrackingService {
  private supabase: SupabaseClient;
  private authService = inject(AuthService);

  constructor() {
    console.log('🔧 Initializing PeriodTrackingService...');
    console.log('🔧 Supabase URL:', environment.supabaseUrl);

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
    console.log('📅 Loading period history...');

    return this.authService.currentUser$.pipe(
      map((currentUser) => {
        if (!currentUser?.patientId) {
          console.log('👤 No authenticated user found');
          return [];
        }

        // TODO: Fetch real data from Supabase period_tracking table
        // For now, return empty array until database is set up
        const periodHistory: PeriodEntry[] = [];

        console.log('✅ Period history loaded:', periodHistory);
        return periodHistory;
      }),
      catchError((error) => {
        console.error('❌ Error loading period history:', error);
        return of([]);
      })
    );
  }

  /**
   * Get period statistics for the current user
   */
  getPeriodStats(): Observable<PeriodStats | null> {
    console.log('📊 Loading period statistics...');

    return this.authService.currentUser$.pipe(
      map((currentUser) => {
        if (!currentUser?.patientId) {
          console.log('👤 No authenticated user found');
          return null;
        }

        // TODO: Calculate real stats from period history data
        // For now, return null until we have real data
        console.log('✅ Period stats: No data available yet');
        return null;
      }),
      catchError((error) => {
        console.error('❌ Error loading period stats:', error);
        return of(null);
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
      map((currentUser) => {
        if (!currentUser?.patientId) {
          throw new Error('User not authenticated');
        }

        // For now, simulate successful logging
        // In the future, this will save to Supabase database
        const response: PeriodTrackingResponse = {
          success: true,
          message: 'Period data logged successfully',
          period_id: `period_${Date.now()}`,
        };

        console.log('✅ Period data logged successfully:', response);
        return response;
      }),
      catchError((error) => {
        console.error('❌ Error logging period data:', error);
        return of({
          success: false,
          message: `Failed to log period data: ${error.message}`,
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
