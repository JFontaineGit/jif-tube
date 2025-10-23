import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, StorageService, LoggerService } from '@services';
import { UserCreate, LoginCredentials } from '@interfaces';

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
  private readonly router = inject(Router);

  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() authSuccess = new EventEmitter<void>();

  readonly currentView = signal<AuthView>('login');
  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly passwordStrength = signal(0);
  readonly passwordStrengthText = signal('');
  readonly passwordStrengthClass = signal('');
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly rememberEmail = signal(false);

  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotForm: FormGroup;

  constructor() {
    // Login Form
    this.loginForm = this.fb.group({
      username_or_email: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });

    // Register Form
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { 
      validators: this.passwordMatchValidator 
    });

    // Forgot Password Form
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // Cargar email guardado si existe
    this.loadRememberedEmail();
  }

  /**
   * Validador para verificar que las contraseñas coincidan
   */
  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    
    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  // =========================================================================
  // NAVIGATION & UI
  // =========================================================================

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
    this.passwordStrengthText.set('');
    this.passwordStrengthClass.set('');
    this.errorMessage.set('');
    this.successMessage.set('');
    
    // Recargar email guardado si existe
    this.loadRememberedEmail();
  }

  toggleRememberEmail(): void {
    this.rememberEmail.update(current => !current);
  }

  checkPasswordStrength(): void {
    const password = this.registerForm.get('password')?.value || '';

    if (!password) {
      this.passwordStrength.set(0);
      this.passwordStrengthText.set('');
      this.passwordStrengthClass.set('');
      return;
    }

    let strength = 0;

    // Longitud
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;

    // Complejidad
    if (/[A-Z]/.test(password)) strength += 20; // Mayúsculas
    if (/[a-z]/.test(password)) strength += 20; // Minúsculas
    if (/[0-9]/.test(password)) strength += 15; // Números
    if (/[^A-Za-z0-9]/.test(password)) strength += 15; // Caracteres especiales

    this.passwordStrength.set(strength);

    // Clasificar fuerza
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
    if (this.loginForm.invalid || this.isSubmitting()) {
      this.logger.warn('Login form invalid or already submitting');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const { username_or_email, password } = this.loginForm.value;

    const credentials: LoginCredentials = {
      username: username_or_email,
      password
    };

    this.authService.login(credentials).subscribe({
      next: (tokens) => {
        this.logger.info('Login exitoso');

        // Guardar email si "Recordar" está activado
        if (this.rememberEmail()) {
          this.saveRememberedEmail(username_or_email);
        } else {
          this.clearRememberedEmail();
        }

        this.successMessage.set('¡Inicio de sesión exitoso!');

        // Dar feedback visual antes de cerrar
        setTimeout(() => {
          this.authSuccess.emit();
          this.onClose();
          this.router.navigate(['/home']); // O la ruta que prefieras
        }, 1000);
      },
      error: (error) => {
        this.logger.error('Error en login', error);
        
        const errorMsg = this.normalizeErrorMessage(error, 
          'Credenciales incorrectas. Verifica tu usuario/email y contraseña.'
        );
        
        this.errorMessage.set(errorMsg);
        this.isSubmitting.set(false);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid || this.isSubmitting()) {
      this.logger.warn('Register form invalid or already submitting');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const { username, email, password } = this.registerForm.value;

    const userData: UserCreate = {
      username,
      email,
      password
    };

    this.authService.register(userData).subscribe({
      next: (user) => {
        this.logger.info('Registro exitoso', { userId: user.id });

        this.successMessage.set('¡Cuenta creada exitosamente! Iniciando sesión...');

        // Auto-login después de registro exitoso
        setTimeout(() => {
          this.loginAfterRegister(username, password);
        }, 1500);
      },
      error: (error) => {
        this.logger.error('Error en registro', error);
        
        let errorMsg = 'Error al crear cuenta. Intenta nuevamente.';
        
        // Normalizar errores comunes
        if (error.message) {
          errorMsg = error.message;
        } else if (error?.error?.detail) {
          const detail = error.error.detail;
          
          if (typeof detail === 'string') {
            errorMsg = detail;
          } else if (Array.isArray(detail)) {
            // Error de validación de Pydantic
            errorMsg = detail.map(e => e.msg).join(', ');
          }
        }

        this.errorMessage.set(errorMsg);
        this.isSubmitting.set(false);
      },
      complete: () => {
        // isSubmitting se maneja en el login automático
      }
    });
  }

  /**
   * Login automático después de registro exitoso
   */
  private loginAfterRegister(username: string, password: string): void {
    const credentials: LoginCredentials = {
      username,
      password
    };

    this.authService.login(credentials).subscribe({
      next: () => {
        this.authSuccess.emit();
        this.onClose();
        this.router.navigate(['/home']);
      },
      error: (error) => {
        this.logger.error('Error en auto-login después de registro', error);
        this.errorMessage.set('Cuenta creada. Por favor, inicia sesión manualmente.');
        this.switchView('login');
        this.loginForm.patchValue({ username_or_email: username });
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  onForgotPassword(): void {
    if (this.forgotForm.invalid || this.isSubmitting()) {
      this.logger.warn('Forgot password form invalid or already submitting');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const { email } = this.forgotForm.value;

    // TODO: Implementar endpoint de reset password cuando esté disponible
    // Por ahora, solo mostramos mensaje de éxito simulado
    
    this.logger.info('Solicitud de reset password', { email });

    // Simular delay de API
    setTimeout(() => {
      this.successMessage.set(
        'Si el email existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.'
      );

      setTimeout(() => {
        this.switchView('login');
        this.isSubmitting.set(false);
      }, 3000);
    }, 1000);

    // Cuando tengas el endpoint real, descomentar esto:
    /*
    this.authService.requestPasswordReset(email).subscribe({
      next: () => {
        this.successMessage.set('Revisa tu email para restablecer tu contraseña.');
        setTimeout(() => this.switchView('login'), 3000);
      },
      error: (error) => {
        this.logger.error('Error en forgot password', error);
        this.errorMessage.set('Error al enviar email. Intenta nuevamente.');
        this.isSubmitting.set(false);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
    */
  }

  private loadRememberedEmail(): void {
    // TODO: Implementar cuando tengas los métodos en StorageService
    // const savedEmail = this.storage.getRememberEmail();
    // if (savedEmail) {
    //   this.loginForm.patchValue({ username_or_email: savedEmail });
    //   this.rememberEmail.set(true);
    // }
  }

  private saveRememberedEmail(email: string): void {
    // TODO: Implementar cuando tengas los métodos en StorageService
    // this.storage.setRememberEmail(email);
    this.logger.debug('Email guardado para recordar', { email });
  }

  private clearRememberedEmail(): void {
    // TODO: Implementar cuando tengas los métodos en StorageService
    // this.storage.removeRememberEmail();
    this.logger.debug('Email recordado eliminado');
  }

  /**
   * Normaliza mensajes de error de la API
   */
  private normalizeErrorMessage(error: any, defaultMsg: string): string {
    if (error?.message) {
      return error.message;
    }

    if (error?.error?.detail) {
      const detail = error.error.detail;
      
      if (typeof detail === 'string') {
        return detail;
      }
      
      if (Array.isArray(detail)) {
        return detail.map(e => e.msg || e.message).join('. ');
      }
    }

    return defaultMsg;
  }
}