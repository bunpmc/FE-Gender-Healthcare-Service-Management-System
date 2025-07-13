import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { VnpayService } from '../../services/vnpay.service';
import { CartService } from '../../services/cart.service';
import { VNPayCallbackData, PaymentResult } from '../../models/payment.model';

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './payment-result-page.component.html',
  styleUrl: './payment-result-page.component.css',
})
export class PaymentResultComponent implements OnInit {
  isLoading = true;
  paymentResult: PaymentResult | null = null;
  callbackData: VNPayCallbackData | null = null;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vnpayService: VnpayService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.processPaymentCallback();
  }

  private processPaymentCallback(): void {
    // Get all query parameters from the URL
    this.route.queryParams.subscribe((params) => {
      if (Object.keys(params).length === 0) {
        this.errorMessage = 'Không tìm thấy thông tin thanh toán';
        this.isLoading = false;
        return;
      }

      console.log('Received VNPay callback parameters:', params);

      // Use the enhanced VnpayService to parse callback data
      this.callbackData =
        this.vnpayService.parseCallbackFromQueryParams(params);

      if (!this.callbackData) {
        this.errorMessage = 'Dữ liệu thanh toán không hợp lệ hoặc bị thiếu';
        this.isLoading = false;
        return;
      }

      // Verify payment with backend using the enhanced method
      this.verifyPayment();
    });
  }

  private verifyPayment(): void {
    if (!this.callbackData) {
      this.errorMessage = 'Dữ liệu thanh toán không hợp lệ';
      this.isLoading = false;
      return;
    }

    this.vnpayService.verifyCallback(this.callbackData).subscribe({
      next: (result: any) => {
        // Handle the edge function response format
        if (result.status === 'success') {
          this.paymentResult = {
            success: true,
            message: result.message,
            transaction_id: result.transactionNo,
            payment_details: this.callbackData ?? undefined,
          };
          // Clear cart if payment was successful
          this.cartService.clearCart();
        } else if (result.status === 'failed') {
          this.paymentResult = {
            success: false,
            message: result.message,
            payment_details: this.callbackData ?? undefined,
          };
        } else {
          // Handle error status
          this.paymentResult = {
            success: false,
            message: result.message || 'Có lỗi xảy ra khi xử lý thanh toán',
            payment_details: this.callbackData ?? undefined,
          };
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Payment verification error:', error);
        this.errorMessage =
          error.error?.message || 'Có lỗi xảy ra khi xác thực thanh toán';
        this.isLoading = false;
      },
    });
  }

  // Check if payment was successful
  isPaymentSuccessful(): boolean {
    return this.paymentResult?.success === true;
  }

  // Get payment status message
  getStatusMessage(): string {
    return this.paymentResult?.message || '';
  }

  // Format amount for display
  formatAmount(): string {
    if (!this.callbackData?.vnp_Amount) return '';
    const amount = parseInt(this.callbackData.vnp_Amount) / 100;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  // Format payment date
  formatPaymentDate(): string {
    if (!this.callbackData?.vnp_PayDate) return '';

    const dateStr = this.callbackData.vnp_PayDate;
    // VNPay date format: yyyyMMddHHmmss
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const minute = dateStr.substring(10, 12);
    const second = dateStr.substring(12, 14);

    const date = new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second}`
    );
    return date.toLocaleString('vi-VN');
  }

  // Navigate to home
  goHome(): void {
    this.router.navigate(['/']);
  }

  // Navigate to services
  goToServices(): void {
    this.router.navigate(['/service']);
  }

  // Print receipt (optional)
  printReceipt(): void {
    window.print();
  }

  // Get order ID (vnp_TxnRef) for display
  getOrderId(): string {
    return this.callbackData?.vnp_TxnRef || 'N/A';
  }

  // Check if order ID (vnp_TxnRef) is available
  hasOrderId(): boolean {
    return !!(
      this.callbackData?.vnp_TxnRef && this.callbackData.vnp_TxnRef.trim()
    );
  }
}
