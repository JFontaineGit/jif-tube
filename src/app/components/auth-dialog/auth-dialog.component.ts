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
  private readonly authService = inject(AuthService) as AuthService;
  private readonly storage = inject(StorageService) as StorageService;
  private readonly logger = inject(LoggerService) as LoggerService;
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
      password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]],
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

  /**
   * Validador de complejidad de contraseña
   */
  private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.value;
    
    if (!password) {
      return null;
    }

    const errors: ValidationErrors = {};

    // Al menos una mayúscula
    if (!/[A-Z]/.test(password)) {
      errors['noUppercase'] = true;
    }

    // Al menos una minúscula
    if (!/[a-z]/.test(password)) {
      errors['noLowercase'] = true;
    }

    // Al menos un número
    if (!/[0-9]/.test(password)) {
      errors['noNumber'] = true;
    }

    // Al menos un caracter especial
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors['noSpecial'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
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

  /**
   * Obtiene el mensaje de error de validación de contraseña
   */
  getPasswordErrorMessage(): string {
    const passwordControl = this.registerForm.get('password');
    
    if (!passwordControl || !passwordControl.errors || !passwordControl.touched) {
      return '';
    }

    const errors = passwordControl.errors;
    const messages: string[] = [];

    if (errors['required']) {
      return 'La contraseña es requerida';
    }

    if (errors['minlength']) {
      messages.push('mínimo 8 caracteres');
    }

    if (errors['noUppercase']) {
      messages.push('una mayúscula');
    }

    if (errors['noLowercase']) {
      messages.push('una minúscula');
    }

    if (errors['noNumber']) {
      messages.push('un número');
    }

    if (errors['noSpecial']) {
      messages.push('un carácter especial');
    }

    if (messages.length === 0) {
      return '';
    }

    if (messages.length === 1 && messages[0] === 'mínimo 8 caracteres') {
      return 'Debe tener ' + messages[0];
    }

    return `Debe contener: ${messages.join(', ')}`;
  }

  // =========================================================================
  // AUTH ACTIONS
  // =========================================================================

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
          this.router.navigate(['/home']);
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
        
        const errorMsg = this.normalizeErrorMessage(error, 
          'Error al crear cuenta. Intenta nuevamente.'
        );

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
  }

  // =========================================================================
  // REMEMBER EMAIL HELPERS
  // =========================================================================

  private loadRememberedEmail(): void {
    this.storage.getRememberedEmail().subscribe({
      next: (savedEmail) => {
        if (savedEmail) {
          this.loginForm.patchValue({ username_or_email: savedEmail });
          this.rememberEmail.set(true);
          this.logger.debug('Email recordado cargado', { email: savedEmail });
        }
      },
      error: (err) => {
        this.logger.warn('Error cargando email recordado', err);
      }
    });
  }

  private saveRememberedEmail(email: string): void {
    this.storage.saveRememberedEmail(email).subscribe({
      next: () => {
        this.logger.debug('Email guardado para recordar', { email });
      },
      error: (err) => {
        this.logger.warn('Error guardando email', err);
      }
    });
  }

  private clearRememberedEmail(): void {
    this.storage.clearRememberedEmail().subscribe({
      next: () => {
        this.logger.debug('Email recordado eliminado');
      },
      error: (err) => {
        this.logger.warn('Error eliminando email', err);
      }
    });
  }

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

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
        // Manejar errores específicos de validación de contraseña del backend
        if (detail.includes('uppercase')) {
          return 'La contraseña debe contener al menos una letra mayúscula';
        }
        if (detail.includes('lowercase')) {
          return 'La contraseña debe contener al menos una letra minúscula';
        }
        if (detail.includes('digit') || detail.includes('number')) {
          return 'La contraseña debe contener al menos un número';
        }
        if (detail.includes('special character')) {
          return 'La contraseña debe contener al menos un carácter especial';
        }
        if (detail.includes('8 characters')) {
          return 'La contraseña debe tener al menos 8 caracteres';
        }
        
        return detail;
      }
      
      if (Array.isArray(detail)) {
        const messages = detail.map(e => {
          const msg = e.msg || e.message;
          
          // Normalizar mensajes de Pydantic
          if (msg.includes('uppercase')) return 'una mayúscula';
          if (msg.includes('lowercase')) return 'una minúscula';
          if (msg.includes('digit')) return 'un número';
          if (msg.includes('special')) return 'un carácter especial';
          
          return msg;
        });
        
        return `La contraseña debe contener: ${messages.join(', ')}`;
      }
    }

    return defaultMsg;
  }
}