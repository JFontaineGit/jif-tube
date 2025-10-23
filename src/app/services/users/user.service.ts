import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { LoggerService } from '../core/logger.service';
import { USER_ENDPOINTS } from '../constants/endpoints';
import { UserRead, UserUpdate } from '../interfaces/user.interfaces';

/**
 * Servicio para gestión de usuarios.
 * 
 * Features:
 * - Obtener perfil de usuario (me)
 * - Listar usuarios (admin)
 * - Actualizar usuario
 * - Estado reactivo con Signals
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly api = inject(ApiService);
  private readonly logger = inject(LoggerService);

  // Estado reactivo
  private readonly _users = signal<UserRead[]>([]);
  private readonly _isLoading = signal<boolean>(false);

  readonly users = this._users.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  constructor() {
    this.logger.info('UserService initialized');
  }

  // =========================================================================
  // GET CURRENT USER (ME)
  // =========================================================================

  /**
   * Obtiene el perfil del usuario autenticado
   * Nota: AuthService ya tiene loadUserProfile(), este es un wrapper
   */
  getMe(): Observable<UserRead> {
    this.logger.debug('Obteniendo perfil de usuario (me)');
    this._isLoading.set(true);

    return this.api.get<UserRead>(USER_ENDPOINTS.ME).pipe(
      tap((user) => {
        this.logger.info('Perfil obtenido', {
          username: user.username,
          role: user.role,
        });
      }),
      catchError((error) => {
        this.logger.error('Error obteniendo perfil', error);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._isLoading.set(false))
    );
  }

  // =========================================================================
  // LIST USERS (ADMIN ONLY)
  // =========================================================================

  /**
   * Lista todos los usuarios (requiere permisos de admin)
   */
  listUsers(): Observable<UserRead[]> {
    this.logger.info('Listando usuarios (admin)');
    this._isLoading.set(true);

    return this.api.get<UserRead[]>(USER_ENDPOINTS.LIST).pipe(
      tap((users) => {
        this._users.set(users);
        this.logger.info('Usuarios listados', { count: users.length });
      }),
      catchError((error) => {
        this.logger.error('Error listando usuarios', error);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._isLoading.set(false))
    );
  }

  // =========================================================================
  // GET USER BY ID (ADMIN ONLY)
  // =========================================================================

  /**
   * Obtiene un usuario específico por ID (requiere admin)
   * @param userId ID del usuario
   */
  getUserById(userId: number): Observable<UserRead> {
    this.logger.debug('Obteniendo usuario por ID', { userId });
    this._isLoading.set(true);

    return this.api.get<UserRead>(USER_ENDPOINTS.BY_ID(userId)).pipe(
      tap((user) => {
        this.logger.info('Usuario obtenido', {
          userId,
          username: user.username,
        });
      }),
      catchError((error) => {
        this.logger.error('Error obteniendo usuario', error);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._isLoading.set(false))
    );
  }

  // =========================================================================
  // UPDATE USER
  // =========================================================================

  /**
   * Actualiza datos de un usuario
   * @param userId ID del usuario a actualizar
   * @param updates Campos a actualizar
   */
  updateUser(userId: number, updates: UserUpdate): Observable<UserRead> {
    this.logger.info('Actualizando usuario', { userId, updates });
    this._isLoading.set(true);

    return this.api.patch<UserRead>(
      USER_ENDPOINTS.BY_ID(userId),
      updates
    ).pipe(
      tap((updatedUser) => {
        // Actualizar en la lista local si existe
        this._users.update(users => 
          users.map(u => u.id === userId ? updatedUser : u)
        );
        this.logger.info('Usuario actualizado', {
          userId,
          username: updatedUser.username,
        });
      }),
      catchError((error) => {
        this.logger.error('Error actualizando usuario', error);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._isLoading.set(false))
    );
  }

  /**
   * Actualiza el perfil del usuario actual (shortcut)
   * Nota: Deberías usar AuthService para esto y luego recargar perfil
   */
  updateMe(updates: UserUpdate): Observable<UserRead> {
    this.logger.warn('updateMe: considera usar AuthService.loadUserProfile() después');
    this._isLoading.set(true);

    return this.api.patch<UserRead>(USER_ENDPOINTS.ME, updates).pipe(
      tap((updatedUser) => {
        this.logger.info('Perfil actualizado', {
          username: updatedUser.username,
        });
      }),
      catchError((error) => {
        this.logger.error('Error actualizando perfil', error);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._isLoading.set(false))
    );
  }

  // =========================================================================
  // DELETE USER (si el backend lo soporta)
  // =========================================================================

  /**
   * Elimina un usuario (admin only)
   * Nota: Solo si tu backend tiene DELETE /users/{id}
   */
  deleteUser(userId: number): Observable<void> {
    this.logger.warn('Eliminando usuario', { userId });
    this._isLoading.set(true);

    return this.api.delete<void>(USER_ENDPOINTS.BY_ID(userId)).pipe(
      tap(() => {
        // Quitar de la lista local
        this._users.update(users => users.filter(u => u.id !== userId));
        this.logger.info('Usuario eliminado', { userId });
      }),
      catchError((error) => {
        this.logger.error('Error eliminando usuario', error);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._isLoading.set(false))
    );
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  /**
   * Busca un usuario en la lista local por ID
   */
  findUserById(userId: number): UserRead | undefined {
    return this._users().find(u => u.id === userId);
  }

  /**
   * Busca un usuario en la lista local por username
   */
  findUserByUsername(username: string): UserRead | undefined {
    return this._users().find(u => u.username === username);
  }

  /**
   * Limpia la lista local de usuarios
   */
  clearUsers(): void {
    this._users.set([]);
    this.logger.debug('Lista de usuarios limpiada');
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  /**
   * Valida datos de actualización de usuario
   */
  private validateUserUpdate(updates: UserUpdate): void {
    if (updates.password && updates.password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }

    if (updates.username && updates.username.trim().length < 3) {
      throw new Error('El nombre de usuario debe tener al menos 3 caracteres');
    }

    if (updates.email && !this.isValidEmail(updates.email)) {
      throw new Error('Email inválido');
    }
  }

  /**
   * Validación básica de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
        return new Error('No autorizado');
      case 403:
        return new Error('Permisos insuficientes');
      case 404:
        return new Error('Usuario no encontrado');
      case 409:
        return new Error(detail || 'El usuario ya existe');
      case 422:
        return new Error(detail || 'Error de validación');
      default:
        return new Error(detail || 'Error en la operación');
    }
  }
}