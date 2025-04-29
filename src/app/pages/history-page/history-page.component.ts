// src/app/pages/history-page/history-page.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PlayerService } from '../../services/player.service';
import { Song } from '../../models/song.model';
import { SongCardComponent } from '../../components/song-card/song-card.component';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, SongCardComponent],
  templateUrl: './history-page.component.html',
  styleUrls: ['./history-page.component.scss'],
})
export class HistoryPageComponent implements OnInit, OnDestroy {
  recentSongs: Song[] = [];
  selectedSong: Song | null = null;
  private songSubscription: Subscription | null = null;

  constructor(private playerService: PlayerService) {}

  ngOnInit(): void {
    // Cargar historial desde localStorage
    this.loadHistory();

    // Suscribirse a cambios en la canción seleccionada para añadirla al historial
    this.songSubscription = this.playerService.selectedSong$.subscribe((song) => {
      if (song) {
        this.addToHistory(song);
      }
    });
  }

  ngOnDestroy(): void {
    // Desuscribirse para evitar memory leaks
    if (this.songSubscription) {
      this.songSubscription.unsubscribe();
    }
  }

  loadHistory(): void {
    try {
      const savedSongs = localStorage.getItem('recentSongs');
      this.recentSongs = savedSongs ? JSON.parse(savedSongs) : [];
    } catch (error) {
      console.error('Error loading history from localStorage:', error);
      this.recentSongs = [];
    }
  }

  addToHistory(song: Song): void {
    // Evitar duplicados
    this.recentSongs = this.recentSongs.filter((s) => s.id !== song.id);
    this.recentSongs.unshift(song); // Añadir al inicio
    this.recentSongs = this.recentSongs.slice(0, 50); // Limitar a 50 canciones
    try {
      localStorage.setItem('recentSongs', JSON.stringify(this.recentSongs));
    } catch (error) {
      console.error('Error saving history to localStorage:', error);
    }
  }

  onSongSelected(song: Song): void {
    this.selectedSong = song;
    this.playerService.setSelectedSong(song);
  }

  clearHistory(): void {
    this.recentSongs = [];
    this.playerService.clearHistory(); // Sincronizar con PlayerService
  }
}