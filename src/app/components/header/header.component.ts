import { NgClass } from '@angular/common';
import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core'; // THÊM
import { TokenService } from '../../services/token.service';
import { Cart } from '../../models/payment.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgClass, RouterLink, TranslateModule, CommonModule], // THÊM TranslateModule
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit, OnDestroy {
  isSearch = false;
  isActive = false;
  isMenuOpen = false;
  isUserMenuOpen = false;
  isScrolled = false;
  user: any = null;
  currentLang = 'vi'; // Ngôn ngữ hiện tại
  cart: Cart = { items: [], total: 0, itemCount: 0 };

  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private router = inject(Router);
  private translate = inject(TranslateService); // THÊM
  private destroy$ = new Subject<void>();

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 10;
  }

  ngOnInit() {
    this.currentLang = localStorage.getItem('lang') || 'vi';
    this.translate.use(this.currentLang);
    this.getUserInfo();

    // Subscribe to cart changes
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe((cart: Cart) => {
        this.cart = cart;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  changeLang(lang: string) {
    if (this.currentLang !== lang) {
      this.currentLang = lang;
      this.translate.use(lang);
      localStorage.setItem('lang', lang);
    }
  }

  getUserInfo() {
    // Use the current user from auth service instead of calling API
    this.authService.getCurrentUser$().subscribe({
      next: (user) => {
        if (user && user.patient) {
          this.user = {
            success: true,
            data: user.patient,
          };
        } else {
          this.user = null;
        }
      },
      error: (err: any) => {
        console.error('Error getting user info:', err);
        this.user = null;
      },
    });
  }

  logout() {
    localStorage.removeItem('access_token');
    this.user = null;
    this.router.navigate(['/login']);
  }

  isSearchHandle(val: boolean) {
    this.isSearch = val;
  }
  closeSearch() {
    this.isSearch = false;
  }
  openMenu() {
    this.isMenuOpen = true;
  }
  closeMenu() {
    this.isMenuOpen = false;
  }
  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }
  toggleHamburger() {
    this.isActive = !this.isActive;
  }
}
