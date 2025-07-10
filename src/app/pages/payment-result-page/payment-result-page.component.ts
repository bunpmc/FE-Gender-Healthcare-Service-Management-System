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
      console.log('Payment callback params:', params);

      if (Object.keys(params).length === 0) {
        this.errorMessage = 'Không tìm thấy thông tin thanh toán';
        this.isLoading = false;
        return;
      }

      // Parse VNPay callback data
      this.callbackData = {
        vnp_Amount: params['vnp_Amount'] || '',
        vnp_BankCode: params['vnp_BankCode'] || '',
        vnp_BankTranNo: params['vnp_BankTranNo'] || '',
        vnp_CardType: params['vnp_CardType'] || '',
        vnp_OrderInfo: params['vnp_OrderInfo'] || '',
        vnp_PayDate: params['vnp_PayDate'] || '',
        vnp_ResponseCode: params['vnp_ResponseCode'] || '',
        vnp_TmnCode: params['vnp_TmnCode'] || '',
        vnp_TransactionNo: params['vnp_TransactionNo'] || '',
        vnp_TransactionStatus: params['vnp_TransactionStatus'] || '',
        vnp_TxnRef: params['vnp_TxnRef'] || '',
        vnp_SecureHash: params['vnp_SecureHash'] || '',
      };

      console.log('Parsed callback data:', this.callbackData);

      // Verify payment locally
      this.verifyPayment();
    });
  }

  private verifyPayment(): void {
    if (!this.callbackData) {
      this.errorMessage = 'Dữ liệu thanh toán không hợp lệ';
      this.isLoading = false;
      return;
    }

    // Verify payment locally based on VNPay response code
    const isSuccessful = this.callbackData.vnp_ResponseCode === '00';

    this.paymentResult = {
      success: isSuccessful,
      message: this.vnpayService.getPaymentStatusMessage(
        this.callbackData.vnp_ResponseCode
      ),
      payment_details: this.callbackData,
    };

    this.isLoading = false;

    // Clear cart if payment was successful
    if (isSuccessful) {
      this.cartService.clearCart();

      // Optional: Update transaction status in your backend
      this.updateTransactionStatus();
    }
  }

  // Update transaction status in backend using callback edge function
  private updateTransactionStatus(): void {
    if (this.callbackData?.vnp_TxnRef) {
      console.log('Updating transaction status for order:', this.callbackData.vnp_TxnRef);

      // Call the VNPay callback edge function to update database
      this.vnpayService.verifyCallback(this.callbackData).subscribe({
        next: (result) => {
          console.log('Transaction status updated successfully:', result);
        },
        error: (error) => {
          console.error('Error updating transaction status:', error);
          // Don't show error to user since payment was successful
        }
      });
    }
  }

  // Check if payment was successful
  isPaymentSuccessful(): boolean {
    return this.paymentResult?.success === true;
  }

  // Get payment status message
  getStatusMessage(): string {
    if (!this.callbackData) return '';
    return this.vnpayService.getPaymentStatusMessage(
      this.callbackData.vnp_ResponseCode
    );
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
}
