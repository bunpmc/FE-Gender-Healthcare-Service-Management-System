import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Cart, CartItem } from '../models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_STORAGE_KEY = 'healthcare_cart';
  
  // Cart state management
  private cartSubject = new BehaviorSubject<Cart>({ items: [], total: 0, itemCount: 0 });
  public cart$ = this.cartSubject.asObservable();

  constructor() {
    this.loadCartFromStorage();
  }

  // Get current cart value
  get currentCart(): Cart {
    return this.cartSubject.value;
  }

  // Add item to cart
  addToCart(item: CartItem): void {
    const currentCart = this.currentCart;
    const existingItemIndex = currentCart.items.findIndex(
      cartItem => cartItem.service_id === item.service_id
    );

    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      currentCart.items[existingItemIndex].quantity += item.quantity;
    } else {
      // Add new item
      currentCart.items.push({ ...item });
    }

    this.updateCart(currentCart);
  }

  // Remove item from cart
  removeFromCart(serviceId: string): void {
    const currentCart = this.currentCart;
    currentCart.items = currentCart.items.filter(
      item => item.service_id !== serviceId
    );
    this.updateCart(currentCart);
  }

  // Update item quantity
  updateQuantity(serviceId: string, quantity: number): void {
    const currentCart = this.currentCart;
    const itemIndex = currentCart.items.findIndex(
      item => item.service_id === serviceId
    );

    if (itemIndex >= 0) {
      if (quantity <= 0) {
        this.removeFromCart(serviceId);
      } else {
        currentCart.items[itemIndex].quantity = quantity;
        this.updateCart(currentCart);
      }
    }
  }

  // Clear entire cart
  clearCart(): void {
    const emptyCart: Cart = { items: [], total: 0, itemCount: 0 };
    this.updateCart(emptyCart);
  }

  // Check if item is in cart
  isInCart(serviceId: string): boolean {
    return this.currentCart.items.some(item => item.service_id === serviceId);
  }

  // Get specific cart item
  getCartItem(serviceId: string): CartItem | undefined {
    return this.currentCart.items.find(item => item.service_id === serviceId);
  }

  // Get cart item count for a specific service
  getCartQuantity(serviceId: string): number {
    const item = this.getCartItem(serviceId);
    return item ? item.quantity : 0;
  }

  // Format price for display
  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  // Generate order info for payment
  generateOrderInfo(): string {
    const items = this.currentCart.items;
    if (items.length === 0) return 'Thanh toán dịch vụ y tế';
    
    if (items.length === 1) {
      return `Thanh toán: ${items[0].service_name}`;
    }
    
    return `Thanh toán ${items.length} dịch vụ y tế`;
  }

  // Private method to update cart and recalculate totals
  private updateCart(cart: Cart): void {
    // Recalculate totals
    cart.total = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    cart.itemCount = cart.items.reduce((count, item) => {
      return count + item.quantity;
    }, 0);

    // Update subject and save to storage
    this.cartSubject.next(cart);
    this.saveCartToStorage(cart);
  }

  // Save cart to localStorage
  private saveCartToStorage(cart: Cart): void {
    try {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }

  // Load cart from localStorage
  private loadCartFromStorage(): void {
    try {
      const savedCart = localStorage.getItem(this.CART_STORAGE_KEY);
      if (savedCart) {
        const cart: Cart = JSON.parse(savedCart);
        // Validate cart structure
        if (cart && Array.isArray(cart.items)) {
          this.cartSubject.next(cart);
        }
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      // Initialize with empty cart if loading fails
      this.cartSubject.next({ items: [], total: 0, itemCount: 0 });
    }
  }

  // Get cart summary for checkout
  getCartSummary(): {
    subtotal: number;
    itemCount: number;
    items: CartItem[];
  } {
    const cart = this.currentCart;
    return {
      subtotal: cart.total,
      itemCount: cart.itemCount,
      items: [...cart.items]
    };
  }

  // Validate cart before checkout
  validateCart(): { isValid: boolean; errors: string[] } {
    const cart = this.currentCart;
    const errors: string[] = [];

    if (cart.items.length === 0) {
      errors.push('Giỏ hàng trống');
    }

    // Check for invalid quantities
    cart.items.forEach(item => {
      if (item.quantity <= 0) {
        errors.push(`Số lượng không hợp lệ cho ${item.service_name}`);
      }
      if (item.price <= 0) {
        errors.push(`Giá không hợp lệ cho ${item.service_name}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
