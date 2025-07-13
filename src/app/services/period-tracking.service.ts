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
      map(currentUser => {
        if (!currentUser?.patientId) {
          console.log('👤 No authenticated user found');
          return [];
        }
        
        // For now, return mock data until we set up the database table
        const mockHistory: PeriodEntry[] = [
          {
            period_id: '1',
            user_id: currentUser.patientId,
            start_date: '2024-06-15',
            end_date: '2024-06-20',
            symptoms: ['cramps', 'mood_swings'],
            flow_intensity: 'medium',
            period_description: 'Normal cycle',
            created_at: '2024-06-15T00:00:00Z',
          },
          {
            period_id: '2',
            user_id: currentUser.patientId,
            start_date: '2024-07-13',
            end_date: '2024-07-18',
            symptoms: ['headache', 'bloating'],
            flow_intensity: 'heavy',
            period_description: 'Heavy flow this month',
            created_at: '2024-07-13T00:00:00Z',
          },
        ];
        
        console.log('✅ Period history loaded:', mockHistory);
        return mockHistory;
      }),
      catchError(error => {
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
      map(currentUser => {
        if (!currentUser?.patientId) {
          console.log('👤 No authenticated user found');
          return null;
        }
        
        // Calculate mock stats based on current date
        const today = new Date();
        const lastPeriodStart = new Date('2024-07-13');
        const daysSinceLastPeriod = Math.floor((today.getTime() - lastPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
        const averageCycleLength = 28;
        const currentCycleDay = daysSinceLastPeriod + 1;
        const daysUntilNextPeriod = averageCycleLength - currentCycleDay;
        
        const nextPeriodDate = new Date(today);
        nextPeriodDate.setDate(today.getDate() + daysUntilNextPeriod);
        
        // Calculate fertile window (typically days 10-17 of cycle)
        const fertileStart = new Date(lastPeriodStart);
        fertileStart.setDate(lastPeriodStart.getDate() + 10);
        const fertileEnd = new Date(lastPeriodStart);
        fertileEnd.setDate(lastPeriodStart.getDate() + 17);
        
        // Calculate ovulation day (typically day 14)
        const ovulationDate = new Date(lastPeriodStart);
        ovulationDate.setDate(lastPeriodStart.getDate() + 14);
        
        const mockStats: PeriodStats = {
          averageCycleLength,
          currentCycleDay,
          daysUntilNextPeriod: Math.max(0, daysUntilNextPeriod),
          nextPeriodDate: nextPeriodDate.toISOString().split('T')[0],
          fertileWindowStart: fertileStart.toISOString().split('T')[0],
          fertileWindowEnd: fertileEnd.toISOString().split('T')[0],
          ovulationDate: ovulationDate.toISOString().split('T')[0],
          averagePeriodLength: 5,
          totalCyclesTracked: 12,
        };
        
        console.log('✅ Period stats calculated:', mockStats);
        return mockStats;
      }),
      catchError(error => {
        console.error('❌ Error loading period stats:', error);
        return of(null);
      })
    );
  }

  /**
   * Log new period data
   */
  logPeriodData(request: PeriodTrackingRequest): Observable<PeriodTrackingResponse> {
    console.log('📝 Logging period data:', request);
    
    return this.authService.currentUser$.pipe(
      map(currentUser => {
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
      catchError(error => {
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
  updatePeriodEntry(periodId: string, updates: Partial<PeriodTrackingRequest>): Observable<PeriodTrackingResponse> {
    console.log('📝 Updating period entry:', periodId, updates);
    
    return this.authService.currentUser$.pipe(
      map(currentUser => {
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
      catchError(error => {
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
      map(currentUser => {
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
      catchError(error => {
        console.error('❌ Error deleting period entry:', error);
        return of({
          success: false,
          message: `Failed to delete period entry: ${error.message}`,
        });
      })
    );
  }
}
