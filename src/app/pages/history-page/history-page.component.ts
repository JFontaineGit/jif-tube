import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { PlayerService } from '../../services/player.service';
import { LoggerService } from '../../services/core/logger.service';
import { Song } from '../../models/song.model';
import { SongCardComponent } from '../../components/song-card/song-card.component';

const HISTORY_STORAGE_KEY = 'recentSongs';
const MAX_HISTORY_ITEMS = 50;

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, SongCardComponent],
  templateUrl: './history-page.component.html',
  styleUrls: ['./history-page.component.scss'],
})
export class HistoryPageComponent implements OnInit, OnDestroy {
  private playerService = inject(PlayerService);
  private logger = inject(LoggerService);
  private platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();
  private isBrowser = isPlatformBrowser(this.platformId);

  recentSongs = signal<Song[]>([]);
  error = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.isBrowser) return;

    this.loadHistory();
    this.setupPlayerListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga el historial desde localStorage
   */
  private loadHistory(): void {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      const songs = saved ? JSON.parse(saved) : [];
      this.recentSongs.set(songs);
      this.logger.info(`Historial cargado: ${songs.length} canciones`);
    } catch (err) {
      this.logger.error('Error cargando historial:', err);
      this.error.set('Error al cargar el historial');
      this.recentSongs.set([]);
    }
  }

  /**
   * Escucha cambios en el reproductor para actualizar historial
   */
  private setupPlayerListener(): void {
    this.playerService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.currentSong) {
          this.addToHistory(state.currentSong);
        }
      });
  }

  /**
   * Agrega una canción al historial (evita duplicados)
   */
  private addToHistory(song: Song): void {
    try {
      const current = this.recentSongs();
      const filtered = current.filter(s => s.id !== song.id);
      const updated = [song, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      this.recentSongs.set(updated);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      this.logger.error('Error guardando en historial:', err);
    }
  }

  /**
   * Reproduce una canción
   */
  onSongSelected(song: Song): void {
    if (!song?.videoId) {
      this.logger.error(`Canción sin videoId: ${song?.title}`);
      this.error.set('No se puede reproducir esta canción');
      return;
    }

    this.logger.info(`Reproduciendo desde historial: ${song.title}`);
    this.playerService.loadVideo(song.videoId, 0, song);
  }

  /**
   * Limpia todo el historial
   */
  clearHistory(): void {
    try {
      this.recentSongs.set([]);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      this.logger.info('Historial limpiado');
    } catch (err) {
      this.logger.error('Error limpiando historial:', err);
      this.error.set('Error al limpiar el historial');
    }
  }

  /**
   * TrackBy para optimizar renderizado
   */
  trackBySongId(index: number, song: Song): string {
    return song.id || index.toString();
  }
}