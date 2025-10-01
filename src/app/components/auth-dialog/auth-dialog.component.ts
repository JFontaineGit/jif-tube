import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth.service';
import { StorageService } from '../../services/core/storage.service';
import { LoggerService } from '../../services/core/logger.service';

type AuthView = 'login' | 'register' | 'forgot-password';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-dialog.component.html',
  styleUrls: ['./auth-dialog.component.scss']
})
export class AuthDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly logger = inject(LoggerService);

  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() authSuccess = new EventEmitter<void>();

  currentView = signal<AuthView>('login');
  isSubmitting = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  passwordStrength = signal(0);
  passwordStrengthText = signal('');
  passwordStrengthClass = signal('');
  errorMessage = signal('');
  successMessage = signal('');
  rememberEmail = signal(false);

  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotForm: FormGroup;

  constructor() {
    this.loginForm = this.fb.group({
      username_or_email: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    const savedEmail = this.storage.getRememberEmail();
    if (savedEmail) {
      this.loginForm.patchValue({ username_or_email: savedEmail });
      this.rememberEmail.set(true);
    }
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onClose(): void {
    this.close.emit();
    this.resetForms();
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  switchView(view: AuthView): void {
    this.currentView.set(view);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.resetForms();
  }

  resetForms(): void {
    this.loginForm.reset();
    this.registerForm.reset();
    this.forgotForm.reset();
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    this.passwordStrength.set(0);
    this.errorMessage.set('');
    this.successMessage.set('');
    
    const savedEmail = this.storage.getRememberEmail();
    if (savedEmail) {
      this.loginForm.patchValue({ username_or_email: savedEmail });
      this.rememberEmail.set(true);
    }
  }

  toggleRememberEmail(): void {
    this.rememberEmail.set(!this.rememberEmail());
  }

  checkPasswordStrength(): void {
    const password = this.registerForm.get('password')?.value;

    if (!password) {
      this.passwordStrength.set(0);
      this.passwordStrengthText.set('');
      this.passwordStrengthClass.set('');
      return;
    }

    let strength = 0;
    if (password.length >= 6) strength += 20;
    if (password.length >= 8) strength += 10;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 10;
    if (/[0-9]/.test(password)) strength += 20;
    if (/[^A-Za-z0-9]/.test(password)) strength += 20;

    this.passwordStrength.set(strength);

    if (strength < 40) {
      this.passwordStrengthText.set('Débil');
      this.passwordStrengthClass.set('weak');
    } else if (strength < 70) {
      this.passwordStrengthText.set('Media');
      this.passwordStrengthClass.set('medium');
    } else {
      this.passwordStrengthText.set('Fuerte');
      this.passwordStrengthClass.set('strong');
    }
  }

  onLogin(): void {
    if (this.loginForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const { username_or_email, password } = this.loginForm.value;

    this.authService.login({ username_or_email, password }).subscribe({
      next: (response) => {
        this.logger.debug('Login exitoso', response);
        
        this.storage.setAccessToken(response.access_token);
        this.storage.setRefreshToken(response.refresh_token);

        if (this.rememberEmail()) {
          this.storage.setRememberEmail(username_or_email);
        } else {
          this.storage.removeRememberEmail();
        }

        this.successMessage.set('¡Inicio de sesión exitoso!');
        
        setTimeout(() => {
          this.authSuccess.emit();
          this.onClose();
        }, 1000);
      },
      error: (error) => {
        this.logger.error('Error en login:', error);
        this.errorMessage.set('Credenciales incorrectas. Verifica tu usuario/email y contraseña.');
        this.isSubmitting.set(false);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const { username, email, password } = this.registerForm.value;

    this.authService.register({ username, email, password }).subscribe({
      next: (response) => {
        this.logger.debug('Registro exitoso', response);
        
        this.storage.setAccessToken(response.access_token);
        this.storage.setRefreshToken(response.refresh_token);

        this.successMessage.set('¡Cuenta creada exitosamente!');
        
        setTimeout(() => {
          this.authSuccess.emit();
          this.onClose();
        }, 1000);
      },
      error: (error) => {
        this.logger.error('Error en registro:', error);
        
        let errorMsg = 'Error al crear cuenta. Intenta nuevamente.';
        
        if (error?.error?.detail) {
          errorMsg = error.error.detail;
        } else if (error?.message?.includes('email')) {
          errorMsg = 'Este email ya está registrado.';
        } else if (error?.message?.includes('username')) {
          errorMsg = 'Este nombre de usuario ya existe.';
        }
        
        this.errorMessage.set(errorMsg);
        this.isSubmitting.set(false);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  onForgotPassword(): void {
    if (this.forgotForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const { email } = this.forgotForm.value;
    this.storage.setTempResetEmail(email);

    // TODO: Implement password reset endpoint when available
    this.successMessage.set('Si el email existe, recibirás instrucciones para restablecer tu contraseña.');
    
    setTimeout(() => {
      this.switchView('login');
    }, 3000);

    this.isSubmitting.set(false);
  }
}