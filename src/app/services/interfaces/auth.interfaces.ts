import { UserRead } from '@interfaces'

/**
 * Modelos para autenticación y tokens
 */

export interface UserCreate {
  username: string;
  email: string;
  password: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // segundos
}

export interface TokenPayload {
  sub: string; // username
  user_id: number;
  scopes: string[]; 
  exp: number;
  iat: number;
  jti: string;
  type: 'access' | 'refresh';
}

export interface LoginCredentials {
  username: string;   // username o email
  password: string;
}

export interface AuthState {
  user: UserRead | null;
  tokens: Token | null;
  isAuthenticated: boolean;
  loading: boolean;
}