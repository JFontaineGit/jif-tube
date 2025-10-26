/**
 * Constantes para keys de localStorage.
 * Centralizadas para evitar typos y facilitar cambios.
 */

export const STORAGE_KEYS = {
  // Auth
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  REMEMBER_EMAIL: 'remember_email',
  
  // User preferences
  USER_SETTINGS: 'user_settings',
  THEME: 'theme',
  VOLUME: 'volume',
  PLAYBACK_QUALITY: 'playback_quality',
  
  // Player state (opcional, si querés persistir estado)
  PLAYER_STATE: 'player_state',
  QUEUE: 'queue',
  
  // Cache flags (si querés manejar algo local)
  LAST_SYNC: 'last_sync',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];