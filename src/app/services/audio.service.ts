import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { IAudioTrack } from '../models/audio-track.model';
import { Song } from '../models/song.model';
import { LoggerService } from '../services/core/logger.service';
import { StorageService } from '../services/core/storage.service';
import { YoutubeService } from './youtube.service';

/**
 * Servicio para gestionar la reproducción de audio en la aplicación.
 * Se encarga de obtener streams de audio, controlar el estado del reproductor
 * y manejar eventos relacionados con la reproducción.
 */
@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private audio: HTMLAudioElement;
  private currentTrackSubject = new BehaviorSubject<IAudioTrack | null>(null);
  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  private currentTimeSubject = new BehaviorSubject<number>(0);
  private durationSubject = new BehaviorSubject<number>(0);
  private volumeSubject = new BehaviorSubject<number>(1);

  public currentTrack$ = this.currentTrackSubject.asObservable();
  public isPlaying$ = this.isPlayingSubject.asObservable();
  public currentTime$ = this.currentTimeSubject.asObservable();
  public duration$ = this.durationSubject.asObservable();
  public volume$ = this.volumeSubject.asObservable();

  constructor(
    private http: HttpClient,
    private youtubeService: YoutubeService,
    private logger: LoggerService,
    private storage: StorageService
  ) {
    this.audio = new Audio();
    this.initializeAudioEvents();
  }

  /**
   * Reproduce una pista de audio a partir de una canción seleccionada.
   * @param song - La canción a reproducir.
   * @returns Promise que resuelve cuando la pista comienza a reproducirse.
   */
  async play(song?: Song): Promise<void> {
    try {
      if (song) {
        const track = await this.loadTrack(song).toPromise();
        if (!track) {
          throw new Error('No se pudo cargar la pista de audio');
        }
        this.currentTrackSubject.next(track);
        this.audio.src = track.url;
        this.audio.load();
        this.logger.debug(`Cargando pista: ${track.title}`);
      }
      await this.audio.play();
      this.isPlayingSubject.next(true);
      this.logger.info(`Reproduciendo pista: ${this.currentTrackSubject.value?.title || 'desconocida'}`);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Pausa la reproducción actual.
   */
  pause(): void {
    try {
      this.audio.pause();
      this.isPlayingSubject.next(false);
      this.logger.info('Reproducción pausada');
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Detiene la reproducción y limpia la pista actual.
   */
  stop(): void {
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.currentTrackSubject.next(null);
      this.isPlayingSubject.next(false);
      this.currentTimeSubject.next(0);
      this.logger.info('Reproducción detenida');
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Cambia a la pista anterior (lógica a implementar según historial).
   * @returns Promise que resuelve cuando la pista anterior se carga.
   */
  async previous(): Promise<void> {
    try {
      // TODO: Implementar lógica para obtener la pista anterior desde el historial
      this.logger.warn('Función previous no implementada aún');
      throw new Error('Función previous no implementada');
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Cambia a la siguiente pista (lógica a implementar según cola o historial).
   * @returns Promise que resuelve cuando la siguiente pista se carga.
   */
  async next(): Promise<void> {
    try {
      // TODO: Implementar lógica para obtener la siguiente pista desde la cola
      this.logger.warn('Función next no implementada aún');
      throw new Error('Función next no implementada');
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Ajusta la posición de reproducción a un tiempo específico.
   * @param time - Tiempo en segundos al que se desea mover la reproducción.
   * @returns Promise que resuelve cuando se ajusta la posición.
   */
  async seek(time: number): Promise<void> {
    try {
      if (time < 0 || time > this.audio.duration) {
        throw new Error('Tiempo de búsqueda inválido');
      }
      this.audio.currentTime = time;
      this.currentTimeSubject.next(time);
      this.logger.debug(`Posición ajustada a ${time} segundos`);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Ajusta el volumen del reproductor.
   * @param volume - Valor del volumen (entre 0 y 1).
   */
  setVolume(volume: number): void {
    try {
      if (volume < 0 || volume > 1) {
        throw new Error('Volumen inválido, debe estar entre 0 y 1');
      }
      this.audio.volume = volume;
      this.volumeSubject.next(volume);
      this.logger.debug(`Volumen ajustado a ${volume}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Carga los detalles de una pista de audio desde una canción.
   * @param song - La canción de la que se obtendrán los datos.
   * @returns Observable con los detalles de la pista de audio.
   */
  private loadTrack(song: Song): Observable<IAudioTrack> {
    const params = new HttpParams().set('videoId', song.videoId);
    return this.http.get<{ url: string; duration: number }>('https://api.example.com/audio-stream', { params }).pipe(
      map((response: { url: string; duration: number }) => {
        this.logger.debug(`Pista cargada para videoId: ${song.videoId}`);
        return {
          id: song.id,
          title: song.title,
          artist: song.artist,
          url: response.url,
          duration: response.duration,
          thumbnail: song.thumbnailUrl,
        };
      }),
      catchError((error: any) => this.handleError(error))
    );
  }

  /**
   * Inicializa los eventos del elemento de audio HTML.
   */
  private initializeAudioEvents(): void {
    this.audio.addEventListener('timeupdate', () => {
      this.currentTimeSubject.next(this.audio.currentTime);
      this.logger.debug(`Tiempo actualizado: ${this.audio.currentTime.toFixed(2)} segundos`);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.durationSubject.next(this.audio.duration);
      this.logger.debug(`Duración cargada: ${this.audio.duration} segundos`);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlayingSubject.next(false);
      this.logger.info('Pista finalizada');
      this.next().catch(() => {
        this.logger.warn('No hay más pistas para reproducir');
      });
    });

    this.audio.addEventListener('error', () => {
      this.handleError(new Error('Error en la reproducción de audio'));
    });
  }

  /**
   * Maneja los errores de las operaciones del servicio.
   * @param error - El error capturado.
   * @returns Observable que emite el error manejado.
   */
  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error desconocido';
    if (error.status) {
      switch (error.status) {
        case 400:
          errorMessage = 'Solicitud inválida';
          break;
        case 401:
          errorMessage = 'No autorizado';
          this.storage.clearStorage().subscribe({
            next: () => this.logger.info('Almacenamiento limpiado tras error 401'),
            error: (err) => this.logger.error('Error al limpiar almacenamiento', err),
          });
          break;
        case 403:
          errorMessage = 'Acceso denegado';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado';
          break;
        case 500:
          errorMessage = 'Error del servidor';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.message || 'Error desconocido'}`;
      }
    } else {
      errorMessage = error.message || errorMessage;
    }

    this.logger.error(`AudioService Error: ${errorMessage}`, error);
    return throwError(() => new Error(errorMessage));
  }
}