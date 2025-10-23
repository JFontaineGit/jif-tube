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
  HostListener,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueService, LibraryService } from '@services';
import { Song } from '@interfaces';

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-song-options-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-menu.component.html',
  styleUrls: ['./song-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongOptionsMenuComponent implements AfterViewInit, OnChanges {
  private readonly queueService = inject(QueueService);
  private readonly libraryService = inject(LibraryService);
  private readonly isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  @ViewChild('menuElement') menuElement?: ElementRef<HTMLDivElement>;

  @Input({ required: true }) song!: Song;
  @Input() anchorRect?: AnchorRect | null;

  @Output() closed = new EventEmitter<void>();
  @Output() actionExecuted = new EventEmitter<string>();

  readonly isOpen = signal(true);
  readonly position = signal({ top: 0, left: 0 });
  readonly isMobileLayout = signal(false);

  readonly isFavorite = computed(() => {
    return this.libraryService.isFavorite(this.song?.id || '');
  });

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.updateViewport();
    queueMicrotask(() => this.calculatePosition());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isBrowser) return;
    if (changes['anchorRect'] && !changes['anchorRect'].firstChange) {
      queueMicrotask(() => this.calculatePosition());
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.isBrowser) return;
    this.updateViewport();
    this.calculatePosition();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isBrowser) return;
    const menuEl = this.menuElement?.nativeElement;
    if (!menuEl) {
      this.close();
      return;
    }

    if (!menuEl.contains(event.target as Node)) {
      this.close();
    }
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.closed.emit();
  }

  onAddToQueue(): void {
    this.queueService.addToQueue(this.song);
    console.log(`➕ Agregado a la cola: ${this.song.title}`);
    this.actionExecuted.emit('add_to_queue');
    this.close();
  }

  onPlayNext(): void {
    this.queueService.playNext(this.song);
    console.log(`⏭️ Reproducir siguiente: ${this.song.title}`);
    this.actionExecuted.emit('play_next');
    this.close();
  }

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

  async onShare(): Promise<void> {
    const url = `https://music.youtube.com/watch?v=${this.song.id}`;
    const text = `${this.song.title} - ${this.formatChannel(this.song.channel_title)}`;

    if (this.isBrowser && navigator.share) {
      try {
        await navigator.share({ title: this.song.title, text, url });
        console.log('✅ Compartido exitosamente');
        this.actionExecuted.emit('share');
      } catch (err) {
        console.log('❌ Error compartiendo:', err);
      }
    } else {
      await this.copyToClipboard(url);
      console.log('✅ Enlace copiado al portapapeles');
      this.actionExecuted.emit('share_copy');
    }
    this.close();
  }

  onOpenInYouTube(): void {
    const url = `https://music.youtube.com/watch?v=${this.song.id}`;
    if (this.isBrowser) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    console.log(`🔗 Abriendo en YouTube: ${this.song.title}`);
    this.actionExecuted.emit('open_youtube');
    this.close();
  }

  async onCopyLink(): Promise<void> {
    const url = `https://music.youtube.com/watch?v=${this.song.id}`;
    await this.copyToClipboard(url);
    console.log('✅ Enlace copiado al portapapeles');
    this.actionExecuted.emit('copy_link');
    this.close();
  }

  formatChannel(channel: string | null): string {
    if (!channel) return 'Canal desconocido';
    return channel
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/VEVO$/i, '')
      .trim() || channel;
  }

  private updateViewport(): void {
    if (!this.isBrowser) return;
    this.isMobileLayout.set(window.innerWidth <= 768);
  }

  private calculatePosition(): void {
    if (!this.isBrowser) return;
    if (this.isMobileLayout()) {
      this.position.set({ top: window.innerHeight, left: 0 });
      return;
    }

    const menuWidth = this.menuElement?.nativeElement.offsetWidth ?? 300;
    const menuHeight = this.menuElement?.nativeElement.offsetHeight ?? 360;
    const padding = 16;

    if (!this.anchorRect) {
      this.position.set({
        top: Math.max(padding, window.innerHeight / 2 - menuHeight / 2),
        left: Math.max(padding, window.innerWidth / 2 - menuWidth / 2),
      });
      return;
    }

    let top = this.anchorRect.top + this.anchorRect.height + 8;
    let left = this.anchorRect.left + this.anchorRect.width - menuWidth;

    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    if (left < padding) {
      left = padding;
    }

    if (top + menuHeight > window.innerHeight - padding) {
      top = this.anchorRect.top - menuHeight - 8;
    }

    if (top < padding) {
      top = padding;
    }

    this.position.set({ top, left });
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      if (this.isBrowser && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch (err) {
      if (!this.isBrowser) return;
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
}
