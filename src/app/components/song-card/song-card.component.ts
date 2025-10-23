import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerService, QueueService, LibraryService, ThemeService } from '@services';
import { Song } from '@interfaces';
import { SongOptionsMenuComponent } from './song-menu/song-menu.component';

/**
 * Componente SongCard - Tarjeta de canción con thumbnail, info y acciones
 * 
 * Features:
 * - Reproducción directa al click
 * - Menú de opciones (agregar a cola, favoritos, etc.)
 * - Estado de favorito reactivo
 * - Lazy loading de imágenes
 * - Animaciones y hover states
 * - Accesibilidad completa
 * - Color dinámico extraído del thumbnail
 * - Soporte para thumbnails en formato string o objeto
 */
@Component({
  selector: 'app-song-card',
  standalone: true,
  imports: [CommonModule, SongOptionsMenuComponent],
  templateUrl: './song-card.component.html',
  styleUrls: ['./song-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongCardComponent {
  private readonly playerService = inject(PlayerService);
  private readonly queueService = inject(QueueService);
  private readonly libraryService = inject(LibraryService);
  private readonly themeService = inject(ThemeService);

  // =========================================================================
  // INPUTS & OUTPUTS
  // =========================================================================

  @Input({ required: true }) song!: Song;
  @Input() showActions = true;
  @Input() showDuration = true;
  @Input() showArtist = true;
  @Input() showAlbum = false;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';

  @Output() selected = new EventEmitter<Song>();
  @Output() optionsClick = new EventEmitter<{ song: Song; event: MouseEvent }>();
  @Output() favoriteToggle = new EventEmitter<{ song: Song; isFavorite: boolean }>();

  // =========================================================================
  // STATE SIGNALS
  // =========================================================================

  private readonly _imageLoaded = signal(false);
  private readonly _imageError = signal(false);
  private readonly _isHovered = signal(false);
  private readonly _dominantColor = signal<string | null>(null);
  private readonly _isMenuOpen = signal(false);
  private readonly _menuAnchorRect = signal<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  readonly imageLoaded = this._imageLoaded.asReadonly();
  readonly imageError = this._imageError.asReadonly();
  readonly dominantColor = this._dominantColor.asReadonly();
  readonly isMenuOpen = this._isMenuOpen.asReadonly();
  readonly menuAnchorRect = this._menuAnchorRect.asReadonly();

  // =========================================================================
  // COMPUTED SIGNALS
  // =========================================================================

  /**
   * Verifica si esta canción es la que está reproduciendo actualmente
   */
  readonly isPlaying = computed(() => {
    const currentSong = this.playerService.currentSong();
    const isPlayingState = this.playerService.playing();
    return currentSong?.id === this.song?.id && isPlayingState;
  });

  /**
   * Verifica si la canción está en favoritos
   */
  readonly isFavorite = computed(() => {
    return this.libraryService.isFavorite(this.song?.id || '');
  });

  /**
   * Verifica si la canción está en la cola
   */
  readonly isInQueue = computed(() => {
    return this.queueService.isInQueue(this.song?.id || '');
  });

  /**
   * Clases dinámicas del card
   */
  readonly cardClasses = computed(() => {
    const classes: string[] = ['song-card'];

    // Tipo de video (oficial vs album)
    if (this.isOfficialVideo()) {
      classes.push('official-video');
    } else {
      classes.push('album-track');
    }

    // Size
    classes.push(`size-${this.size}`);

    // Estados
    if (this.isPlaying()) classes.push('playing');
    if (this.isFavorite()) classes.push('favorite');
    if (this._imageError()) classes.push('image-error');
    if (!this._imageLoaded()) classes.push('loading');

    return classes.join(' ');
  });

  /**
   * Determina si es video oficial basado en el título
   */
  readonly isOfficialVideo = computed(() => {
    const title = this.song?.title?.toLowerCase() || '';
    return (
      title.includes('official video') ||
      title.includes('official music video') ||
      title.includes('(official)')
    );
  });

  /**
   * Thumbnail URL con fallback
   * ✅ Soporta ambos formatos:
   *    1. { "default": "https://..." } (string directo)
   *    2. { "default": { url: "https://...", width: 120, height: 90 } } (objeto)
   */
  readonly thumbnailUrl = computed(() => {
    if (this._imageError()) {
      return '/assets/images/default-thumbnail.jpg';
    }

    const thumbnails = this.song?.thumbnails;
    
    if (!thumbnails || typeof thumbnails !== 'object') {
      return '/assets/images/default-thumbnail.jpg';
    }

    // Si el objeto está vacío
    if (Object.keys(thumbnails).length === 0) {
      console.warn('⚠️ Thumbnails vacío para:', this.song?.title);
      return '/assets/images/default-thumbnail.jpg';
    }

    // Obtener mejor calidad disponible
    return this.getBestThumbnailUrl(thumbnails);
  });

  /**
   * Artista/Canal formateado
   */
  readonly formattedArtist = computed(() => {
    const channel = this.song?.channel_title;
    if (!channel) return null;

    // Limpiar " - Topic" y "VEVO" del nombre del canal
    return channel
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/VEVO$/i, '')
      .trim() || channel;
  });

  /**
   * Duración formateada
   */
  readonly formattedDuration = computed(() => {
    const duration = this.song?.duration;
    if (!duration) return null;
    
    const seconds = parseInt(duration, 10);
    if (isNaN(seconds) || seconds < 0) return null;

    return this.formatDuration(seconds);
  });

  // =========================================================================
  // CONSTRUCTOR & EFFECTS
  // =========================================================================

  constructor() {
    // Effect: Log cuando cambia el estado de reproducción
    effect(() => {
      if (this.isPlaying()) {
        console.log(`🎵 Reproduciendo: ${this.song?.title}`);
      }
    });
  }

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  /**
   * Maneja el click en el card → Reproduce la canción
   */
  onSelect(): void {
    if (!this.song) {
      console.warn('No hay canción para seleccionar');
      return;
    }

    console.log(`▶️ Reproduciendo: ${this.song.title} (${this.song.id})`);

    // Emitir evento para el padre (opcional)
    this.selected.emit(this.song);

    // Reproducir la canción
    this.playerService.loadAndPlay(this.song.id, { autoplay: true }).subscribe({
      next: () => console.log('✅ Canción cargada exitosamente'),
      error: (err) => console.error('❌ Error reproduciendo canción:', err),
    });
  }

  /**
   * Maneja el click en el botón de opciones
   */
  onOptionsClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.song) return;

    console.log(`⚙️ Opciones para: ${this.song.title}`);
    this.optionsClick.emit({ song: this.song, event });

    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      this._menuAnchorRect.set({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      this._menuAnchorRect.set({
        top: event.clientY,
        left: event.clientX,
        width: 0,
        height: 0,
      });
    }

    this._isMenuOpen.set(true);
  }

  /**
   * Toggle favorito
   */
  onToggleFavorite(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.song) return;

    const currentFavorite = this.isFavorite();

    this.libraryService.toggleFavorite(this.song.id).subscribe({
      next: () => {
        const newState = !currentFavorite;
        console.log(
          `${newState ? '❤️' : '💔'} ${this.song.title} - Favorito: ${newState}`
        );
        this.favoriteToggle.emit({ song: this.song, isFavorite: newState });
      },
      error: (err) => {
        console.error('Error toggling favorite:', err);
      },
    });
  }

  /**
   * Agregar a la cola
   */
  onAddToQueue(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.song) return;

    this.queueService.addToQueue(this.song);
    console.log(`➕ Agregado a la cola: ${this.song.title}`);
  }

  onOptionsMenuClosed(): void {
    this._isMenuOpen.set(false);
    this._menuAnchorRect.set(null);
  }

  onOptionsMenuAction(action: string): void {
    console.log(`[SongCard] Acción de menú ejecutada: ${action}`);
  }

  /**
   * Reproducir siguiente
   */
  onPlayNext(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.song) return;

    this.queueService.playNext(this.song);
    console.log(`⏭️ Reproducir siguiente: ${this.song.title}`);
  }

  /**
   * Error al cargar imagen
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    
    console.group(`⚠️ Error cargando imagen: ${this.song?.title}`);
    console.log('URL intentada:', imgElement.src);
    console.log('Thumbnails object:', this.song?.thumbnails);
    
    if (this.song?.thumbnails) {
      console.log('Tipo:', typeof this.song.thumbnails);
      console.log('Keys:', Object.keys(this.song.thumbnails));
      
      Object.entries(this.song.thumbnails).forEach(([key, value]) => {
        if (typeof value === 'string') {
          console.log(`  ${key}: "${value}"`);
        } else {
          console.log(`  ${key}:`, value);
        }
      });
    }
    
    console.groupEnd();
    
    this._imageError.set(true);
    this._imageLoaded.set(false);
  }

  /**
   * Imagen cargada exitosamente
   */
  onImageLoad(): void {
    console.log('✅ Imagen cargada:', this.song?.title);
    this._imageError.set(false);
    this._imageLoaded.set(true);

    // Extraer color dominante del thumbnail
    this.extractDominantColor();
  }

  /**
   * Mouse enter
   */
  onMouseEnter(): void {
    this._isHovered.set(true);
  }

  /**
   * Mouse leave
   */
  onMouseLeave(): void {
    this._isHovered.set(false);
  }

  /**
   * Extrae el color dominante del thumbnail cuando hover
   */
  private async extractDominantColor(): Promise<void> {
    const thumbnailUrl = this.thumbnailUrl();
    if (!thumbnailUrl || thumbnailUrl === '/assets/images/default-thumbnail.jpg') {
      return;
    }

    try {
      await this.themeService.updateFromThumbnail(thumbnailUrl);
      
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue('--ytmusic-album-color')
        .trim();
      
      if (color) {
        // Convertir de "R, G, B" a "rgb(R, G, B)"
        this._dominantColor.set(`rgb(${color})`);
      }
    } catch (error) {
      console.warn('Error extracting dominant color:', error);
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  /**
   * Obtiene la mejor URL de thumbnail disponible
   * ✅ Soporta ambos formatos:
   *    1. { "default": "https://..." } (string directo del backend)
   *    2. { "default": { url: "https://...", width: 120, height: 90 } } (objeto completo)
   */
  private getBestThumbnailUrl(thumbnails: Record<string, any>): string {
    // Prioridades de calidad de YouTube (de mejor a peor)
    const priorities = [
      'maxresdefault',  // 1280x720 (puede no existir)
      'maxres',         // 1280x720
      'sddefault',      // 640x480
      'standard',       // 640x480
      'high',           // 480x360
      'medium',         // 320x180
      'default'         // 120x90
    ];

    // Buscar por prioridad
    for (const priority of priorities) {
      const thumbnail = thumbnails[priority];
      
      if (!thumbnail) continue;
      
      // Caso 1: Es un string directo (formato actual del backend)
      if (typeof thumbnail === 'string') {
        // Asegurar HTTPS
        return thumbnail.replace('http://', 'https://');
      }
      
      // Caso 2: Es un objeto con propiedad url
      if (typeof thumbnail === 'object' && 'url' in thumbnail && thumbnail.url) {
        return thumbnail.url.replace('http://', 'https://');
      }
    }

    // Fallback: buscar cualquier thumbnail disponible
    const keys = Object.keys(thumbnails);
    for (const key of keys) {
      const thumbnail = thumbnails[key];
      
      if (typeof thumbnail === 'string') {
        console.warn(`⚠️ Usando thumbnail "${key}" para:`, this.song?.title);
        return thumbnail.replace('http://', 'https://');
      }
      
      if (typeof thumbnail === 'object' && 'url' in thumbnail && thumbnail.url) {
        console.warn(`⚠️ Usando thumbnail "${key}" para:`, this.song?.title);
        return thumbnail.url.replace('http://', 'https://');
      }
    }

    // No se encontró nada válido
    console.error('❌ No thumbnails válidos para:', this.song?.title, thumbnails);
    return '/assets/images/default-thumbnail.jpg';
  }

  /**
   * Formatea duración de segundos a MM:SS
   */
  private formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Aria label para accesibilidad
   */
  getAriaLabel(): string {
    const title = this.song?.title || 'Canción desconocida';
    const artist = this.formattedArtist();
    const artistText = artist ? ` de ${artist}` : '';
    const playingState = this.isPlaying() ? ' (reproduciendo ahora)' : '';
    const favoriteState = this.isFavorite() ? ' (favorito)' : '';

    return `Reproducir ${title}${artistText}${playingState}${favoriteState}`;
  }

  /**
   * Formatea fecha de publicación (opcional para showAlbum)
   */
  getPublishedDate(): string {
    const publishedAt = this.song?.published_at;
    if (!publishedAt) return '';

    try {
      const date = new Date(publishedAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Hoy';
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
      if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
      return `Hace ${Math.floor(diffDays / 365)} años`;
    } catch {
      return '';
    }
  }

  /**
   * CSS custom property para color dinámico basado en thumbnail
   */
  getCardStyle(): Record<string, string> {
    const color = this._dominantColor();
    
    if (color) {
      return {
        '--ytmusic-album-color': color,
      };
    }
    
    // Fallback: usar el color de las CSS variables globales si ya fue extraído
    return {};
  }
}