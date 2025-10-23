/**
 * Constantes de endpoints de la API.
 */

// =============================================================================
// AUTHENTICATION
// =============================================================================
export const AUTH_ENDPOINTS = {
  REGISTER: 'auth/register',
  LOGIN: 'auth/login',
  REFRESH: 'auth/refresh',
  LOGOUT: 'auth/logout',
} as const;

// =============================================================================
// USERS
// =============================================================================
export const USER_ENDPOINTS = {
  ME: 'users/me',
  LIST: 'users',
  BY_ID: (userId: number) => `users/${userId}`,
} as const;

// =============================================================================
// SEARCH
// =============================================================================
export const SEARCH_ENDPOINTS = {
  SEARCH: 'search',
  HISTORY: 'search/history',
} as const;

// =============================================================================
// SONGS
// =============================================================================
export const SONG_ENDPOINTS = {
  BY_ID: (videoId: string) => `songs/${videoId}`,
  LIST: 'songs',
} as const;

// =============================================================================
// LIBRARY
// =============================================================================
export const LIBRARY_ENDPOINTS = {
  LIST: 'library',
  ADD: 'library',
  REMOVE: (songId: string) => `library/${songId}`,
  BY_ID: (itemId: number) => `library/${itemId}`,
} as const;

export const SYSTEM_ENDPOINTS = {
  HEALTH: '/health',
  ROOT: '/',
} as const;

export type AuthEndpoint = typeof AUTH_ENDPOINTS[keyof typeof AUTH_ENDPOINTS];
export type UserEndpoint = typeof USER_ENDPOINTS[keyof typeof USER_ENDPOINTS] | ReturnType<typeof USER_ENDPOINTS.BY_ID>;
export type SearchEndpoint = typeof SEARCH_ENDPOINTS[keyof typeof SEARCH_ENDPOINTS];
export type SongEndpoint = typeof SONG_ENDPOINTS[keyof typeof SONG_ENDPOINTS] | ReturnType<typeof SONG_ENDPOINTS.BY_ID>;
export type LibraryEndpoint = typeof LIBRARY_ENDPOINTS[keyof typeof LIBRARY_ENDPOINTS] | ReturnType<typeof LIBRARY_ENDPOINTS.REMOVE>;