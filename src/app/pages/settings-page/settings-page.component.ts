// src/app/pages/settings-page/settings-page.component.ts
import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { StorageService } from '../../services/core/storage.service';
import { PlayerService } from '../../services/player.service';
import { LoggerService } from '../../services/core/logger.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.scss'],
})
export class SettingsPageComponent implements OnInit {
  private playerService = inject(PlayerService);
  private storage = inject(StorageService);
  private logger = inject(LoggerService);
  private platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();
  private isBrowser = isPlatformBrowser(this.platformId);

  // Settings signals
  autoplay = signal<boolean>(true);
  notifications = signal<boolean>(false);
  volume = signal<number>(100);
  error = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadSettings();
    this.syncWithPlayerState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga configuraciones guardadas
   */
  private loadSettings(): void {
    // Autoplay
    this.storage.get<boolean>('autoplay')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.autoplay.set(saved ?? true);
        },
        error: (err) => this.logger.error('Error cargando autoplay:', err),
      });

    // Notifications
    this.storage.get<boolean>('notifications')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.notifications.set(saved ?? false);
        },
        error: (err) => this.logger.error('Error cargando notificaciones:', err),
      });
  }

  /**
   * Sincroniza con el estado del player
   */
  private syncWithPlayerState(): void {
    this.playerService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.volume.set(state.volume);
      });
  }

  /**
   * Toggle autoplay
   */
  toggleAutoplay(): void {
    const newValue = !this.autoplay();
    this.autoplay.set(newValue);
    
    this.storage.save('autoplay', newValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.logger.info(`Autoplay: ${newValue ? 'activado' : 'desactivado'}`),
        error: (err) => {
          this.logger.error('Error guardando autoplay:', err);
          this.error.set('Error al guardar configuración');
        },
      });
  }

  /**
   * Toggle notifications
   */
  toggleNotifications(): void {
    const newValue = !this.notifications();
    this.notifications.set(newValue);
    
    this.storage.save('notifications', newValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.logger.info(`Notificaciones: ${newValue ? 'activadas' : 'desactivadas'}`),
        error: (err) => {
          this.logger.error('Error guardando notificaciones:', err);
          this.error.set('Error al guardar configuración');
        },
      });
  }

  /**
   * Actualiza el volumen
   */
  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newVolume = parseInt(target.value, 10);
    this.volume.set(newVolume);
    this.playerService.setVolume(newVolume / 100);
  }

  /**
   * Limpia todos los datos de la app
   */
  clearData(): void {
    const confirmed = confirm(
      '¿Estás seguro de que quieres borrar todos los datos de la aplicación?\n\n' +
      'Esto incluye:\n' +
      '• Historial de reproducción\n' +
      '• Biblioteca guardada\n' +
      '• Configuraciones\n\n' +
      'Esta acción NO se puede deshacer.'
    );

    if (!confirmed) return;

    this.storage.clearStorage()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.logger.info('Todos los datos han sido eliminados');
          
          this.autoplay.set(true);
          this.notifications.set(false);
          this.volume.set(100);
          
          if (this.isBrowser) {
            localStorage.removeItem('recentSongs');
            localStorage.removeItem('savedSongs');
          }
          
          alert('Datos eliminados correctamente. La página se recargará.');
          window.location.reload();
        },
        error: (err) => {
          this.logger.error('Error limpiando datos:', err);
          this.error.set('Error al limpiar los datos');
          alert('Hubo un error al eliminar los datos. Intenta nuevamente.');
        },
      });
  }

  /**
   * Exporta datos (placeholder para futura funcionalidad)
   */
  exportData(): void {
    alert('Funcionalidad de exportación próximamente disponible');
    // TODO: Implementar exportación de datos a JSON
  }

  /**
   * Importa datos (placeholder para futura funcionalidad)
   */
  importData(): void {
    alert('Funcionalidad de importación próximamente disponible');
  }
}