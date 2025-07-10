import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
// import { BreadcrumbsComponent } from '../../components/breadcrumbs/breadcrumbs.component';
import { CartService } from '../../services/cart.service';
import { VnpayService } from '../../services/vnpay.service';
import {
  Cart,
  VNPayPaymentRequest,
  PaymentTransaction,
} from '../../models/payment.model';

@Component({
  selector: 'app-transaction',
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    HeaderComponent,
    FooterComponent,
    // BreadcrumbsComponent,
  ],

  templateUrl: './transaction-page.html',
  styleUrl: './transaction-page.css',
})
export class Transaction implements OnInit, OnDestroy {
  cart: Cart = { items: [], total: 0, itemCount: 0 };
  isProcessing = false;
  errorMessage = '';

  // Customer information
  customerInfo = {
    fullName: '',
    email: '',
    phone: '',
    address: '',
  };

  private destroy$ = new Subject<void>();

  constructor(
    private cartService: CartService,
    private vnpayService: VnpayService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe((cart: Cart) => {
        this.cart = cart;
        if (cart.items.length === 0) {
          this.router.navigate(['/service']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Process VNPay payment
  processPayment(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';

    const paymentRequest: VNPayPaymentRequest = {
      amount: this.cart.total,
      orderInfo: this.cartService.generateOrderInfo(),
      patientId: this.customerInfo.email, // Using email as patient ID
      services: this.cart.items,
    };

    this.vnpayService
      .createPayment(paymentRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data?.paymentUrl) {
            // Save transaction before redirecting
            this.saveTransaction(response.data.orderId);
            // Redirect to VNPay
            window.location.href = response.data.paymentUrl;
          } else {
            this.errorMessage =
              response.error || 'Không thể tạo liên kết thanh toán';
            this.isProcessing = false;
          }
        },
        error: (error) => {
          console.error('Payment creation error:', error);
          this.errorMessage =
            'Có lỗi xảy ra khi tạo thanh toán. Vui lòng thử lại.';
          this.isProcessing = false;
        },
      });
  }

  // Validate form
  private validateForm(): boolean {
    if (!this.customerInfo.fullName.trim()) {
      this.errorMessage = 'Vui lòng nhập họ tên';
      return false;
    }
    if (!this.customerInfo.email.trim()) {
      this.errorMessage = 'Vui lòng nhập email';
      return false;
    }
    if (!this.customerInfo.phone.trim()) {
      this.errorMessage = 'Vui lòng nhập số điện thoại';
      return false;
    }
    return true;
  }

  // Save transaction
  private saveTransaction(orderId: string): void {
    const transaction: PaymentTransaction = {
      transaction_id: orderId,
      cart_items: this.cart.items,
      total_amount: this.cart.total,
      payment_method: 'vnpay',
      payment_status: 'pending',
      order_info: this.cartService.generateOrderInfo(),
    };

    this.vnpayService.saveTransaction(transaction).subscribe({
      next: (result) => {
        console.log('Transaction saved:', result);
      },
      error: (error) => {
        console.error('Error saving transaction:', error);
      },
    });
  }

  // Format price
  formatPrice(price: number): string {
    return this.cartService.formatPrice(price);
  }

  // Get item total
  getItemTotal(item: any): number {
    return item.price * item.quantity;
  }
}
