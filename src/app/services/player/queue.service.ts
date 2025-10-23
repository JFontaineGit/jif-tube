import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { LoggerService, StorageService } from '@services/barrels/services'
import { Song, RepeatMode, QueueState } from '@interfaces'
import { STORAGE_KEYS } from '@constants'

/**
 * Servicio para gestión de cola de reproducción.
 * 
 * Features:
 * - Cola de reproducción con siguiente/anterior
 * - Historial de reproducción
 * - Shuffle (aleatorio)
 * - Repeat (off/all/one)
 * - Persistencia en localStorage
 * - Estado reactivo con Signals
 */
@Injectable({
  providedIn: 'root',
})
export class QueueService {
  private readonly logger = inject(LoggerService);
  private readonly storage = inject(StorageService);

  // =========================================================================
  // STATE (Signals)
  // =========================================================================

  private readonly _queue = signal<Song[]>([]);
  private readonly _currentIndex = signal<number>(-1);
  private readonly _history = signal<Song[]>([]);
  private readonly _repeatMode = signal<RepeatMode>(RepeatMode.OFF);
  private readonly _shuffle = signal<boolean>(false);

  readonly queue = this._queue.asReadonly();
  readonly currentIndex = this._currentIndex.asReadonly();
  readonly history = this._history.asReadonly();
  readonly repeatMode = this._repeatMode.asReadonly();
  readonly shuffle = this._shuffle.asReadonly();

  // Computed signals
  readonly currentSong = computed(() => {
    const idx = this._currentIndex();
    const q = this._queue();
    return idx >= 0 && idx < q.length ? q[idx] : null;
  });

  readonly hasNext = computed(() => {
    const idx = this._currentIndex();
    const len = this._queue().length;
    const repeat = this._repeatMode();
    
    if (repeat === RepeatMode.ONE) return true;
    if (repeat === RepeatMode.ALL && len > 0) return true;
    return idx < len - 1;
  });

  readonly hasPrevious = computed(() => {
    const idx = this._currentIndex();
    const len = this._queue().length;
    const repeat = this._repeatMode();
    
    if (repeat === RepeatMode.ALL && len > 0) return true;
    return idx > 0;
  });

  readonly queueSize = computed(() => this._queue().length);

  readonly isEmpty = computed(() => this._queue().length === 0);

  constructor() {
    this.logger.info('QueueService initialized');
    this.loadQueueFromStorage();

    // Efecto: Guardar cola en storage cuando cambie
    effect(() => {
      const q = this._queue();
      if (q.length > 0) {
        this.saveQueueToStorage();
      }
    });
  }

  // =========================================================================
  // QUEUE MANAGEMENT
  // =========================================================================

  /**
   * Establece una nueva cola de reproducción
   * @param songs Canciones a agregar
   * @param startIndex Índice inicial (default: 0)
   */
  setQueue(songs: Song[], startIndex: number = 0): void {
    if (!songs || songs.length === 0) {
      this.logger.warn('Intento de establecer cola vacía');
      return;
    }

    this._queue.set([...songs]);
    this._currentIndex.set(Math.max(0, Math.min(startIndex, songs.length - 1)));
    
    this.logger.info('Cola establecida', {
      size: songs.length,
      startIndex,
    });
  }

  /**
   * Agrega una canción al final de la cola
   */
  addToQueue(song: Song): void {
    this._queue.update(q => [...q, song]);
    
    // Si la cola estaba vacía, establecer como actual
    if (this._queue().length === 1) {
      this._currentIndex.set(0);
    }

    this.logger.info('Canción agregada a la cola', { title: song.title });
  }

  /**
   * Agrega múltiples canciones al final de la cola
   */
  addMultipleToQueue(songs: Song[]): void {
    this._queue.update(q => [...q, ...songs]);
    
    if (this._queue().length === songs.length) {
      this._currentIndex.set(0);
    }

    this.logger.info('Canciones agregadas a la cola', { count: songs.length });
  }

  /**
   * Inserta una canción después de la actual
   */
  playNext(song: Song): void {
    const idx = this._currentIndex();
    this._queue.update(q => {
      const newQueue = [...q];
      newQueue.splice(idx + 1, 0, song);
      return newQueue;
    });

    this.logger.info('Canción insertada como siguiente', { title: song.title });
  }

  /**
   * Elimina una canción de la cola por índice
   */
  removeFromQueue(index: number): void {
    const q = this._queue();
    
    if (index < 0 || index >= q.length) {
      this.logger.warn('Índice fuera de rango', { index });
      return;
    }

    const currentIdx = this._currentIndex();
    
    this._queue.update(queue => queue.filter((_, i) => i !== index));
    
    // Ajustar índice actual si es necesario
    if (index < currentIdx) {
      this._currentIndex.update(idx => idx - 1);
    } else if (index === currentIdx) {
      // Si eliminamos la actual, no cambiar el índice (la siguiente tomará su lugar)
      // Pero si era la última, retroceder
      if (currentIdx >= this._queue().length) {
        this._currentIndex.update(idx => Math.max(0, idx - 1));
      }
    }

    this.logger.info('Canción eliminada de la cola', { index });
  }

  /**
   * Limpia toda la cola
   */
  clearQueue(): void {
    this._queue.set([]);
    this._currentIndex.set(-1);
    this._history.set([]);
    this.logger.info('Cola limpiada');
  }

  /**
   * Reordena la cola (drag & drop)
   */
  reorderQueue(fromIndex: number, toIndex: number): void {
    this._queue.update(q => {
      const newQueue = [...q];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      
      // Ajustar índice actual
      const currentIdx = this._currentIndex();
      if (fromIndex === currentIdx) {
        this._currentIndex.set(toIndex);
      } else if (fromIndex < currentIdx && toIndex >= currentIdx) {
        this._currentIndex.update(idx => idx - 1);
      } else if (fromIndex > currentIdx && toIndex <= currentIdx) {
        this._currentIndex.update(idx => idx + 1);
      }
      
      return newQueue;
    });

    this.logger.debug('Cola reordenada', { fromIndex, toIndex });
  }

  // =========================================================================
  // NAVIGATION
  // =========================================================================

  /**
   * Avanza a la siguiente canción
   * @returns La siguiente canción o null
   */
  next(): Song | null {
    const q = this._queue();
    const idx = this._currentIndex();
    const repeat = this._repeatMode();
    const shuffle = this._shuffle();

    if (q.length === 0) return null;

    // Repeat ONE → repetir la misma
    if (repeat === RepeatMode.ONE) {
      return this.currentSong();
    }

    let nextIdx: number;

    if (shuffle) {
      // Shuffle: elegir aleatoria (diferente a la actual)
      nextIdx = this.getRandomIndex(q.length, idx);
    } else {
      // Normal: siguiente
      nextIdx = idx + 1;
      
      // Si llegamos al final
      if (nextIdx >= q.length) {
        if (repeat === RepeatMode.ALL) {
          nextIdx = 0; // Volver al principio
        } else {
          return null; // Fin de la cola
        }
      }
    }

    this.setCurrentIndex(nextIdx);
    return q[nextIdx];
  }

  /**
   * Retrocede a la canción anterior
   * @returns La canción anterior o null
   */
  previous(): Song | null {
    const q = this._queue();
    const idx = this._currentIndex();
    const repeat = this._repeatMode();

    if (q.length === 0) return null;

    let prevIdx = idx - 1;

    if (prevIdx < 0) {
      if (repeat === RepeatMode.ALL) {
        prevIdx = q.length - 1; // Ir al final
      } else {
        return null;
      }
    }

    this.setCurrentIndex(prevIdx);
    return q[prevIdx];
  }

  /**
   * Salta a una canción específica por índice
   */
  jumpTo(index: number): Song | null {
    const q = this._queue();
    
    if (index < 0 || index >= q.length) {
      this.logger.warn('Índice fuera de rango', { index });
      return null;
    }

    this.setCurrentIndex(index);
    return q[index];
  }

  /**
   * Establece el índice actual y actualiza historial
   */
  private setCurrentIndex(index: number): void {
    const previousSong = this.currentSong();
    
    this._currentIndex.set(index);
    
    // Agregar canción anterior al historial
    if (previousSong) {
      this._history.update(h => [...h, previousSong].slice(-50)); // Último 50
    }

    this.logger.debug('Índice actual actualizado', { index });
  }

  // =========================================================================
  // PLAYBACK MODES
  // =========================================================================

  /**
   * Cambia el modo de repetición
   */
  setRepeatMode(mode: RepeatMode): void {
    this._repeatMode.set(mode);
    this.logger.info('Modo de repetición cambiado', { mode });
  }

  /**
   * Cicla entre los modos de repetición
   */
  toggleRepeatMode(): RepeatMode {
    const current = this._repeatMode();
    
    const next = 
      current === RepeatMode.OFF ? RepeatMode.ALL :
      current === RepeatMode.ALL ? RepeatMode.ONE :
      RepeatMode.OFF;

    this.setRepeatMode(next);
    return next;
  }

  /**
   * Activa/desactiva shuffle
   */
  setShuffle(enabled: boolean): void {
    this._shuffle.set(enabled);
    this.logger.info('Shuffle cambiado', { enabled });
  }

  /**
   * Toggle shuffle
   */
  toggleShuffle(): boolean {
    const newValue = !this._shuffle();
    this.setShuffle(newValue);
    return newValue;
  }

  // =========================================================================
  // PERSISTENCE
  // =========================================================================

  /**
   * Guarda la cola en localStorage
   */
  private saveQueueToStorage(): void {
    const state: QueueState = {
      queue: this._queue(),
      currentIndex: this._currentIndex(),
      history: this._history(),
      repeatMode: this._repeatMode(),
      shuffle: this._shuffle(),
    };

    this.storage.saveQueue(state).subscribe({
      error: err => this.logger.error('Error guardando cola', err),
    });
  }

  /**
   * Carga la cola desde localStorage
   */
  private loadQueueFromStorage(): void {
    this.storage.getItem<QueueState>(STORAGE_KEYS.QUEUE).subscribe({
      next: (state) => {
        if (state) {
          this._queue.set(state.queue || []);
          this._currentIndex.set(state.currentIndex ?? -1);
          this._history.set(state.history || []);
          this._repeatMode.set(state.repeatMode || RepeatMode.OFF);
          this._shuffle.set(state.shuffle || false);
          
          this.logger.info('Cola cargada desde storage', {
            size: state.queue?.length || 0,
          });
        }
      },
      error: err => this.logger.error('Error cargando cola', err),
    });
  }

  /**
   * Obtiene un índice aleatorio diferente al actual
   */
  private getRandomIndex(length: number, excludeIndex: number): number {
    if (length <= 1) return 0;
    
    let randomIdx: number;
    do {
      randomIdx = Math.floor(Math.random() * length);
    } while (randomIdx === excludeIndex);
    
    return randomIdx;
  }

  /**
   * Obtiene información de la cola (debug)
   */
  getQueueInfo(): {
    size: number;
    currentIndex: number;
    currentTitle: string | null;
    repeatMode: RepeatMode;
    shuffle: boolean;
  } {
    const current = this.currentSong();
    return {
      size: this._queue().length,
      currentIndex: this._currentIndex(),
      currentTitle: current?.title || null,
      repeatMode: this._repeatMode(),
      shuffle: this._shuffle(),
    };
  }

  /**
   * Obtiene las próximas N canciones
   */
  getUpcoming(count: number = 5): Song[] {
    const q = this._queue();
    const idx = this._currentIndex();
    
    if (idx === -1 || idx >= q.length - 1) return [];
    
    const upcoming = q.slice(idx + 1, idx + 1 + count);
    return upcoming;
  }

  /**
   * Busca una canción en la cola por video_id
   */
  findSongInQueue(videoId: string): { song: Song; index: number } | null {
    const q = this._queue();
    const index = q.findIndex(s => s.id === videoId);
    
    if (index === -1) return null;
    
    return { song: q[index], index };
  }

  /**
   * Verifica si una canción está en la cola
   */
  isInQueue(videoId: string): boolean {
    return this._queue().some(s => s.id === videoId);
  }
}