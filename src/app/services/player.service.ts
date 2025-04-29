// src/app/services/player.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Song } from '../models/song.model';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  private selectedSong = new BehaviorSubject<Song | null>(null);
  selectedSong$ = this.selectedSong.asObservable();

  private autoplay = new BehaviorSubject<boolean>(true);
  autoplay$ = this.autoplay.asObservable();

  setSelectedSong(song: Song | null) {
    this.selectedSong.next(song);
    // Si autoplay está activado, el reproductor ya lo maneja con ?autoplay=1
  }

  setAutoplay(autoplay: boolean) {
    this.autoplay.next(autoplay);
  }

  clearHistory() {
    // Notificar a HistoryPageComponent para limpiar el historial
    // Esto puede ser manejado por un BehaviorSubject separado si HistoryPageComponent lo necesita
    localStorage.removeItem('recentSongs'); // Limpiar historial almacenado
  }
}