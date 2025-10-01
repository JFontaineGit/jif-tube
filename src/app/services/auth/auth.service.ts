
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AUTH_ENDPOINTS } from './auth-endpoints';
import { 
  UserRegister, 
  UserLogin, 
  MeUser, 
  TokenUserResponse 
} from '../interfaces/auth.interfaces';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiService = inject(ApiService);

  /**
   * Registers a new user
   * @param userData User registration data
   * @returns Observable with token response
   */
  register(userData: UserRegister): Observable<TokenUserResponse> {
    return this.apiService.post<TokenUserResponse>(
      AUTH_ENDPOINTS.REGISTER,
      userData
    );
  }

  /**
   * Logs in a user
   * @param credentials User login credentials
   * @returns Observable with token response
   */
  login(credentials: UserLogin): Observable<TokenUserResponse> {
    return this.apiService.post<TokenUserResponse>(
      AUTH_ENDPOINTS.LOGIN,
      credentials
    );
  }

  /**
   * Refreshes the access token
   * @param refreshToken The refresh token
   * @returns Observable with new token response
   */
  refresh(refreshToken: string): Observable<TokenUserResponse> {
    return this.apiService.post<TokenUserResponse>(
      AUTH_ENDPOINTS.REFRESH,
      { refresh_token: refreshToken }
    );
  }

  /**
   * Logs out the current user
   * @returns Observable with logout response
   */
  logout(): Observable<void> {
    return this.apiService.post<void>(AUTH_ENDPOINTS.LOGOUT, {});
  }

  /**
   * Gets the current user information
   * @returns Observable with user data
   */
  me(): Observable<MeUser> {
    return this.apiService.get<MeUser>(AUTH_ENDPOINTS.ME);
  }
}