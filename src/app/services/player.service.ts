// src/app/services/player.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Song } from '../models/song.model';
import { StorageService } from './core/storage.service';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  private selectedSong = new BehaviorSubject<Song | null>(null);
  selectedSong$ = this.selectedSong.asObservable();

  private autoplay = new BehaviorSubject<boolean>(true);
  autoplay$ = this.autoplay.asObservable();

  constructor(private storageService: StorageService) {}

  setSelectedSong(song: Song | null) {
    this.selectedSong.next(song);
  }

  setAutoplay(autoplay: boolean) {
    this.autoplay.next(autoplay);
  }

  clearHistory() {
    this.storageService.remove('recentSongs').subscribe({
      next: () => {
        console.log('Historial de canciones recientes eliminado del almacenamiento.');
      },
      error: (error) => {
        console.error('Error al eliminar el historial:', error.message);
      }
    });
  }
}
