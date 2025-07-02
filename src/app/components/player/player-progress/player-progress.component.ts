import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import { LoggerService } from '../../../services/core/logger.service';

@Component({
  selector: 'app-player-progress',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player-progress.component.html',
  styleUrls: ['./player-progress.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerProgressComponent implements AfterViewInit, OnDestroy {
  private logger = inject(LoggerService);

  @Input() currentTime = 0;
  @Input() duration = 0;
  @Output() seek = new EventEmitter<number>();

  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();
  isDragging = false;

  get progressPercentage(): number {
    return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
  }

  get formattedCurrentTime(): string {
    return this.formatTime(this.currentTime);
  }

  get formattedDuration(): string {
    return this.formatTime(this.duration);
  }

  ngAfterViewInit(): void {
    const progressElement = this.progressBar.nativeElement;

    // Manejar clic en la barra de progreso
    fromEvent(progressElement, 'click')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: Event) => {
        this.handleProgressBarInteraction(event as MouseEvent);
      });

    // Manejar arrastre (mousedown, mousemove, mouseup)
    fromEvent(progressElement, 'mousedown')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: Event) => {
        this.isDragging = true;
        this.handleProgressBarInteraction(event as MouseEvent);

        const mouseMoveHandler = fromEvent(document, 'mousemove')
          .pipe(takeUntil(this.destroy$))
          .subscribe((moveEvent: Event) => {
            if (this.isDragging) {
              this.handleProgressBarInteraction(moveEvent as MouseEvent);
            }
          });

        const mouseUpHandler = fromEvent(document, 'mouseup')
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.isDragging = false;
          });
      });

    // Manejar eventos táctiles para dispositivos móviles
    fromEvent(progressElement, 'touchstart')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: Event) => {
        this.isDragging = true;
        this.handleTouchInteraction(event as TouchEvent);

        const touchMoveHandler = fromEvent(document, 'touchmove')
          .pipe(takeUntil(this.destroy$))
          .subscribe((moveEvent: Event) => {
            if (this.isDragging) {
              this.handleTouchInteraction(moveEvent as TouchEvent);
            }
          });

        const touchEndHandler = fromEvent(document, 'touchend')
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.isDragging = false;
          });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private handleProgressBarInteraction(event: MouseEvent): void {
    const progressElement = this.progressBar.nativeElement;
    const rect = progressElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const width = rect.width;

    const percentage = Math.max(0, Math.min(1, offsetX / width));
    const seekTime = percentage * this.duration;
    this.logger.debug(`Buscando posición: ${seekTime.toFixed(2)} segundos`);
    this.seek.emit(seekTime);
  }

  private handleTouchInteraction(event: TouchEvent): void {
    event.preventDefault();
    const progressElement = this.progressBar.nativeElement;
    const rect = progressElement.getBoundingClientRect();
    const touch = event.touches[0];
    const offsetX = touch.clientX - rect.left;
    const width = rect.width;

    const percentage = Math.max(0, Math.min(1, offsetX / width));
    const seekTime = percentage * this.duration;
    this.logger.debug(`Buscando posición (táctil): ${seekTime.toFixed(2)} segundos`);
    this.seek.emit(seekTime);
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '0:00';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}