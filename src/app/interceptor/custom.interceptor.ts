import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, BehaviorSubject } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth/auth.service';
import { TokenUserResponse } from '../services/interfaces/auth.interfaces';
import { LoggerService } from '../services/core/logger.service';
import { StorageService } from '../services/core/storage.service';

const PUBLIC_ENDPOINTS = [
  'auth/register',
  'auth/login',
  'auth/refresh'
];

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const router = inject(Router);
  const storage = inject(StorageService);
  const injector = inject(Injector);

  // Check if the request is to a public endpoint
  const isPublic = PUBLIC_ENDPOINTS.some(endpoint => req.url.includes(endpoint));
  
  if (isPublic) {
    return next(req);
  }

  // Get tokens from storage
  const accessToken = storage.getAccessToken();
  const refreshToken = storage.getRefreshToken();

  // If no access token, proceed without authorization
  if (!accessToken) {
    return next(req);
  }

  // Clone request with authorization header
  const clonedReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return next(clonedReq).pipe(
    catchError((error) => {
      // Handle 401 Unauthorized errors
      if (error.status === 401 && refreshToken) {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshSubject.next(null);

          const authService = injector.get(AuthService);

          return authService.refresh(refreshToken).pipe(
            switchMap((response: TokenUserResponse) => {
              isRefreshing = false;
              
              // Store new tokens
              storage.setAccessToken(response.access_token);
              storage.setRefreshToken(response.refresh_token);
              
              // Notify waiting requests
              refreshSubject.next(response.access_token);

              // Retry original request with new token
              const newClonedReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${response.access_token}`
                }
              });
              
              return next(newClonedReq);
            }),
            catchError((refreshError) => {
              isRefreshing = false;
              refreshSubject.next(null);
              
              // Clear tokens and redirect to login
              storage.removeTokens();
              router.navigate(['/login']);
              
              logger.error('Error al refrescar el token:', refreshError);
              return throwError(() => new Error('Sesión expirada, por favor inicia sesión nuevamente.'));
            })
          );
        } else {
          // Wait for refresh to complete
          return refreshSubject.pipe(
            filter(token => token !== null),
            take(1),
            switchMap((newToken) => {
              const newClonedReq = req.clone({
                setHeaders: { 
                  Authorization: `Bearer ${newToken}` 
                }
              });
              return next(newClonedReq);
            })
          );
        }
      }

      // Log and propagate other errors
      logger.error(`Error en la petición ${req.url}:`, error.message || error);
      return throwError(() => error);
    })
  );
};