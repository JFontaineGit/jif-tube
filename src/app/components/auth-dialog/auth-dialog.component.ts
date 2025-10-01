import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/core/pocket-base.service';

type AuthView = 'login' | 'register' | 'forgot-password';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-dialog.component.html',
  styleUrls: ['./auth-dialog.component.scss']
})
export class AuthDialogComponent {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();

  currentView = signal<AuthView>('login');
  isSubmitting = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  passwordStrength = signal(0);
  passwordStrengthText = signal('');
  passwordStrengthClass = signal('');
  errorMessage = signal('');
  successMessage = signal('');

  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
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

  async onLogin(): Promise<void> {
    if (this.loginForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const { email, password } = this.loginForm.value;

    this.apiService.login(email, password).subscribe({
      next: () => {
        this.successMessage.set('¡Inicio de sesión exitoso!');
        setTimeout(() => {
          this.onClose();
        }, 1500);
      },
      error: (error) => {
        console.error('Login error:', error);
        this.errorMessage.set('Credenciales incorrectas. Verifica tu email y contraseña.');
        this.isSubmitting.set(false);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  async onRegister(): Promise<void> {
    if (this.registerForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const { email, password } = this.registerForm.value;

    // Crear usuario en PocketBase
    const userData = {
      email,
      password,
      passwordConfirm: password,
      emailVisibility: true
    };

    this.apiService.create('users', userData).subscribe({
      next: () => {
        this.successMessage.set('¡Cuenta creada exitosamente!');
        setTimeout(() => {
          this.switchView('login');
        }, 1500);
      },
      error: (error) => {
        console.error('Registration error:', error);
        let errorMsg = 'Error al crear cuenta. Intenta nuevamente.';
        
        if (error?.data?.email) {
          errorMsg = 'Este email ya está registrado.';
        }
        
        this.errorMessage.set(errorMsg);
        this.isSubmitting.set(false);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  async onForgotPassword(): Promise<void> {
    if (this.forgotForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    // PocketBase no tiene recuperación de contraseña por defecto en la API básica
    // Necesitarías implementar esto en el backend o usar el admin UI
    
    this.errorMessage.set('La recuperación de contraseña debe configurarse en el backend de PocketBase.');
    this.isSubmitting.set(false);
    
    // Si tienes configurado el email en PocketBase, podrías hacer algo como:
    // this.apiService.requestPasswordReset(email).subscribe(...)
  }
}