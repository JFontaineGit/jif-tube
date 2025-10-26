import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { ApiService, StorageService, LoggerService } from '@services';
import { AUTH_ENDPOINTS, USER_ENDPOINTS } from '@constants';
import {
  UserCreate,
  UserRead,
  Token,
  LoginCredentials,
  TokenPayload,
} from '@interfaces';

/**
 * Servicio de autenticación.
 * 
 * Features:
 * - Login/Register/Logout
 * - Refresh token con anti-race condition
 * - Estado reactivo con Signals
 * - Manejo de scopes (roles/permisos)
 * - Type-safe completo
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiService) as ApiService;
  private readonly storage = inject(StorageService) as StorageService;
  private readonly logger = inject(LoggerService) as LoggerService;
  private readonly router = inject(Router);

  private readonly _currentUser = signal<UserRead | null>(null);
  private readonly _isAuthenticated = signal<boolean>(false);
  private readonly _loading = signal<boolean>(false);
  private readonly _scopes = signal<string[]>([]);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly scopes = this._scopes.asReadonly();

  readonly isAdmin = computed(() => this._scopes().includes('admin'));
  readonly userDisplayName = computed(() => {
    const user = this._currentUser();
    return user ? user.username : 'Guest';
  });

  // =========================================================================
  // REFRESH TOKEN MANAGEMENT (anti-race condition)
  // =========================================================================

  private refreshTokenInProgress = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  // =========================================================================
  // LEGACY OBSERVABLE (para compatibilidad con guards/interceptors)
  // =========================================================================

  private loginStatusSubject = new BehaviorSubject<boolean>(false);
  readonly loginStatus$ = this.loginStatusSubject.asObservable();

  constructor() {
    this.logger.info('AuthService initialized');
    this.initializeAuth();
  }

  /**
   * Inicializa auth al cargar la app
   */
  private initializeAuth(): void {
    this.storage.getAccessToken().subscribe({
      next: (token) => {
        if (token && !this.isTokenExpired(token)) {
          this.logger.debug('Token válido encontrado, cargando perfil');
          this.loadUserProfile().subscribe({
            error: (err) => {
              this.logger.warn('Falló restaurar sesión', err);
              this.clearAuthState();
            },
          });
        } else if (token) {
          this.logger.debug('Token expirado, intentando refresh');
          this.refreshAccessToken().subscribe({
            error: () => this.clearAuthState(),
          });
        }
      },
      error: (err) => this.logger.error('Error leyendo token del storage', err),
    });
  }

  // =========================================================================
  // AUTHENTICATION FLOW
  // =========================================================================

  /**
   * Register nuevo usuario
   */
  register(userData: UserCreate): Observable<UserRead> {
    this.logger.info('Registrando usuario', { username: userData.username });
    this._loading.set(true);

    return this.api.post<UserRead>(AUTH_ENDPOINTS.REGISTER, userData).pipe(
      tap((user) => {
        this.logger.info('Usuario registrado exitosamente', { id: user.id });
      }),
      catchError((error) => {
        this.logger.error('Registro falló', error);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._loading.set(false))
    );
  }

  /**
   * Login con username/email + password
   */
  login(credentials: LoginCredentials): Observable<Token> {
    this.logger.info('Intentando login', { username: credentials.username });
    this._loading.set(true);

    return this.api
      .postForm<Token>(AUTH_ENDPOINTS.LOGIN, {
        username: credentials.username,
        password: credentials.password,
      })
      .pipe(
        // 1. Guardar tokens
        switchMap((tokens) =>
          this.storage.saveTokens(tokens.access_token, tokens.refresh_token).pipe(
            map(() => tokens)
          )
        ),
        // 2. Cargar perfil
        switchMap((tokens) =>
          this.loadUserProfile().pipe(map(() => tokens))
        ),
        // 3. Actualizar estado
        tap((tokens) => {
          this._isAuthenticated.set(true);
          this.loginStatusSubject.next(true);
          this.logger.info('Login exitoso');
        }),
        catchError((error) => {
          this.logger.error('Login falló', error);
          return throwError(() => this.normalizeError(error));
        }),
        tap(() => this._loading.set(false))
      );
  }

  /**
   * Logout (invalida refresh token en backend)
   */
  logout(): Observable<void> {
    this.logger.info('Cerrando sesión');

    if (!this._isAuthenticated()) {
      this.clearAuthState();
      return of(void 0);
    }

    return this.storage.getRefreshToken().pipe(
      switchMap((refreshToken) => {
        if (!refreshToken) {
          return of(void 0);
        }

        // Llamar backend para blacklistear
        return this.api
          .postForm<void>(AUTH_ENDPOINTS.LOGOUT, { refresh_token: refreshToken })
          .pipe(
            catchError((error) => {
              this.logger.warn('Logout en backend falló', error);
              return of(void 0);
            })
          );
      }),
      tap(() => this.clearAuthState()),
      tap(() => this.router.navigate(['/login']))
    );
  }

  /**
   * Refresh access token (con anti-race condition)
   */
  refreshAccessToken(): Observable<string> {
    // Si ya hay un refresh en progreso, esperar a ese
    if (this.refreshTokenInProgress) {
      this.logger.debug('Refresh ya en progreso, esperando...');
      return this.refreshTokenSubject.asObservable().pipe(
        switchMap((token) => {
          if (!token) {
            return throwError(() => new Error('Refresh token falló'));
          }
          return of(token);
        })
      );
    }

    this.refreshTokenInProgress = true;
    this.refreshTokenSubject.next(null);

    return this.storage.getRefreshToken().pipe(
      switchMap((refreshToken) => {
        if (!refreshToken) {
          throw new Error('No hay refresh token disponible');
        }

        this.logger.debug('Refrescando access token');

        return this.api.postForm<Token>(AUTH_ENDPOINTS.REFRESH, {
          refresh_token: refreshToken,
        });
      }),
      // Guardar nuevos tokens
      switchMap((tokens) =>
        this.storage.saveTokens(tokens.access_token, tokens.refresh_token).pipe(
          map(() => tokens.access_token)
        )
      ),
      tap((newAccessToken) => {
        this.refreshTokenInProgress = false;
        this.refreshTokenSubject.next(newAccessToken);
        this.logger.info('Access token refrescado');
      }),
      catchError((error) => {
        this.refreshTokenInProgress = false;
        this.refreshTokenSubject.next(null);
        this.logger.error('Refresh token falló', error);

        // Si falla, logout
        this.clearAuthState();
        this.router.navigate(['/login']);

        return throwError(() => error);
      })
    );
  }

  // =========================================================================
  // USER PROFILE
  // =========================================================================

  /**
   * Carga perfil del usuario autenticado
   */
  loadUserProfile(): Observable<UserRead> {
    this.logger.debug('Cargando perfil de usuario');

    return this.api.get<UserRead>(USER_ENDPOINTS.ME).pipe(
      tap((user) => {
        this._currentUser.set(user);
        this._isAuthenticated.set(true);
        this.loginStatusSubject.next(true);
        
        // Extraer scopes del JWT
        this.storage.getAccessToken().subscribe((token) => {
          if (token) {
            const payload = this.decodeToken(token);
            if (payload?.scopes) {
              this._scopes.set(payload.scopes);
            }
          }
        });

        this.logger.info('Perfil de usuario cargado', {
          username: user.username,
          role: user.role,
        });
      }),
      catchError((error) => {
        this.logger.error('Falló cargar perfil de usuario', error);
        return throwError(() => error);
      })
    );
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  /**
   * Limpia estado de autenticación
   */
  private clearAuthState(): void {
    this.storage.clearTokens().subscribe();
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    this._scopes.set([]);
    this.loginStatusSubject.next(false);
    this.logger.debug('Estado de auth limpiado');
  }

  /**
   * Decodifica JWT payload (sin verificar firma)
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;

      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload) as TokenPayload;
    } catch (error) {
      this.logger.error('Error decodificando token', error);
      return null;
    }
  }

  /**
   * Verifica si el token está expirado
   */
  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return true;

    const now = Math.floor(Date.now() / 1000);
    const bufferSeconds = 30; // Buffer de 30s antes de expiración
    return payload.exp < (now + bufferSeconds);
  }

  /**
   * Normaliza errores de la API
   */
  private normalizeError(error: any): Error {
    if (error?.message) {
      return new Error(error.message);
    }

    const status = error?.status;
    const detail = error?.error?.detail;

    switch (status) {
      case 400:
        return new Error(detail || 'Datos inválidos');
      case 401:
        return new Error(detail || 'Credenciales incorrectas');
      case 403:
        return new Error(detail || 'No autorizado');
      case 409:
        return new Error(detail || 'El usuario ya existe');
      case 422:
        return new Error(detail || 'Error de validación');
      default:
        return new Error(detail || 'Error del servidor');
    }
  }

  // =========================================================================
  // CONVENIENCE METHODS
  // =========================================================================

  hasRole(role: string): boolean {
    return this._scopes().includes(role);
  }

  isUserAdmin(): boolean {
    return this.hasRole('admin');
  }

  isLoggedIn(): boolean {
    return this._isAuthenticated();
  }
}