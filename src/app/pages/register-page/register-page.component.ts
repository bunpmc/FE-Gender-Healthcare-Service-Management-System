// ==================== IMPORTS ====================
import {
  afterNextRender,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { debounceTime, interval } from 'rxjs';
import { GoogleComponent } from '../../components/google/google.component';
import { AuthService } from '../../services/auth.service';
import { TokenService } from '../../services/token.service';
import {
  OtpService,
  RegisterResponse,
  VerifyOTPResponse,
} from '../../services/otp.service';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  validatePhoneNumber,
  validateOTP,
  REGISTRATION_STEPS,
  OTP_RESEND_COOLDOWN,
} from '../../models/registration.model';

// ==================== COMPONENT DECORATOR ====================
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, GoogleComponent, TranslateModule],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.css',
})
export class RegisterComponent {
  // ==================== STATE / PROPERTY ====================
  showPass = false;
  showConfirmPass = false;
  formSubmitted = false;
  isSubmitting = false;
  errorMsg = '';
  registrationState = signal({
    currentStep: 'phone' as 'phone' | 'otp' | 'password' | 'complete',
    phoneVerification: {
      phone: '',
      isPhoneValid: false,
      isOTPSent: false,
      isOTPVerified: false,
      otpCode: '',
      isVerifyingOTP: false,
      isSendingOTP: false,
      otpError: null as string | null,
      phoneError: null as string | null,
      resendCooldown: 0,
      canResend: true,
    },
    formData: {
      phone: '',
      password: '',
      confirmPassword: '',
    },
    isSubmitting: false,
    error: null as string | null,
  });

  // ==================== VIEWCHILD & DEPENDENCY INJECTION ====================
  private form = viewChild.required<NgForm>('form');
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private tokenService = inject(TokenService);
  private otpService = inject(OtpService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  // ==================== CONSTANTS ====================
  readonly REGISTRATION_STEPS = REGISTRATION_STEPS;

  // ==================== PASSWORD VALIDATION ====================
  passwordValidation: any = null;
  showPasswordStrength = false;

  // ==================== CONSTRUCTOR ====================
  constructor() {
    afterNextRender(() => {
      // Load saved phone number if exists
      const savedForm = window.localStorage.getItem('save-register-form');
      if (savedForm) {
        const loadedFormData = JSON.parse(savedForm);
        Promise.resolve().then(() => {
          if (this.form().controls['phone'] && loadedFormData.phone) {
            this.form().controls['phone'].setValue(loadedFormData.phone);
            this.onPhoneInput(loadedFormData.phone);
          }
        });
      }
      // Save form changes with debounce
      const subscription = this.form()
        .valueChanges?.pipe(debounceTime(500))
        .subscribe({
          next: (value) =>
            window.localStorage.setItem(
              'save-register-form',
              JSON.stringify({
                phone: value.phone,
                otpCode: value.otpCode,
                password: value.password,
                confirmPassword: value.confirmPassword,
              })
            ),
        });
      this.destroyRef.onDestroy(() => subscription?.unsubscribe());
    });
  }

  // ==================== METHODS ====================

  /**
   * Handle phone number input
   */
  onPhoneInput(phone: string): void {
    const validation = validatePhoneNumber(phone);
    this.registrationState.update((state) => ({
      ...state,
      phoneVerification: {
        ...state.phoneVerification,
        phone,
        isPhoneValid: validation.isValid,
        phoneError: validation.error,
      },
      formData: {
        ...state.formData,
        phone,
      },
    }));
    this.errorMsg = '';
    if (validation.isValid) {
      localStorage.setItem('registration-phone', phone);
    }
  }

  /**
   * Send OTP to phone number
   */
  sendOTP(): void {
    const state = this.registrationState();
    if (!state.phoneVerification.isPhoneValid) return;

    this.registrationState.update((state) => ({
      ...state,
      phoneVerification: {
        ...state.phoneVerification,
        isSendingOTP: true,
        otpError: null,
      },
    }));

    this.otpService.sendOTP(state.phoneVerification.phone).subscribe({
      next: (response: RegisterResponse) => {
        this.registrationState.update((state) => ({
          ...state,
          phoneVerification: {
            ...state.phoneVerification,
            isSendingOTP: false,
            isOTPSent: true,
            canResend: false,
            resendCooldown: OTP_RESEND_COOLDOWN,
          },
          currentStep: 'otp',
        }));
        this.startResendTimer();
      },
      error: (error) => {
        this.registrationState.update((state) => ({
          ...state,
          phoneVerification: {
            ...state.phoneVerification,
            isSendingOTP: false,
            otpError: error.message || 'Failed to send verification code',
          },
        }));
      },
    });
  }

  /**
   * Handle OTP input
   */
  onOTPInput(otp: string): void {
    const cleanOTP = otp.replace(/\D/g, '').substring(0, 6);
    const validation = validateOTP(cleanOTP);
    this.registrationState.update((state) => ({
      ...state,
      phoneVerification: {
        ...state.phoneVerification,
        otpCode: cleanOTP,
        otpError: validation.error,
      },
    }));
    this.errorMsg = validation.error || '';
  }

  /**
   * Verify OTP
   */
  verifyOTP(): void {
    const state = this.registrationState();
    if (!state.phoneVerification.isOTPSent) return;

    const validation = validateOTP(state.phoneVerification.otpCode);
    if (!validation.isValid) {
      this.registrationState.update((state) => ({
        ...state,
        phoneVerification: {
          ...state.phoneVerification,
          otpError: validation.error,
        },
      }));
      return;
    }

    this.registrationState.update((state) => ({
      ...state,
      phoneVerification: {
        ...state.phoneVerification,
        isVerifyingOTP: true,
        otpError: null,
      },
    }));

    // For the new OTP system, we'll validate the OTP format and move to password step
    // The actual OTP verification will happen during final registration with the real password
    console.log('🔄 Validating OTP format and moving to password step...');

    // Simulate a brief verification delay for better UX
    setTimeout(() => {
      this.registrationState.update((state) => ({
        ...state,
        phoneVerification: {
          ...state.phoneVerification,
          isVerifyingOTP: false,
          isOTPVerified: true,
          otpError: null,
        },
        currentStep: 'password',
      }));
    }, 1000);
  }

  /**
   * Resend OTP
   */
  resendOTP(): void {
    const state = this.registrationState();
    if (!state.phoneVerification.canResend) return;
    this.sendOTP();
  }

  /**
   * Start resend timer
   */
  private startResendTimer(): void {
    const resendTimerSubscription = interval(1000).subscribe(() => {
      this.registrationState.update((state) => {
        const newCooldown = state.phoneVerification.resendCooldown - 1;
        if (newCooldown <= 0) {
          resendTimerSubscription.unsubscribe();
          return {
            ...state,
            phoneVerification: {
              ...state.phoneVerification,
              resendCooldown: 0,
              canResend: true,
            },
          };
        }
        return {
          ...state,
          phoneVerification: {
            ...state.phoneVerification,
            resendCooldown: newCooldown,
          },
        };
      });
    });
    this.destroyRef.onDestroy(() => resendTimerSubscription.unsubscribe());
  }

  /**
   * Get current step progress
   */
  getStepProgress(): { current: number; total: number; percentage: number } {
    const currentStep = this.registrationState().currentStep;
    const stepOrder = REGISTRATION_STEPS[currentStep].order;
    const totalSteps = Object.keys(REGISTRATION_STEPS).length - 1; // Exclude 'complete' step
    return {
      current: stepOrder,
      total: totalSteps,
      percentage: Math.round((stepOrder / totalSteps) * 100),
    };
  }

  /**
   * Format phone number for display
   */
  formatPhoneForDisplay(phone: string): string {
    if (!phone || phone.length !== 10) return phone;
    return `${phone.substring(0, 4)} ${phone.substring(4, 7)} ${phone.substring(
      7
    )}`;
  }

  /**
   * Format OTP for display
   */
  formatOTPForDisplay(otp: string): string {
    if (!otp) return '';
    const cleanOTP = otp.replace(/\D/g, '');
    const limitedOTP = cleanOTP.substring(0, 6);
    if (limitedOTP.length > 3) {
      return `${limitedOTP.substring(0, 3)} ${limitedOTP.substring(3)}`;
    }
    return limitedOTP;
  }

  /**
   * Go back to previous step
   */
  goBackStep(): void {
    const currentStep = this.registrationState().currentStep;
    if (currentStep === 'otp') {
      this.registrationState.update((state) => ({
        ...state,
        currentStep: 'phone',
        phoneVerification: {
          ...state.phoneVerification,
          isOTPSent: false,
          otpCode: '',
          otpError: null,
        },
      }));
    } else if (currentStep === 'password') {
      this.registrationState.update((state) => ({
        ...state,
        currentStep: 'otp',
      }));
    }
  }

  /**
   * Complete registration
   */
  completeRegistration(): void {
    const state = this.registrationState();

    if (!state.phoneVerification.isOTPVerified) return;

    if (!this.passwordValidation?.overall?.canSubmit) return;

    this.registrationState.update((state) => ({
      ...state,
      isSubmitting: true,
      error: null,
    }));

    const phone = state.formData.phone;
    const password = state.formData.password;
    const otp = state.phoneVerification.otpCode;

    this.otpService.verifyOTPAndRegister(phone, otp, password).subscribe({
      next: (response: VerifyOTPResponse) => {
        if (response.data?.access_token) {
          this.tokenService.setTokenSession(response.data.access_token);
        }
        this.registrationState.update((state) => ({
          ...state,
          isSubmitting: false,
          currentStep: 'complete',
        }));
        localStorage.removeItem('registration-phone');
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 2000);
      },
      error: (error) => {
        let errorMessage = 'Registration failed. Please try again.';
        if (error.status === 401) {
          errorMessage = 'Invalid verification code or phone number';
        } else if (error.status === 400) {
          errorMessage =
            error.message || 'Invalid request. Please check your information.';
        } else if (error.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        this.registrationState.update((state) => ({
          ...state,
          isSubmitting: false,
          error: errorMessage,
        }));
      },
    });
  }

  /**
   * Password validation methods
   */
  onPasswordInput(password: string): void {
    this.registrationState.update((state) => ({
      ...state,
      formData: {
        ...state.formData,
        password,
      },
    }));
    this.showPasswordStrength = password.length > 0;
    this.validatePasswords();
  }

  onConfirmPasswordInput(confirmPassword: string): void {
    this.registrationState.update((state) => ({
      ...state,
      formData: {
        ...state.formData,
        confirmPassword,
      },
    }));
    this.validatePasswords();
  }

  private validatePasswords(): void {
    const state = this.registrationState();
    const password = state.formData.password;
    const confirmPassword = state.formData.confirmPassword;

    if (password || confirmPassword) {
      const hasMinLength = password.length >= 8;
      const hasNumber = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
      const passwordsMatch = password === confirmPassword;

      this.passwordValidation = {
        password: {
          score: hasMinLength && hasNumber && hasSpecialChar ? 75 : 25,
          strength:
            hasMinLength && hasNumber && hasSpecialChar ? 'strong' : 'weak',
          rules: [
            { text: 'At least 8 characters', isValid: hasMinLength },
            { text: 'Contains a number', isValid: hasNumber },
            { text: 'Contains a special character', isValid: hasSpecialChar },
          ],
        },
        confirmPassword: {
          isValid: passwordsMatch,
          error: passwordsMatch ? null : 'Passwords do not match',
        },
        overall: {
          canSubmit:
            hasMinLength && hasNumber && hasSpecialChar && passwordsMatch,
        },
      };
    } else {
      this.passwordValidation = null;
    }
  }

  getPasswordStrengthColor(): string {
    if (!this.passwordValidation?.password) return '#e5e7eb';
    return this.passwordValidation.password.strength === 'strong'
      ? '#10b981'
      : '#f59e0b';
  }

  getPasswordStrengthText(): string {
    if (!this.passwordValidation?.password) return '';
    return this.passwordValidation.password.strength === 'strong'
      ? 'Strong'
      : 'Weak';
  }

  shouldShowPasswordValidation(): boolean {
    return this.showPasswordStrength && this.passwordValidation !== null;
  }
}
