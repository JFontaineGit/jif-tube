import { Song } from '@interfaces'

/**
 * Modos de repetición
 */
export enum RepeatMode {
  OFF = 'off',
  ALL = 'all',
  ONE = 'one',
}

/**
 * Estado de la cola de reproducción
 */
export interface QueueState {
  queue: Song[];
  currentIndex: number;
  history: Song[];
  repeatMode: RepeatMode;
  shuffle: boolean;
}