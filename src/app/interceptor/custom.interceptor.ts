import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, of } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';
import { LoggerService } from '../services/core/logger.service';
import { StorageService } from '../services/core/storage.service';
import { AUTH_ENDPOINTS } from '../services/constants/endpoints';

/**
 * Endpoints públicos que NO requieren token
 */
const PUBLIC_ENDPOINTS = [
  AUTH_ENDPOINTS.REGISTER,
  AUTH_ENDPOINTS.LOGIN,
  AUTH_ENDPOINTS.REFRESH,
  '/health',
  '/',
];

/**
 * Interceptor HTTP para:
 * - Agregar token de autorización a requests protegidos
 * - Manejar errores 401 (Unauthorized)
 * - Refrescar token automáticamente si expira
 * - Redirigir a login si el refresh falla
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const router = inject(Router);
  const storage = inject(StorageService);
  const authService = inject(AuthService);

  const isPublic = PUBLIC_ENDPOINTS.some(endpoint => req.url.includes(endpoint));
  
  if (isPublic) {
    logger.debug(`Request público: ${req.url}`);
    return next(req);
  }

  return storage.getAccessToken().pipe(
    switchMap((accessToken) => {
      if (!accessToken) {
        logger.debug(`Sin token: ${req.url}`);
        return next(req);
      }

      // Clonar request con authorization header
      const clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      logger.debug(`Request con token: ${req.url}`);

      return next(clonedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            logger.warn(`401 detectado en: ${req.url}, intentando refresh...`);

            return authService.refreshAccessToken().pipe(
              switchMap((newAccessToken) => {
                logger.info('Token refrescado, reintentando request original');

                const retryReq = req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${newAccessToken}`,
                  },
                });

                return next(retryReq);
              }),
              catchError((refreshError) => {
                logger.error('Refresh falló, redirigiendo a login', refreshError);

                // Limpiar estado y redirigir
                storage.clearTokens().subscribe();
                router.navigate(['/login'], {
                  queryParams: { sessionExpired: true },
                });

                return throwError(() => 
                  new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
                );
              })
            );
          }

          if (error.status === 403) {
            logger.warn(`403 Forbidden: ${req.url}`);
          } else if (error.status >= 500) {
            logger.error(`Error del servidor (${error.status}): ${req.url}`, error);
          } else {
            logger.error(`Error HTTP (${error.status}): ${req.url}`, error);
          }

          return throwError(() => error);
        })
      );
    })
  );
};