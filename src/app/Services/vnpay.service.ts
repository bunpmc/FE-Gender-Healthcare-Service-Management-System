import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  VNPayPaymentRequest,
  VNPayPaymentResponse,
  VNPayCallbackData,
  PaymentTransaction,
  PaymentResult,
} from '../models/payment.model';

@Injectable({
  providedIn: 'root',
})
export class VnpayService {
  private readonly vnpayPaymentUrl =
    'https://xzxxodxplyetecrsbxmc.supabase.co/functions/v1/vnpay-payment';
  private readonly vnpayCallbackUrl =
    'https://xzxxodxplyetecrsbxmc.supabase.co/functions/v1/vnpay-callback';

  constructor(private http: HttpClient) {}

  // Get HTTP headers
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  // Create VNPay payment URL
  createPayment(
    paymentRequest: VNPayPaymentRequest
  ): Observable<VNPayPaymentResponse> {
    const payload = {
      amount: paymentRequest.amount,
      orderInfo: paymentRequest.orderInfo,
      patientId: paymentRequest.patientId,
      services: paymentRequest.services,
    };

    return this.http.post<VNPayPaymentResponse>(this.vnpayPaymentUrl, payload, {
      headers: this.getHeaders(),
    });
  }

  // Verify VNPay callback - calls your callback edge function to update database
  verifyCallback(callbackData: VNPayCallbackData): Observable<PaymentResult> {
    return this.http.post<PaymentResult>(this.vnpayCallbackUrl, callbackData, {
      headers: this.getHeaders(),
    });
  }

  // Save transaction to database
  saveTransaction(transaction: PaymentTransaction): Observable<any> {
    return this.http.post(
      `${environment.apiEndpoint}/save-transaction`,
      transaction,
      { headers: this.getHeaders() }
    );
  }

  // Get transaction by ID
  getTransaction(transactionId: string): Observable<PaymentTransaction> {
    return this.http.get<PaymentTransaction>(
      `${environment.apiEndpoint}/get-transaction/${transactionId}`,
      { headers: this.getHeaders() }
    );
  }

  // Get user transactions
  getUserTransactions(userId: string): Observable<PaymentTransaction[]> {
    return this.http.get<PaymentTransaction[]>(
      `${environment.apiEndpoint}/get-user-transactions/${userId}`,
      { headers: this.getHeaders() }
    );
  }

  // Generate return URL for VNPay
  generateReturnUrl(): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/payment-result`;
  }

  // Get client IP (simplified version)
  private getClientIP(): string {
    // In a real application, you might want to get the actual client IP
    // For now, return a default value
    return '127.0.0.1';
  }

  // Format amount for VNPay (VNPay requires amount in VND without decimal)
  formatAmountForVNPay(amount: number): number {
    // VNPay expects amount in VND cents (multiply by 100)
    return Math.round(amount * 100);
  }

  // Parse VNPay callback URL parameters
  parseCallbackParams(url: string): VNPayCallbackData | null {
    try {
      const urlParams = new URLSearchParams(url.split('?')[1]);

      return {
        vnp_Amount: urlParams.get('vnp_Amount') || '',
        vnp_BankCode: urlParams.get('vnp_BankCode') || '',
        vnp_BankTranNo: urlParams.get('vnp_BankTranNo') || '',
        vnp_CardType: urlParams.get('vnp_CardType') || '',
        vnp_OrderInfo: urlParams.get('vnp_OrderInfo') || '',
        vnp_PayDate: urlParams.get('vnp_PayDate') || '',
        vnp_ResponseCode: urlParams.get('vnp_ResponseCode') || '',
        vnp_TmnCode: urlParams.get('vnp_TmnCode') || '',
        vnp_TransactionNo: urlParams.get('vnp_TransactionNo') || '',
        vnp_TransactionStatus: urlParams.get('vnp_TransactionStatus') || '',
        vnp_TxnRef: urlParams.get('vnp_TxnRef') || '',
        vnp_SecureHash: urlParams.get('vnp_SecureHash') || '',
      };
    } catch (error) {
      console.error('Error parsing VNPay callback parameters:', error);
      return null;
    }
  }

  // Check if payment was successful based on response code
  isPaymentSuccessful(responseCode: string): boolean {
    return responseCode === '00';
  }

  // Get payment status message
  getPaymentStatusMessage(responseCode: string): string {
    const statusMessages: { [key: string]: string } = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.',
    };

    return (
      statusMessages[responseCode] ||
      'Giao dịch không thành công do lỗi không xác định.'
    );
  }
}
