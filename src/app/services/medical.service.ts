// ================== IMPORTS ==================
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import {
  type MedicalService as MedicalServiceModel,
  type ServiceDetail,
} from '../models/service.model';
import { ServiceBooking } from '../models/booking.model';
import { Observable } from 'rxjs';

// ================== SERVICE DECORATOR ==================
@Injectable({
  providedIn: 'root',
})
export class MedicalService {
  // =========== CONSTRUCTOR ===========
  constructor(private http: HttpClient) {}

  // =========== PRIVATE HEADER BUILDER ===========
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  // =========== FETCH SERVICES ===========
  /**
   * Gọi API lấy danh sách dịch vụ y tế
   */
  getServices(): Observable<MedicalServiceModel[]> {
    return this.http.get<MedicalServiceModel[]>(
      `${environment.apiEndpoint}/fetch-service`,
      {
        headers: this.getHeaders(),
      }
    );
  }

  // =========== FALLBACK MOCK SERVICES ===========
  /**
   * Mock services for testing when API is down
   */
  getMockServices(): Observable<MedicalServiceModel[]> {
    const mockServices: MedicalServiceModel[] = [
      {
        id: 'mock-1',
        name: 'Khám Phụ Khoa Tổng Quát',
        excerpt: 'Khám sức khỏe phụ khoa định kỳ, tầm soát các bệnh lý phụ khoa',
        price: 300000,
        image_link: '/assets/images/gynecology.jpg',
        service_categories: {
          category_id: 'cat-1',
          category_name: 'Gynecology'
        }
      },
      {
        id: 'mock-2',
        name: 'Siêu Âm Thai',
        excerpt: 'Siêu âm theo dõi sự phát triển của thai nhi',
        price: 250000,
        image_link: '/assets/images/ultrasound.jpg',
        service_categories: {
          category_id: 'cat-2',
          category_name: 'Reproductive Health'
        }
      },
      {
        id: 'mock-3',
        name: 'Xét Nghiệm Hormone',
        excerpt: 'Xét nghiệm các hormone sinh dục nữ',
        price: 400000,
        image_link: '/assets/images/hormone-test.jpg',
        service_categories: {
          category_id: 'cat-2',
          category_name: 'Reproductive Health'
        }
      }
    ];

    return new Observable(observer => {
      observer.next(mockServices);
      observer.complete();
    });
  }

  // =========== FETCH SERVICE BY ID ===========
  /**
   * Gọi API lấy dịch vụ theo ID
   */
  getServiceById(serviceId: string): Observable<ServiceDetail> {
    const params = new HttpParams().set('service_id', serviceId);
    return this.http.get<ServiceDetail>(
      `${environment.apiEndpoint}/fetch-service-id`,
      {
        params,
        headers: this.getHeaders(),
      }
    );
  }

  // =========== FETCH SERVICES FOR BOOKING ===========
  /**
   * Lấy danh sách dịch vụ cho booking (old endpoint)
   */
  fetchService(): Observable<ServiceBooking[]> {
    return this.http.get<ServiceBooking[]>(
      `${environment.apiEndpoint}/fetch-service`,
      {
        headers: this.getHeaders(),
      }
    );
  }

  // =========== FETCH SERVICES FOR BOOKING (NEW ENDPOINT) ===========
  /**
   * Lấy danh sách dịch vụ cho booking từ endpoint mới
   */
  fetchServiceBooking(): Observable<ServiceBooking[]> {
    return this.http.get<ServiceBooking[]>(
      `${environment.apiEndpoint}/fetch-serviceBooking`,
      {
        headers: this.getHeaders(),
      }
    );
  }
}
