import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerService, LibraryService, LoggerService, AuthService, QueueService } from '@services';
import { Song } from '@interfaces';
import { SongCardComponent } from '../../components/song-card/song-card.component';
import { AuthDialogComponent } from '../../components/auth-dialog/auth-dialog.component';

/**
 * Library Page Component - Muestra la biblioteca de canciones favoritas del usuario
 * 
 * Features:
 * - Grid de canciones guardadas (si está logueado)
 * - Call to action para iniciar sesión cuando no se ha autenticado
 * - Reproducción directa de una canción
 * - Eliminar de favoritos
 * - Estados de carga y error
 * - Mensajes de estado vacío personalizados
 */
@Component({
  selector: 'app-library-page',
  standalone: true,
  imports: [CommonModule, SongCardComponent, AuthDialogComponent],
  templateUrl: './library-page.component.html',
  styleUrls: ['./library-page.component.scss'],
})
export class LibraryPageComponent implements OnInit {
  private readonly playerService = inject(PlayerService);
  private readonly libraryService = inject(LibraryService);
  private readonly logger = inject(LoggerService);
  private readonly auth = inject(AuthService);
  private readonly queueService = inject(QueueService);

  // Controlar apertura/cierre del diálogo de autenticación
  public readonly isAuthDialogOpen = signal(false);

  private readonly _error = signal<string | null>(null);

  readonly error = this._error.asReadonly();
  readonly isLoading = this.libraryService.isLoading;
  readonly libraryItems = this.libraryService.libraryItems;
  readonly isAuthenticated = this.auth.isAuthenticated;

  // Lista de canciones derivadas de LibraryItem
  readonly songs = computed(() =>
    this.libraryItems()
      .map(item => item.song)
      .filter((song): song is Song => song !== undefined)
  );

  // Número de canciones
  readonly songCount = computed(() => this.songs().length);

  // Indica si está vacío (solo cuando está autenticado y no cargando)
  readonly isEmpty = computed(() =>
    this.isAuthenticated() && !this.isLoading() && this.songs().length === 0
  );

  ngOnInit(): void {
    this.logger.info('LibraryPageComponent initialized');
    // Cargar biblioteca sólo si está autenticado
    if (this.isAuthenticated()) {
      this.loadLibrary();
    }
  }

  // Carga la biblioteca y gestiona errores
  private loadLibrary(): void {
    this.logger.info('Cargando biblioteca del usuario');
    this._error.set(null);

    this.libraryService.getLibrary().subscribe({
      next: (items) => {
        this.logger.info(`✅ Biblioteca cargada: ${items.length} canciones`);
      },
      error: (err) => {
        this.logger.error('❌ Error cargando biblioteca:', err);
        this._error.set(err.message || 'Error al cargar la biblioteca');
      },
    });
  }

  // Recarga la biblioteca manualmente (sólo si está autenticado)
  reloadLibrary(): void {
    if (this.isAuthenticated()) {
      this.loadLibrary();
    }
  }

  // ==========================
  // Diálogo de autenticación
  // ==========================

  /** Abre el diálogo de login */
  openLoginDialog(): void {
    this.isAuthDialogOpen.set(true);
  }

  /** Tras un login exitoso, cierra el diálogo y recarga biblioteca */
  onAuthSuccess(): void {
    this.isAuthDialogOpen.set(false);
    this.reloadLibrary();
  }

  // ==========================
  // Eventos del SongCard
  // ==========================

  /** Maneja la selección de una canción para reproducirla */
  onSongSelected(song: Song, index: number, songs: Song[]): void {
    if (!song?.id) {
      this.logger.error('Canción sin ID:', song);
      this._error.set('No se puede reproducir esta canción');
      return;
    }

    this.logger.info(`▶️ Reproduciendo desde biblioteca: ${song.title}`);
    const playlist = Array.isArray(songs) && songs.length > 0 ? songs : [song];
    const startIndex = Math.max(0, Math.min(index, playlist.length - 1));

    this.queueService.setQueue(playlist, startIndex);

    this.playerService.loadAndPlay(song.id, { autoplay: true }).subscribe({
      next: () => this.logger.info('✅ Canción cargada correctamente'),
      error: (err) => {
        this.logger.error('❌ Error reproduciendo canción:', err);
        this._error.set('Error al reproducir la canción');
      },
    });
  }

  /** Elimina una canción de la biblioteca */
  removeSong(songId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (!songId) {
      this.logger.warn('Intento de eliminar canción sin ID');
      return;
    }

    const song = this.songs().find(s => s.id === songId);
    const songTitle = song?.title || 'canción';

    this.logger.info(`🗑️ Eliminando de biblioteca: ${songTitle}`);

    this.libraryService.removeFromLibrary(songId).subscribe({
      next: () => this.logger.info(`✅ ${songTitle} eliminada de la biblioteca`),
      error: (err) => {
        this.logger.error('❌ Error eliminando canción:', err);
        this._error.set(err.message || 'Error al eliminar la canción');
      },
    });
  }

  /** Limpia el mensaje de error */
  clearError(): void {
    this._error.set(null);
  }

  /** Utilizado por trackBy en *ngFor */
  trackBySongId(index: number, song: Song): string {
    return song.id || index.toString();
  }

  /** Mensaje para el estado vacío */
  getEmptyStateMessage(): string {
    if (!this.isAuthenticated()) {
      return 'Inicia sesión para ver tu biblioteca';
    }
    if (this._error()) {
      return 'Ocurrió un error al cargar tu biblioteca';
    }
    return 'Tu biblioteca está vacía';
  }

  /** Subtítulo para el estado vacío */
  getEmptyStateSubtitle(): string {
    if (!this.isAuthenticated()) {
      return 'Necesitas una cuenta para guardar y ver tus canciones favoritas.';
    }
    if (this._error()) {
      return 'Intenta recargar la página';
    }
    return 'Guarda canciones para acceder a ellas fácilmente';
  }
}
