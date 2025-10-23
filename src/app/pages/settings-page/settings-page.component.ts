import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { 
  PlayerService, 
  QueueService, 
  LibraryService, 
  StorageService,
  ThemeService,
  LoggerService 
} from '@services';
import { RepeatMode } from '@interfaces';

/**
 * Settings Page Component - Configuración de la aplicación
 * 
 * Features:
 * - Ajustes de reproducción (autoplay, volumen, calidad)
 * - Gestión de datos (exportar/importar/limpiar)
 * - Estadísticas del usuario
 * - Tema dinámico
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.scss'],
})
export class SettingsPageComponent implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly queueService = inject(QueueService);
  private readonly libraryService = inject(LibraryService);
  private readonly storage = inject(StorageService);
  private readonly themeService = inject(ThemeService);
  private readonly logger = inject(LoggerService);
  
  private readonly destroy$ = new Subject<void>();

  // =========================================================================
  // STATE SIGNALS
  // =========================================================================

  private readonly _error = signal<string | null>(null);
  private readonly _successMessage = signal<string | null>(null);

  readonly error = this._error.asReadonly();
  readonly successMessage = this._successMessage.asReadonly();

  // Settings signals
  readonly volume = this.playerService.volume;
  readonly isMuted = this.playerService.isMuted;
  readonly repeatMode = this.queueService.repeatMode;
  readonly shuffle = this.queueService.shuffle;

  // =========================================================================
  // COMPUTED SIGNALS - ESTADÍSTICAS
  // =========================================================================

  // Exponer Math para el template
  readonly Math = Math;

  /**
   * Cantidad de canciones en la biblioteca
   */
  readonly libraryCount = this.libraryService.favoriteCount;

  /**
   * Cantidad de canciones en el historial
   */
  readonly historyCount = computed(() => this.queueService.history().length);

  /**
   * Cantidad de canciones en la cola
   */
  readonly queueCount = computed(() => this.queueService.queue().length);

  /**
   * Canción actualmente reproduciendo
   */
  readonly currentSong = this.playerService.currentSong;

  /**
   * Estado del reproductor
   */
  readonly isPlaying = this.playerService.playing;

  /**
   * Versión de la app
   */
  readonly appVersion = '1.0.0';

  /**
   * Estadísticas totales
   */
  readonly totalStats = computed(() => {
    return {
      library: this.libraryCount(),
      history: this.historyCount(),
      queue: this.queueCount(),
    };
  });

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.logger.info('SettingsPageComponent initialized');
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  /**
   * Carga configuraciones guardadas
   */
  private loadSettings(): void {
    // Cargar volumen desde storage
    this.storage.getVolume().subscribe({
      next: (savedVolume) => {
        if (savedVolume !== null) {
          this.logger.debug('Volumen cargado:', savedVolume);
        }
      },
      error: (err) => this.logger.error('Error cargando volumen:', err),
    });

    // Cargar biblioteca para estadísticas
    this.libraryService.getLibrary().subscribe({
      error: (err) => this.logger.warn('Error cargando biblioteca:', err),
    });
  }

  // =========================================================================
  // PLAYBACK SETTINGS
  // =========================================================================

  /**
   * Ajusta el volumen
   */
  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newVolume = parseInt(target.value, 10) / 100; // 0-1
    this.playerService.setVolume(newVolume);
    this.logger.debug('Volumen ajustado:', Math.round(newVolume * 100));
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    this.playerService.toggleMute();
    this.showSuccess(this.isMuted() ? 'Audio silenciado' : 'Audio activado');
  }

  /**
   * Cicla el modo de repetición
   */
  cycleRepeatMode(): void {
    const newMode = this.queueService.toggleRepeatMode();
    const modeText = {
      [RepeatMode.OFF]: 'Repetición desactivada',
      [RepeatMode.ALL]: 'Repetir todas',
      [RepeatMode.ONE]: 'Repetir una',
    };
    this.showSuccess(modeText[newMode]);
  }

  /**
   * Toggle shuffle
   */
  toggleShuffle(): void {
    const newShuffle = this.queueService.toggleShuffle();
    this.showSuccess(newShuffle ? 'Aleatorio activado' : 'Aleatorio desactivado');
  }

  /**
   * Obtiene el icono del modo repeat
   */
  getRepeatIcon(): string {
    switch (this.repeatMode()) {
      case RepeatMode.ONE:
        return 'repeat_one';
      case RepeatMode.ALL:
        return 'repeat';
      default:
        return 'repeat';
    }
  }

  /**
   * Obtiene el texto del modo repeat
   */
  getRepeatText(): string {
    switch (this.repeatMode()) {
      case RepeatMode.OFF:
        return 'Desactivado';
      case RepeatMode.ALL:
        return 'Repetir todas';
      case RepeatMode.ONE:
        return 'Repetir una';
      default:
        return 'Desactivado';
    }
  }

  // =========================================================================
  // DATA MANAGEMENT
  // =========================================================================

  /**
   * Exporta todos los datos a JSON
   */
  async exportData(): Promise<void> {
    try {
      this.logger.info('Exportando datos...');

      const data = {
        version: this.appVersion,
        exportDate: new Date().toISOString(),
        library: this.libraryService.libraryItems(),
        queue: {
          songs: this.queueService.queue(),
          currentIndex: this.queueService.currentIndex(),
          history: this.queueService.history(),
          repeatMode: this.repeatMode(),
          shuffle: this.shuffle(),
        },
        settings: {
          volume: this.volume(),
          isMuted: this.isMuted(),
        },
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jiftube-backup-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      this.showSuccess('✅ Datos exportados correctamente');
      this.logger.info('Datos exportados exitosamente');
    } catch (err) {
      this.logger.error('Error exportando datos:', err);
      this._error.set('Error al exportar los datos');
    }
  }

  /**
   * Importa datos desde un archivo JSON
   */
  importData(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validar estructura básica
        if (!data.version || !data.library) {
          throw new Error('Formato de archivo inválido');
        }

        this.logger.info('Importando datos...');
        
        // TODO: Implementar importación real
        // Por ahora solo mostramos un preview
        const preview = `
Datos a importar:
• ${data.library.length} canciones en biblioteca
• ${data.queue?.songs?.length || 0} canciones en cola
• ${data.queue?.history?.length || 0} canciones en historial
        `.trim();

        const confirmed = confirm(
          `${preview}\n\n¿Deseas importar estos datos?\n\nADVERTENCIA: Esto sobrescribirá tus datos actuales.`
        );

        if (confirmed) {
          // TODO: Implementar importación real con los servicios
          this.showSuccess('Funcionalidad en desarrollo');
          this.logger.info('Importación confirmada (pendiente implementar)');
        }
      } catch (err) {
        this.logger.error('Error importando datos:', err);
        this._error.set('Error al leer el archivo. Verifica que sea un archivo válido.');
      }
    };

    input.click();
  }

  /**
   * Limpia todos los datos de la aplicación
   */
  clearAllData(): void {
    const stats = this.totalStats();
    
    const confirmed = confirm(
      `⚠️ ADVERTENCIA: Esta acción eliminará TODOS tus datos:\n\n` +
      `• ${stats.library} canciones en biblioteca\n` +
      `• ${stats.history} canciones en historial\n` +
      `• ${stats.queue} canciones en cola\n` +
      `• Todas las configuraciones\n\n` +
      `Esta acción NO se puede deshacer.\n\n` +
      `¿Estás ABSOLUTAMENTE seguro?`
    );

    if (!confirmed) {
      this.logger.info('Limpieza de datos cancelada');
      return;
    }

    // Segunda confirmación
    const doubleConfirm = prompt(
      'Para confirmar, escribe "BORRAR TODO" (en mayúsculas):'
    );

    if (doubleConfirm !== 'BORRAR TODO') {
      this.logger.info('Limpieza de datos cancelada (confirmación incorrecta)');
      return;
    }

    this.logger.warn('Limpiando todos los datos...');

    // Limpiar todo
    this.queueService.clearQueue();
    this.libraryService.clearLibrary();
    this.storage.clearAll().subscribe({
      next: () => {
        this.logger.info('✅ Todos los datos eliminados');
        alert('Datos eliminados correctamente. La página se recargará.');
        window.location.reload();
      },
      error: (err) => {
        this.logger.error('❌ Error limpiando datos:', err);
        this._error.set('Error al limpiar los datos');
      },
    });
  }

  // =========================================================================
  // THEME CONFIGURATION
  // =========================================================================

  /**
   * Configura el ratio del tema dinámico
   */
  setThemeRatio(ratio: number): void {
    this.themeService.setConfig({ ratio });
    this.showSuccess(`Intensidad del tema: ${Math.round(ratio * 100)}%`);
  }

  /**
   * Toggle tema dinámico
   */
  toggleDynamicTheme(): void {
    // Por ahora el tema siempre está activo
    // En el futuro se podría agregar un toggle
    this.showSuccess('Tema dinámico siempre activo');
  }

  // =========================================================================
  // UI HELPERS
  // =========================================================================

  /**
   * Muestra mensaje de éxito temporal
   */
  private showSuccess(message: string): void {
    this._successMessage.set(message);
    setTimeout(() => this._successMessage.set(null), 3000);
  }

  /**
   * Limpia el mensaje de error
   */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * Limpia el mensaje de éxito
   */
  clearSuccess(): void {
    this._successMessage.set(null);
  }

  /**
   * Formatea bytes a tamaño legible
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Obtiene el uso estimado de storage
   */
  getEstimatedStorageUsage(): string {
    // Estimación aproximada
    const librarySize = this.libraryCount() * 1024; // ~1KB por canción
    const historySize = this.historyCount() * 512;  // ~0.5KB por entrada
    const queueSize = this.queueCount() * 1024;     // ~1KB por canción
    
    const total = librarySize + historySize + queueSize;
    return this.formatBytes(total);
  }
}