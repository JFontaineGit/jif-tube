import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueService, LibraryService } from '@services';
import { Song } from '@interfaces';

/**
 * Menú contextual de opciones para una canción
 * 
 * Features:
 * - Agregar a cola / Reproducir siguiente
 * - Toggle favorito
 * - Compartir
 * - Ver en YouTube
 * - Posicionamiento inteligente
 * - Click outside para cerrar
 */
@Component({
  selector: 'app-song-options-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-menu.component.html',
  styles: [`
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongOptionsMenuComponent implements AfterViewInit {
  private readonly queueService = inject(QueueService);
  private readonly libraryService = inject(LibraryService);

  @ViewChild('menuElement') menuElement?: ElementRef<HTMLDivElement>;

  @Input({ required: true }) song!: Song;
  @Input() triggerEvent?: MouseEvent;

  @Output() closed = new EventEmitter<void>();
  @Output() actionExecuted = new EventEmitter<string>();

  readonly isOpen = signal(true);
  readonly position = signal({ top: 0, left: 0 });

  readonly isFavorite = computed(() => {
    return this.libraryService.isFavorite(this.song?.id || '');
  });

  ngAfterViewInit(): void {
    this.calculatePosition();
  }

  /**
   * Calcula la posición del menú basado en el evento de click
   */
  private calculatePosition(): void {
    if (!this.triggerEvent || !this.menuElement) {
      // Fallback: centrar en la pantalla
      this.position.set({
        top: window.innerHeight / 2 - 200,
        left: window.innerWidth / 2 - 140,
      });
      return;
    }

    const menuWidth = 280;
    const menuHeight = 400;
    const padding = 16;

    let top = this.triggerEvent.clientY;
    let left = this.triggerEvent.clientX;

    // Ajustar si se sale por la derecha
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - padding;
    }

    // Ajustar si se sale por abajo
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - padding;
    }

    // Asegurar que no salga por arriba o izquierda
    top = Math.max(padding, top);
    left = Math.max(padding, left);

    this.position.set({ top, left });
  }

  /**
   * Cierra el menú
   */
  close(): void {
    this.isOpen.set(false);
    setTimeout(() => this.closed.emit(), 200);
  }

  /**
   * Agregar a la cola
   */
  onAddToQueue(): void {
    this.queueService.addToQueue(this.song);
    console.log(`➕ Agregado a la cola: ${this.song.title}`);
    this.actionExecuted.emit('add_to_queue');
    this.close();
  }

  /**
   * Reproducir siguiente
   */
  onPlayNext(): void {
    this.queueService.playNext(this.song);
    console.log(`⏭️ Reproducir siguiente: ${this.song.title}`);
    this.actionExecuted.emit('play_next');
    this.close();
  }

  /**
   * Toggle favorito
   */
  onToggleFavorite(): void {
    this.libraryService.toggleFavorite(this.song.id).subscribe({
      next: () => {
        const isFav = this.isFavorite();
        console.log(`${isFav ? '❤️' : '💔'} Favorito: ${this.song.title}`);
        this.actionExecuted.emit('toggle_favorite');
      },
      error: (err) => console.error('Error toggling favorite:', err),
    });
    this.close();
  }

  /**
   * Compartir (Web Share API)
   */
  async onShare(): Promise<void> {
    const url = `https://music.youtube.com/watch?v=${this.song.id}`;
    const text = `${this.song.title} - ${this.formatChannel(this.song.channel_title)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: this.song.title, text, url });
        console.log('✅ Compartido exitosamente');
        this.actionExecuted.emit('share');
      } catch (err) {
        console.log('❌ Error compartiendo:', err);
      }
    } else {
      // Fallback: copiar al portapapeles
      await this.copyToClipboard(url);
      alert('Enlace copiado al portapapeles');
    }
    this.close();
  }

  /**
   * Abrir en YouTube
   */
  onOpenInYouTube(): void {
    const url = `https://music.youtube.com/watch?v=${this.song.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    console.log(`🔗 Abriendo en YouTube: ${this.song.title}`);
    this.actionExecuted.emit('open_youtube');
    this.close();
  }

  /**
   * Copiar enlace
   */
  async onCopyLink(): Promise<void> {
    const url = `https://music.youtube.com/watch?v=${this.song.id}`;
    await this.copyToClipboard(url);
    alert('✅ Enlace copiado al portapapeles');
    this.actionExecuted.emit('copy_link');
    this.close();
  }

  /**
   * Helper: Copiar texto al portapapeles
   */
  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback para navegadores antiguos
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  /**
   * Formatea el nombre del canal (limpia Topic/VEVO)
   */
  formatChannel(channel: string | null): string {
    if (!channel) return 'Canal desconocido';
    return channel
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/VEVO$/i, '')
      .trim() || channel;
  }
}