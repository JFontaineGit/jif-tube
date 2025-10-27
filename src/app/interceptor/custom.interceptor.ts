import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent,
  HttpErrorResponse 
} from '@angular/common/http';
import { Injectable, inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { LoggerService } from '../services/core/logger.service';
import { StorageService } from '../services/core/storage.service';
import { AUTH_ENDPOINTS } from '../services/constants/endpoints';
import type { AuthService } from '../services/auth/auth.service';

/**
 * Endpoints públicos que NO requieren token
 */
const PUBLIC_ENDPOINTS = [
  AUTH_ENDPOINTS.REGISTER,
  AUTH_ENDPOINTS.LOGIN,
  AUTH_ENDPOINTS.REFRESH,
  AUTH_ENDPOINTS.LOGOUT,
];

/**
 * Usa Injector para lazy loading de AuthService
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly logger = inject(LoggerService);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly injector = inject(Injector);
  
  private authService?: AuthService;

  /**
   * ✅ Obtiene AuthService de forma lazy para evitar circular dependency
   */
  private getAuthService(): AuthService {
    if (!this.authService) {
      // Lazy loading - solo cuando realmente se necesita
      // @ts-ignore - Importación dinámica para evitar circular dependency
      const { AuthService } = require('../services/auth/auth.service');
      this.authService = this.injector.get(AuthService);
    }
    return this.authService!;
  }

  /**
   * ✅ Firma correcta para class-based interceptor
   */
  intercept(
    req: HttpRequest<unknown>, 
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    
    // Verificar si la URL es pública
    const isPublic = PUBLIC_ENDPOINTS.some(endpoint => req.url.includes(endpoint));
    
    if (isPublic) {
      this.logger.debug(`Request público (sin token): ${req.url}`);
      return next.handle(req);
    }

    // Obtener token y agregar al header
    return this.storage.getAccessToken().pipe(
      switchMap((accessToken) => {
        if (!accessToken) {
          this.logger.debug(`Sin token disponible: ${req.url}`);
          return next.handle(req);
        }

        // Clonar request con authorization header
        const clonedReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        this.logger.debug(`Request con token: ${req.url}`);

        return next.handle(clonedReq).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
              this.logger.warn(`401 detectado en: ${req.url}, intentando refresh...`);

              // Evitar loop infinito si el refresh también falla
              if (req.url.includes(AUTH_ENDPOINTS.REFRESH)) {
                this.logger.error('El refresh token también falló, sesión inválida');
                this.storage.clearTokens().subscribe();
                this.router.navigate(['/login'], {
                  queryParams: { sessionExpired: true },
                });
                return throwError(() => new Error('Sesión expirada'));
              }

              // ✅ Obtener AuthService de forma lazy solo cuando hay 401
              const authService = this.getAuthService();

              // Intentar refresh
              return authService.refreshAccessToken().pipe(
                switchMap((newAccessToken: string) => {
                  this.logger.info('Token refrescado, reintentando request original');

                  const retryReq = req.clone({
                    setHeaders: {
                      Authorization: `Bearer ${newAccessToken}`,
                    },
                  });

                  return next.handle(retryReq);
                }),
                catchError((refreshError: any) => {
                  this.logger.error('Refresh falló, redirigiendo a login', refreshError);

                  // Limpiar estado y redirigir
                  this.storage.clearTokens().subscribe();
                  this.router.navigate(['/login'], {
                    queryParams: { sessionExpired: true },
                  });

                  return throwError(() => 
                    new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
                  );
                })
              );
            }

            // Otros errores
            if (error.status === 403) {
              this.logger.warn(`403 Forbidden: ${req.url}`);
            } else if (error.status >= 500) {
              this.logger.error(`Error del servidor (${error.status}): ${req.url}`, error);
            } else {
              this.logger.error(`Error HTTP (${error.status}): ${req.url}`, error);
            }

            return throwError(() => error);
          })
        );
      })
    );
  }
}